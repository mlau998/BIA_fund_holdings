"""Abstract base class for fund data connectors."""

import logging
from abc import ABC, abstractmethod
from typing import Any, Optional

logger = logging.getLogger(__name__)


class Connector(ABC):
    fund_name: str
    fund_ticker: str

    @abstractmethod
    def fetch_raw(self) -> Any:
        """Fetch raw data from primary source with retries."""

    @abstractmethod
    def parse_holdings(self, raw: Any) -> tuple[list[dict], str, str]:
        """
        Parse raw data into holdings.

        Returns:
            (holdings, as_of_date, source_url)
            holdings: list of dicts with keys from HoldingRecord
            as_of_date: YYYY-MM-DD string
            source_url: URL where data was fetched from
        """

    def validate_snapshot(
        self,
        holdings: list[dict],
        prev_holdings: Optional[list[dict]] = None,
    ) -> list[dict]:
        """
        Validate a holdings list and return a list of warning/error dicts.

        Each warning: {"level": "error"|"warning", "message": "..."}
        """
        warnings = []

        # Error: 0 holdings
        if len(holdings) == 0:
            warnings.append({"level": "error", "message": "Scrape returned 0 holdings"})
            return warnings

        # Warning: holding count changed by >60% vs previous snapshot
        if prev_holdings and len(prev_holdings) > 0:
            change_ratio = abs(len(holdings) - len(prev_holdings)) / len(prev_holdings)
            if change_ratio > 0.60:
                warnings.append({
                    "level": "warning",
                    "message": (
                        f"Holding count changed by {change_ratio:.0%}: "
                        f"{len(prev_holdings)} → {len(holdings)}"
                    ),
                })

        # Warning: <50% of holdings have a ticker (when previously >80% did)
        ticker_coverage = sum(
            1 for h in holdings if h.get("security_ticker")
        ) / len(holdings)
        if ticker_coverage < 0.50:
            prev_coverage = None
            if prev_holdings and len(prev_holdings) > 0:
                prev_coverage = sum(
                    1 for h in prev_holdings if h.get("security_ticker")
                ) / len(prev_holdings)
            if prev_coverage is None or prev_coverage > 0.80:
                warnings.append({
                    "level": "warning",
                    "message": (
                        f"Low ticker coverage: only {ticker_coverage:.0%} of holdings have tickers"
                    ),
                })

        # Warning: required numeric fields missing for >80% of holdings
        for field in ("portfolio_weight", "market_value"):
            missing = sum(1 for h in holdings if h.get(field) is None)
            if missing / len(holdings) > 0.80:
                warnings.append({
                    "level": "warning",
                    "message": f"Field '{field}' missing for {missing}/{len(holdings)} holdings",
                })

        return warnings
