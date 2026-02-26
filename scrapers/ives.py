"""IVES (Dan Ives Wedbush AI Revolution ETF) connector."""

import csv
import io
import logging
import re
from datetime import datetime
from typing import Any, Optional

import scrapers.edgar as edgar
from scrapers.base import Connector
from scrapers.utils import parse_number, normalize_key, retry_get

logger = logging.getLogger(__name__)

CSV_URL = "https://wedbushfunds.com/latest-sod-holdings-ives"
CIK = "2055464"

# Column name aliases -> canonical name
_COL_ALIASES = {
    "ticker": "ticker", "ticker_symbol": "ticker", "symbol": "ticker",
    "name": "name", "securityname": "name", "security_name": "name", "security": "name",
    "sedol": "sedol",
    "shares": "shares", "sharesquantity": "shares", "qty": "shares", "quantity": "shares",
    "market_value": "market_value", "marketvalue": "market_value",
    "market_value_$": "market_value", "marketvalue($)": "market_value",
    "weight": "weight", "portfolio_weight": "weight", "portfolioweight": "weight",
    "weight_percent": "weight", "weight_%": "weight",
}


def _parse_date(text: str) -> Optional[str]:
    for pat, fmt in [
        (r"([A-Za-z]+ \d{1,2}, \d{4})", "%B %d, %Y"),
        (r"(\d{1,2}/\d{1,2}/\d{4})", "%m/%d/%Y"),
        (r"(\d{4}-\d{2}-\d{2})", "%Y-%m-%d"),
        (r"(\d{1,2}-[A-Za-z]{3}-\d{4})", "%d-%b-%Y"),
    ]:
        m = re.search(pat, text, flags=re.I)
        if m:
            try:
                return datetime.strptime(m.group(1), fmt).date().isoformat()
            except ValueError:
                continue
    return None


def _parse_csv(raw_bytes: bytes) -> tuple[list[dict], str]:
    text = raw_bytes.decode("utf-8", errors="replace").replace("\r\n", "\n").replace("\r", "\n")
    lines = [ln.lstrip("\ufeff") for ln in text.split("\n")]

    # Find header row
    header_idx = None
    for i, ln in enumerate(lines[:200]):
        low = ln.lower()
        cols = [c.strip() for c in ln.split(",")]
        if (
            "ticker" in low
            and len(cols) >= 4
            and any(k in low for k in ["name", "security", "sedol", "weight", "market", "shares"])
            and not ("ticker symbol" in low and len(cols) < 4)
        ):
            header_idx = i
            break

    if header_idx is None:
        raise ValueError("IVES: header row not found in CSV")

    # Extract as-of date from preamble
    preamble = "\n".join(lines[:header_idx])
    as_of_date = _parse_date(preamble) or ""

    # Parse CSV from header onwards
    table_text = "\n".join(lines[header_idx:])
    reader = csv.DictReader(io.StringIO(table_text))

    # Normalize column names
    raw_cols = reader.fieldnames or []
    col_map = {}
    for c in raw_cols:
        normalized = c.strip().lower().replace('"', "").replace(" ", "_")
        canonical = _COL_ALIASES.get(normalized)
        if canonical:
            col_map[c] = canonical

    holdings = []
    for row in reader:
        # Remap keys
        r = {col_map.get(k, k.strip().lower()): (v or "").strip() for k, v in row.items()}

        name = r.get("name", "")
        ticker = r.get("ticker", "") or None
        shares = parse_number(r.get("shares", ""))
        weight = parse_number(r.get("weight", ""))
        market_value = parse_number(r.get("market_value", ""))

        # Skip footer/empty rows
        if not name or re.match(r"(?i)disclosure|notes?|important|information|summary|as of", name):
            continue
        if shares is None and weight is None and market_value is None:
            continue

        holdings.append({
            "security_name": name,
            "security_ticker": ticker,
            "shares": shares,
            "portfolio_weight": weight,
            "market_value": market_value,
            "holding_key": normalize_key(ticker, name),
        })

    return holdings, as_of_date


class IVESConnector(Connector):
    fund_name = "Dan Ives Wedbush AI Revolution ETF"
    fund_ticker = "IVES"

    def fetch_raw(self) -> Any:
        try:
            resp = retry_get(CSV_URL)
            return {"source": "csv", "data": resp.content, "url": CSV_URL}
        except Exception as e:
            logger.warning("IVES CSV fetch failed, falling back to EDGAR N-PORT: %s", e)
            filing = edgar.get_latest_nport(CIK)
            if not filing:
                raise RuntimeError("IVES: No N-PORT filing found on EDGAR")
            xml_bytes = edgar.fetch_nport_xml(CIK, filing)
            return {
                "source": "edgar_nport",
                "xml": xml_bytes,
                "filing": filing,
                "url": f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={CIK}&type=N-PORT",
            }

    def parse_holdings(self, raw: Any) -> tuple[list[dict], str, str]:
        if raw["source"] == "csv":
            holdings, as_of_date = _parse_csv(raw["data"])
            if not holdings:
                raise RuntimeError("IVES: Could not parse holdings from CSV")
            return holdings, as_of_date, raw["url"]
        else:
            holdings = edgar.parse_nport_xml(raw["xml"])
            as_of_date = raw["filing"].get("report_date", raw["filing"].get("filing_date", ""))
            return holdings, as_of_date, raw["url"]
