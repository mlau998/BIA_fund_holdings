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
