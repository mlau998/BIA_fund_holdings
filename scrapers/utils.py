"""Shared utilities for BIA fund scrapers."""

import re
import time
import logging
from typing import Optional

import requests

logger = logging.getLogger(__name__)

USER_AGENT = "HoldingsScraper/0.1 (+research use)"


def parse_number(s: str) -> Optional[float]:
    """Parse a string like '$1,234.56', '(1234)', '5.23%' into a float."""
    if not s:
        return None
    s = str(s).strip()
    # Remove currency symbols, commas, percent signs
    s = s.replace("$", "").replace(",", "").replace("%", "").strip()
    # Handle parentheses as negative: (1234) -> -1234
    if s.startswith("(") and s.endswith(")"):
        s = "-" + s[1:-1]
    try:
        return float(s)
    except ValueError:
        return None


def normalize_key(ticker: Optional[str], name: str) -> str:
    """Derive a canonical holding key from ticker or name."""
    if ticker and ticker.strip():
        return ticker.strip().upper()
    return re.sub(r"\s+", " ", name.strip().upper())


OPENFIGI_URL = "https://api.openfigi.com/v3/mapping"
_US_EXCH_CODES = {"US", "UN", "UQ", "UW", "UA", "UR", "UP", "UU"}


def cusip_to_tickers(cusips: list[str]) -> dict[str, str]:
    """Look up exchange tickers for a list of CUSIPs via the OpenFIGI API.

    Returns a dict mapping CUSIP -> ticker (US listing preferred).
    CUSIPs with no match are omitted. No API key required for basic use.
    """
    if not cusips:
        return {}

    result: dict[str, str] = {}
    for i in range(0, len(cusips), 10):  # max 10 jobs per unauthenticated request
        batch = cusips[i : i + 10]
        payload = [{"idType": "ID_CUSIP", "idValue": c} for c in batch]
        try:
            resp = requests.post(
                OPENFIGI_URL,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            logger.warning("OpenFIGI CUSIP lookup failed: %s", e)
            continue

        for cusip, item in zip(batch, data):
            if "data" not in item:
                continue
            # Prefer US-listed equity
            candidates = [
                d for d in item["data"]
                if d.get("marketSector") == "Equity"
                and d.get("exchCode") in _US_EXCH_CODES
                and d.get("ticker")
            ]
            if not candidates:
                candidates = [
                    d for d in item["data"]
                    if d.get("marketSector") == "Equity" and d.get("ticker")
                ]
            if candidates:
                result[cusip] = candidates[0]["ticker"]

        if i + 10 < len(cusips):
            time.sleep(1)  # stay well under 25 req/min unauthenticated limit

    return result


def retry_get(
    url: str,
    max_retries: int = 3,
    timeout: int = 30,
    headers: Optional[dict] = None,
    **kwargs,
) -> requests.Response:
    """GET request with exponential backoff retry. Does not retry on 4xx errors."""
    base_headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json, text/plain, */*",
        "Connection": "close",
    }
    if headers:
        base_headers.update(headers)

    delay = 1.0
    last_exc: Optional[Exception] = None
    for attempt in range(max_retries):
        try:
            resp = requests.get(url, headers=base_headers, timeout=timeout, **kwargs)
            resp.raise_for_status()
            return resp
        except requests.HTTPError as e:
            # Don't retry client errors (4xx) — they won't resolve on retry
            if e.response is not None and e.response.status_code < 500:
                raise RuntimeError(f"Failed to GET {url}: {e}") from e
            last_exc = e
        except requests.RequestException as e:
            last_exc = e
        if attempt < max_retries - 1:
            logger.warning("Retry %d/%d for %s: %s", attempt + 1, max_retries, url, last_exc)
            time.sleep(delay)
            delay *= 2
    raise RuntimeError(f"Failed to GET {url} after {max_retries} retries: {last_exc}")
