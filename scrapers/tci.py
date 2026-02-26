"""TCI Fund Management connector — quarterly 13F-HR filings."""

import logging
from typing import Any

import scrapers.edgar as edgar
import scrapers.utils as scraper_utils
from scrapers.base import Connector

logger = logging.getLogger(__name__)

CIK = "1647251"


class TCIConnector(Connector):
    fund_name = "TCI Fund Management"
    fund_ticker = "TCI"

    def fetch_raw(self) -> Any:
        filing = edgar.get_latest_13f(CIK)
        if not filing:
            raise RuntimeError("TCI: No 13F-HR filing found on EDGAR")
        xml_text = edgar.fetch_13f_xml(CIK, filing)
        return {
            "source": "edgar_13f",
            "xml": xml_text,
            "filing": filing,
            "url": (
                f"https://www.sec.gov/cgi-bin/browse-edgar?"
                f"action=getcompany&CIK={CIK}&type=13F-HR"
            ),
        }

    def parse_holdings(self, raw: Any) -> tuple[list[dict], str, str]:
        holdings = edgar.parse_13f_xml(raw["xml"])

        # Enrich missing tickers via OpenFIGI CUSIP lookup
        cusips = [h["cusip"] for h in holdings if h.get("cusip") and not h.get("security_ticker")]
        if cusips:
            ticker_map = scraper_utils.cusip_to_tickers(cusips)
            for h in holdings:
                if not h.get("security_ticker") and h.get("cusip") in ticker_map:
                    h["security_ticker"] = ticker_map[h["cusip"]]
            logger.info("TCI: resolved %d/%d tickers via OpenFIGI", len(ticker_map), len(cusips))

        # Fallback for CUSIPs OpenFIGI can't resolve (e.g. non-US CUSIPs)
        CUSIP_FALLBACK = {
            "N3168P101": "FERR",  # Ferrovial SE (non-US CUSIP, listed on Nasdaq)
        }
        for h in holdings:
            if not h.get("security_ticker") and h.get("cusip") in CUSIP_FALLBACK:
                h["security_ticker"] = CUSIP_FALLBACK[h["cusip"]]

        # 13F report date is the quarter-end date
        as_of_date = raw["filing"].get("report_date", raw["filing"].get("filing_date", ""))
        return holdings, as_of_date, raw["url"]
