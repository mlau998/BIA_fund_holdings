"""MPLY (Monopoly ETF) connector."""

import csv
import io
import logging
import re
from typing import Any

import scrapers.edgar as edgar
from scrapers.base import Connector
from scrapers.utils import parse_number, normalize_key, retry_get

logger = logging.getLogger(__name__)

PRIMARY_URL = "https://strategysharesetfs.com/feeds/STRATEGYSHARES_STRATEGYSHARESMPLY_ETF_TOPHOLDINGS.CSV"
# CIK to be discovered via EDGAR company search if needed
EDGAR_SEARCH_URL = "https://efts.sec.gov/LATEST/search-index?q=%22MPLY%22&dateRange=custom&startdt=2023-01-01&forms=N-PORT"
COMPANY_SEARCH_URL = "https://efts.sec.gov/LATEST/search-index?q=%22Monopoly+ETF%22&forms=N-PORT"


def _find_mply_cik() -> str | None:
    """Try to find MPLY CIK via EDGAR company search."""
    try:
        resp = retry_get(
            "https://efts.sec.gov/LATEST/search-index?q=%22Monopoly+ETF%22&forms=N-PORT",
            headers={"Accept": "application/json"},
        )
        data = resp.json()
        hits = data.get("hits", {}).get("hits", [])
        if hits:
            entity_id = hits[0].get("_source", {}).get("entity_id")
            if entity_id:
                return str(entity_id)
    except Exception as e:
        logger.warning("Could not find MPLY CIK via EDGAR search: %s", e)
    return None


class MPLYConnector(Connector):
    fund_name = "Monopoly ETF"
    fund_ticker = "MPLY"

    def fetch_raw(self) -> Any:
        try:
            resp = retry_get(PRIMARY_URL)
            return {"source": "csv", "csv": resp.text, "url": PRIMARY_URL}
        except Exception as e:
            logger.warning("MPLY website fetch failed, falling back to EDGAR N-PORT: %s", e)
            cik = _find_mply_cik()
            if not cik:
                raise RuntimeError("MPLY: Could not determine CIK for EDGAR fallback")
            filing = edgar.get_latest_nport(cik)
            if not filing:
                raise RuntimeError(f"MPLY: No N-PORT filing found on EDGAR for CIK={cik}")
            xml_text = edgar.fetch_nport_xml(cik, filing)
            return {
                "source": "edgar_nport",
                "xml": xml_text,
                "filing": filing,
                "cik": cik,
                "url": f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type=N-PORT",
            }

    def parse_holdings(self, raw: Any) -> tuple[list[dict], str, str]:
        if raw["source"] == "csv":
            return self._parse_csv(raw["csv"], raw["url"])
        else:
            holdings = edgar.parse_nport_xml(raw["xml"])
            as_of_date = raw["filing"].get("report_date", raw["filing"].get("filing_date", ""))
            return holdings, as_of_date, raw["url"]

    def _parse_csv(self, csv_text: str, url: str) -> tuple[list[dict], str, str]:
        holdings = []
        as_of_date = ""

        # Strip BOM if present
        csv_text = csv_text.lstrip("\ufeff")

        # Scan non-data lines for an as-of date before the header row
        lines = csv_text.splitlines()
        data_start = 0
        for i, line in enumerate(lines):
            m = re.search(r"(\d{4}-\d{2}-\d{2})", line)
            if m:
                as_of_date = m.group(1)
                continue
            m = re.search(r"(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})", line)
            if m:
                mo, d, yr = m.groups()
                if len(yr) == 2:
                    yr = "20" + yr
                as_of_date = f"{yr}-{mo.zfill(2)}-{d.zfill(2)}"
                continue
            # Stop at first line that looks like a header (contains a comma)
            if "," in line:
                data_start = i
                break

        reader = csv.DictReader(io.StringIO("\n".join(lines[data_start:])))

        col_map = {}
        if reader.fieldnames:
            # Pass 1: exact normalized name match
            normalized_map = {(f or "").strip().replace(" ", "").lower(): f for f in reader.fieldnames}
            exact_map = {
                "name":               normalized_map.get("holdingname"),
                "ticker":             normalized_map.get("ticker"),
                "weight":             normalized_map.get("marketvalue%"),
                "value":              normalized_map.get("marketvalue"),
                "shares":             normalized_map.get("sharesquantity"),
                "asset_group":        normalized_map.get("assetgroup"),
                "notional_value_pct": normalized_map.get("notionalvalue%"),
                "notional_value":     normalized_map.get("notionalvalue"),
                "date":               normalized_map.get("effectivedate"),
            }
            col_map = {k: v for k, v in exact_map.items() if v is not None}

            # Pass 2: keyword fallback for any still-unmapped fields
            for raw_col in reader.fieldnames:
                h = (raw_col or "").strip().lower()
                if not col_map.get("name") and ("name" in h or "security" in h or "holding" in h or "description" in h):
                    col_map["name"] = raw_col
                if not col_map.get("ticker") and ("ticker" in h or "symbol" in h):
                    col_map["ticker"] = raw_col
                if not col_map.get("shares") and "share" in h and "weight" not in h:
                    col_map["shares"] = raw_col
                if not col_map.get("weight") and ("weight" in h or ("%" in h)):
                    col_map.setdefault("weight", raw_col)
                if not col_map.get("value") and ("value" in h or "market" in h or "notional" in h):
                    col_map.setdefault("value", raw_col)
                if not col_map.get("date") and "date" in h and not as_of_date:
                    col_map["date"] = raw_col

        def get_field(row, key):
            col = col_map.get(key)
            return row.get(col, "").strip() if col else ""

        for row in reader:
            name = get_field(row, "name")
            if not name:
                continue

            # Pick up date from a column if we haven't found one yet
            if not as_of_date and col_map.get("date"):
                raw_date = get_field(row, "date")
                m = re.search(r"(\d{4}-\d{2}-\d{2})", raw_date)
                if m:
                    as_of_date = m.group(1)
                else:
                    m = re.search(r"(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})", raw_date)
                    if m:
                        mo, d, yr = m.groups()
                        if len(yr) == 2:
                            yr = "20" + yr
                        as_of_date = f"{yr}-{mo.zfill(2)}-{d.zfill(2)}"

            ticker = get_field(row, "ticker")
            shares = parse_number(get_field(row, "shares"))
            weight = parse_number(get_field(row, "weight"))
            value = parse_number(get_field(row, "value"))

            holdings.append({
                "security_name": name,
                "security_ticker": ticker or None,
                "shares": shares,
                "portfolio_weight": weight,
                "market_value": value,
                "effective_date": get_field(row, "date") or None,
                "asset_group": get_field(row, "asset_group") or None,
                "notional_value_pct": parse_number(get_field(row, "notional_value_pct")),
                "notional_value": parse_number(get_field(row, "notional_value")),
                "holding_key": normalize_key(ticker, name),
            })

        return holdings, as_of_date, url
