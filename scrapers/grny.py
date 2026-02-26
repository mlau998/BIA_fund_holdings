"""GRNY (Fundstrat Granny Shots US Large Cap ETF) connector."""

import logging
from typing import Any

from bs4 import BeautifulSoup

import scrapers.edgar as edgar
from scrapers.base import Connector
from scrapers.utils import parse_number, normalize_key, retry_get

logger = logging.getLogger(__name__)

PRIMARY_URL = "https://grannyshots.com/holdings/"
CIK = "1722388"


class GRNYConnector(Connector):
    fund_name = "Fundstrat Granny Shots US Large Cap ETF"
    fund_ticker = "GRNY"

    def fetch_raw(self) -> Any:
        try:
            resp = retry_get(PRIMARY_URL)
            return {"source": "website", "html": resp.text, "url": PRIMARY_URL}
        except Exception as e:
            logger.warning("GRNY website fetch failed, falling back to EDGAR N-PORT: %s", e)
            filing = edgar.get_latest_nport(CIK)
            if not filing:
                raise RuntimeError("GRNY: No N-PORT filing found on EDGAR")
            xml_text = edgar.fetch_nport_xml(CIK, filing)
            return {
                "source": "edgar_nport",
                "xml": xml_text,
                "filing": filing,
                "url": f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={CIK}&type=N-PORT",
            }

    def parse_holdings(self, raw: Any) -> tuple[list[dict], str, str]:
        if raw["source"] == "website":
            return self._parse_website(raw["html"], raw["url"])
        else:
            holdings = edgar.parse_nport_xml(raw["xml"])
            as_of_date = raw["filing"].get("report_date", raw["filing"].get("filing_date", ""))
            return holdings, as_of_date, raw["url"]

    def _parse_website(self, html: str, url: str) -> tuple[list[dict], str, str]:
        soup = BeautifulSoup(html, "lxml")
        holdings = []
        as_of_date = ""

        # Try to find the as_of_date in the page
        for tag in soup.find_all(["p", "span", "div", "h2", "h3"]):
            text = tag.get_text(strip=True)
            if "as of" in text.lower():
                import re
                m = re.search(r"(\d{4}-\d{2}-\d{2})", text)
                if m:
                    as_of_date = m.group(1)
                    break
                m = re.search(r"(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})", text)
                if m:
                    mo, d, yr = m.groups()
                    if len(yr) == 2:
                        yr = "20" + yr
                    as_of_date = f"{yr}-{mo.zfill(2)}-{d.zfill(2)}"
                    break

        # Find the holdings table
        table = soup.find("table")
        if not table:
            raise RuntimeError("GRNY: No table found on holdings page")

        rows = table.find_all("tr")
        if len(rows) < 2:
            raise RuntimeError("GRNY: Holdings table has no data rows")

        # Determine column indices from header
        header_row = rows[0]
        headers = [th.get_text(strip=True).lower() for th in header_row.find_all(["th", "td"])]

        col_map = {}
        for i, h in enumerate(headers):
            if "name" in h or "security" in h or "holding" in h:
                col_map.setdefault("name", i)
            if "ticker" in h or "symbol" in h:
                col_map["ticker"] = i
            if "share" in h and "weight" not in h:
                col_map["shares"] = i
            if "sector" in h:
                col_map["sector"] = i
            if ("price" in h or "last" in h) and "chg" not in h and "change" not in h and "%" not in h:
                col_map.setdefault("last_price", i)
            if ("chg" in h or "change" in h or "ch%" in h) and "%" in h:
                col_map["market_price_change"] = i
            elif "weight" in h or ("%" in h and "chg" not in h and "change" not in h and "price" not in h):
                col_map.setdefault("weight", i)
            if ("value" in h or "market" in h) and "%" not in h and "chg" not in h and "change" not in h:
                col_map.setdefault("value", i)

        for row in rows[1:]:
            cells = row.find_all(["td", "th"])
            if not cells:
                continue
            texts = [c.get_text(strip=True) for c in cells]

            def get_col(key):
                idx = col_map.get(key)
                if idx is not None and idx < len(texts):
                    return texts[idx]
                return ""

            name = get_col("name")
            ticker = get_col("ticker")
            shares = parse_number(get_col("shares"))
            weight = parse_number(get_col("weight"))
            value = parse_number(get_col("value"))

            if not name:
                continue

            holdings.append({
                "security_name": name,
                "security_ticker": ticker or None,
                "shares": shares,
                "portfolio_weight": weight,
                "market_value": value,
                "sector": get_col("sector") or None,
                "last_price": parse_number(get_col("last_price")),
                "market_price_change": parse_number(get_col("market_price_change")),
                "holding_key": normalize_key(ticker, name),
            })

        return holdings, as_of_date, url
