"""Entry point: runs all fund scrapers and writes snapshot files."""

import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Allow running from project root
sys.path.insert(0, str(Path(__file__).parent.parent))

from scrapers.grny import GRNYConnector
from scrapers.ives import IVESConnector
from scrapers.mply import MPLYConnector
from scrapers.tci import TCIConnector

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

SNAPSHOTS_DIR = Path(__file__).parent.parent / "data" / "snapshots"


def read_prev_holdings(ticker: str, as_of_date: str) -> list[dict]:
    """Load the most recent snapshot before as_of_date, if any."""
    ticker_dir = SNAPSHOTS_DIR / ticker
    if not ticker_dir.exists():
        return []
    dates = sorted(
        [f.stem for f in ticker_dir.glob("*.json") if f.stem != as_of_date],
        reverse=True,
    )
    if not dates:
        return []
    prev_file = ticker_dir / f"{dates[0]}.json"
    try:
        with open(prev_file) as f:
            data = json.load(f)
        return data.get("holdings", [])
    except Exception:
        return []


def write_snapshot(
    ticker: str,
    fund_name: str,
    as_of_date: str,
    holdings: list[dict],
    warnings: list[dict],
    source: str,
    source_url: str,
) -> Path:
    ticker_dir = SNAPSHOTS_DIR / ticker
    ticker_dir.mkdir(parents=True, exist_ok=True)

    if not as_of_date:
        as_of_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    snapshot = {
        "fund_name": fund_name,
        "fund_ticker": ticker,
        "as_of_date": as_of_date,
        "source": source,
        "source_url": source_url,
        "scrape_timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "warnings": warnings,
        "holdings": holdings,
    }

    out_path = ticker_dir / f"{as_of_date}.json"
    with open(out_path, "w") as f:
        json.dump(snapshot, f, indent=2, default=str)
    logger.info("Wrote %d holdings to %s", len(holdings), out_path)
    return out_path


def write_error_snapshot(ticker: str, error_message: str) -> Path:
    ticker_dir = SNAPSHOTS_DIR / ticker
    ticker_dir.mkdir(parents=True, exist_ok=True)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    error_snap = {
        "error": True,
        "error_message": error_message,
        "fund_ticker": ticker,
        "scrape_timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }

    out_path = ticker_dir / f"{today}.json"
    with open(out_path, "w") as f:
        json.dump(error_snap, f, indent=2)
    logger.error("Wrote error snapshot for %s: %s", ticker, error_message)
    return out_path


def run_connector(connector) -> bool:
    ticker = connector.fund_ticker
    logger.info("=== Running %s connector ===", ticker)
    try:
        raw = connector.fetch_raw()
        holdings, as_of_date, source_url = connector.parse_holdings(raw)

        source = raw.get("source", "unknown")
        prev_holdings = read_prev_holdings(ticker, as_of_date)
        warnings = connector.validate_snapshot(holdings, prev_holdings or None)

        write_snapshot(
            ticker=ticker,
            fund_name=connector.fund_name,
            as_of_date=as_of_date,
            holdings=holdings,
            warnings=warnings,
            source=source,
            source_url=source_url,
        )

        if warnings:
            for w in warnings:
                logger.warning("[%s] %s: %s", ticker, w["level"].upper(), w["message"])

        return True
    except Exception as e:
        logger.exception("Failed to scrape %s: %s", ticker, e)
        write_error_snapshot(ticker, str(e))
        return False


def main():
    connectors = [
        GRNYConnector(),
        IVESConnector(),
        MPLYConnector(),
        TCIConnector(),
    ]

    results = {}
    for connector in connectors:
        success = run_connector(connector)
        results[connector.fund_ticker] = "OK" if success else "FAILED"

    print("\n=== Scrape Summary ===")
    for ticker, status in results.items():
        print(f"  {ticker}: {status}")

    failed = [t for t, s in results.items() if s == "FAILED"]
    if failed:
        print(f"\nFailed funds: {', '.join(failed)}")
        sys.exit(1)
    else:
        print("\nAll funds scraped successfully.")


if __name__ == "__main__":
    main()
