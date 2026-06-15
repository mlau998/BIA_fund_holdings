"""All fund connectors. Fetches fund list from Upstash Redis (KV) at runtime so new
funds added via the admin UI are picked up automatically without code changes.

To add a new fund: use the /admin page on the deployed app.
To add locally for testing: add an entry to STATIC_FUNDS below.
"""

import json
import logging
import os
from typing import Any

import requests

import scrapers.edgar as edgar
from scrapers.base import Connector
from scrapers.edgar import NPortConnector, ThirteenFConnector

logger = logging.getLogger(__name__)

# ─── Static fallback (used when KV is unavailable) ────────────────────────────

STATIC_FUNDS = [
    {"ticker": "TCI",  "name": "TCI Fund Management",                   "cik": "1647251", "series_id": None,          "form_type": "13F-HR"},
    {"ticker": "MPLY", "name": "Monopoly ETF",                           "cik": "1506213", "series_id": "S000092393",  "form_type": "N-PORT"},
    {"ticker": "IVES", "name": "Dan Ives Wedbush AI Revolution ETF",     "cik": "2055464", "series_id": "S000091902",  "form_type": "N-PORT"},
    {"ticker": "GRNY", "name": "Fundstrat Granny Shots US Large Cap ETF","cik": "1722388", "series_id": "S000088227",  "form_type": "N-PORT"},
]

# TCI-specific CUSIP fallbacks (non-US CUSIPs that OpenFIGI can't resolve)
_TCI_CUSIP_FALLBACK = {
    "N3168P101": "FERR",
}

# MPLY: non-US CUSIPs (N=Netherlands, G=Ireland) OpenFIGI won't resolve
_MPLY_CUSIP_FALLBACK = {
    "N07059210": "ASML",
    "G0403H108": "AON",
    "G54950103": "LIN",
}

# IVES: placeholder CUSIPs (000000000) — match by name instead
_IVES_NAME_FALLBACK = {
    "NEBIUS GROUP NV": "NBIS",
    "IREN LTD": "IREN",
}

# GRNY: N/A CUSIPs for foreign-domiciled holdings — match by name
_GRNY_NAME_FALLBACK = {
    "EATON CORP PLC": "ETN",
    "GARMIN LTD": "GRMN",
    "WILLIS TOWERS WATSON PLC": "WTW",
}


# ─── KV fetch ─────────────────────────────────────────────────────────────────

def _fetch_funds_from_kv() -> list[dict]:
    """Fetch fund configs from Upstash Redis REST API."""
    url = os.environ.get("KV_REST_API_URL")
    token = os.environ.get("KV_REST_API_TOKEN")
    if not url or not token:
        logger.warning("KV_REST_API_URL/TOKEN not set — using static fund list")
        return []
    try:
        resp = requests.get(
            f"{url}/get/funds:config",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        resp.raise_for_status()
        result = resp.json().get("result")
        if result:
            funds = json.loads(result) if isinstance(result, str) else result
            logger.info("Loaded %d funds from KV", len(funds))
            return funds
    except Exception as e:
        logger.warning("KV fetch failed, using static fund list: %s", e)
    return []


# ─── Connector factory ────────────────────────────────────────────────────────

def _make_connector(config: dict) -> Connector:
    ticker = config["ticker"].upper()
    fund_name = config.get("name", ticker)
    cik = config["cik"].lstrip("0") or config["cik"]
    series_id = config.get("series_id") or None
    form_type = config.get("form_type", "N-PORT")

    _NPORT_CUSIP = {"MPLY": _MPLY_CUSIP_FALLBACK}
    _NPORT_NAME  = {"IVES": _IVES_NAME_FALLBACK, "GRNY": _GRNY_NAME_FALLBACK}

    if form_type == "N-PORT":
        cls = type(f"{ticker}Connector", (NPortConnector,), {
            "fund_name": fund_name,
            "fund_ticker": ticker,
            "cik": cik,
            "series_id": series_id,
            "CUSIP_FALLBACK": {**_NPORT_CUSIP.get(ticker, {}), **config.get("cusip_fallback", {})},
            "NAME_FALLBACK":  {**_NPORT_NAME.get(ticker, {}),  **config.get("name_fallback", {})},
        })
        return cls()

    if form_type == "13F-HR":
        cusip_fallback = config.get("cusip_fallback", {})
        if ticker == "TCI":
            cusip_fallback = {**_TCI_CUSIP_FALLBACK, **cusip_fallback}
        cls = type(f"{ticker}Connector", (ThirteenFConnector,), {
            "fund_name": fund_name,
            "fund_ticker": ticker,
            "CIK": cik,
            "CUSIP_FALLBACK": cusip_fallback,
        })
        return cls()

    raise ValueError(f"Unknown form_type '{form_type}' for fund {ticker}")


def get_connectors() -> list[Connector]:
    """Return a connector instance for every fund in KV (falling back to static list)."""
    funds = _fetch_funds_from_kv() or STATIC_FUNDS
    connectors = []
    for config in funds:
        try:
            connectors.append(_make_connector(config))
        except Exception as e:
            logger.error("Failed to create connector for %s: %s", config.get("ticker"), e)
    return connectors


# ─── Named connector classes (for direct import / backward compat) ─────────────

class TCIConnector(ThirteenFConnector):
    fund_name = "TCI Fund Management"
    fund_ticker = "TCI"
    CIK = "1647251"
    CUSIP_FALLBACK = _TCI_CUSIP_FALLBACK


class MPLYConnector(NPortConnector):
    fund_name = "Monopoly ETF"
    fund_ticker = "MPLY"
    cik = "1506213"
    series_id = "S000092393"
    CUSIP_FALLBACK = _MPLY_CUSIP_FALLBACK


class IVESConnector(NPortConnector):
    fund_name = "Dan Ives Wedbush AI Revolution ETF"
    fund_ticker = "IVES"
    cik = "2055464"
    series_id = "S000091902"
    NAME_FALLBACK = _IVES_NAME_FALLBACK


class GRNYConnector(NPortConnector):
    fund_name = "Fundstrat Granny Shots US Large Cap ETF"
    fund_ticker = "GRNY"
    cik = "1722388"
    series_id = "S000088227"
    NAME_FALLBACK = _GRNY_NAME_FALLBACK


# ─── Old connector files (commented out, kept for reference) ───────────────────
# tci.py, mply.py, ives.py, grny.py — all commented out, see those files
