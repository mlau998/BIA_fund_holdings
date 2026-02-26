"""SEC EDGAR utilities: N-PORT and 13F-HR fetching and parsing."""

import logging
from typing import Optional
from urllib.parse import urljoin

from lxml import etree

from scrapers.utils import retry_get, parse_number, normalize_key

logger = logging.getLogger(__name__)

EDGAR_BASE = "https://data.sec.gov"
EDGAR_SUBMISSIONS = "https://data.sec.gov/submissions/CIK{cik:010d}.json"
EDGAR_FILING_URL = "https://www.sec.gov/Archives/edgar/data/{cik_digits}/{accession_nodash}/index.json"


def _submissions_json(cik: str) -> dict:
    url = EDGAR_SUBMISSIONS.format(cik=int(cik))
    resp = retry_get(url, headers={"Accept": "application/json"})
    return resp.json()


def _find_latest_filing(cik: str, form_type: str) -> Optional[dict]:
    """Return accession number, report date, and primary doc for newest filing of given form type."""
    data = _submissions_json(cik)
    filings = data.get("filings", {}).get("recent", {})
    forms = filings.get("form", [])
    accessions = filings.get("accessionNumber", [])
    dates = filings.get("filingDate", [])
    report_dates = filings.get("reportDate", [])
    primary_docs = filings.get("primaryDocument", [])

    for i, form in enumerate(forms):
        if form == form_type:
            return {
                "accession": accessions[i],
                "filing_date": dates[i],
                "report_date": report_dates[i] if i < len(report_dates) else dates[i],
                "primary_doc": primary_docs[i] if i < len(primary_docs) else "",
            }
    return None


def _accession_to_path(accession: str) -> str:
    return accession.replace("-", "")


def _fetch_filing_index(cik: str, accession: str) -> dict:
    """Fetch the filing index JSON to list documents."""
    acc_path = _accession_to_path(accession)
    url = f"{EDGAR_BASE}/Archives/edgar/full-index/.../{accession}-index.json"
    # Use the submissions API to get doc list
    clean = accession.replace("-", "")
    cik_padded = f"{int(cik):010d}"
    url = f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik_padded}&type={''}&dateb=&owner=include&count=40&search_text="
    # Direct index approach
    index_url = f"https://www.sec.gov/Archives/edgar/full-index/..."
    # Use the known JSON index endpoint
    index_url = f"https://data.sec.gov/submissions/CIK{int(cik):010d}.json"
    resp = retry_get(index_url, headers={"Accept": "application/json"})
    return resp.json()


def _fetch_xml_for_filing(cik: str, accession: str, doc_name: str) -> bytes:
    """Fetch XML document for a given filing."""
    clean = accession.replace("-", "")
    cik_int = int(cik)
    url = f"https://www.sec.gov/Archives/edgar/data/{cik_int}/{clean}/{doc_name}"
    resp = retry_get(url)
    return resp.content


def _list_filing_docs(cik: str, accession: str) -> list[dict]:
    """List documents in a filing using the EDGAR index JSON."""
    clean = accession.replace("-", "")
    cik_int = int(cik)
    index_url = f"https://www.sec.gov/Archives/edgar/data/{cik_int}/{clean}/index.json"
    try:
        resp = retry_get(index_url, headers={"Accept": "application/json"})
        data = resp.json()
        return data.get("directory", {}).get("item", [])
    except Exception:
        return []


# ─── N-PORT ────────────────────────────────────────────────────────────────────

NPORT_NS = {
    "": "http://www.sec.gov/edgar/nport",
    "n": "http://www.sec.gov/edgar/nport",
}

def get_latest_nport(cik: str) -> Optional[dict]:
    """Return info about the latest N-PORT filing for a given CIK."""
    filing = _find_latest_filing(cik, "N-PORT")
    if not filing:
        filing = _find_latest_filing(cik, "N-PORT/A")
    return filing


def fetch_nport_xml(cik: str, filing: dict) -> bytes:
    """Fetch the primary N-PORT XML document."""
    accession = filing["accession"]
    primary_doc = filing.get("primary_doc", "")
    if primary_doc:
        return _fetch_xml_for_filing(cik, accession, primary_doc)
    # Try to find an XML file in the filing
    docs = _list_filing_docs(cik, accession)
    for doc in docs:
        name = doc.get("name", "")
        if name.endswith(".xml") and "primary" in name.lower():
            return _fetch_xml_for_filing(cik, accession, name)
    # Fallback: guess primary doc name
    clean = accession.replace("-", "")
    cik_padded = f"{int(cik):010d}"
    # Common naming pattern
    for suffix in ["primary_doc.xml", "form.xml", f"{clean}.xml"]:
        try:
            return _fetch_xml_for_filing(cik, accession, suffix)
        except Exception:
            continue
    raise RuntimeError(f"Cannot find N-PORT XML for CIK={cik}, accession={accession}")


def parse_nport_xml(xml_bytes: bytes) -> list[dict]:
    """Parse N-PORT XML and return list of holding dicts."""
    holdings = []
    try:
        root = etree.fromstring(xml_bytes)
    except etree.XMLSyntaxError as e:
        raise RuntimeError(f"Failed to parse N-PORT XML: {e}")

    def strip_ns(tag: str) -> str:
        return tag.split("}")[-1] if "}" in tag else tag

    def find_text(element, *tags) -> Optional[str]:
        for tag in tags:
            for child in element.iter():
                if strip_ns(child.tag) == tag:
                    return (child.text or "").strip() or None
        return None

    for elem in root.iter():
        if strip_ns(elem.tag) == "invstOrSec":
            name = find_text(elem, "name") or ""
            ticker = find_text(elem, "ticker")
            balance_str = find_text(elem, "balance")
            val_usd_str = find_text(elem, "valUSD")
            pct_val_str = find_text(elem, "pctVal")

            balance = parse_number(balance_str) if balance_str else None
            val_usd = parse_number(val_usd_str) if val_usd_str else None
            pct_val = parse_number(pct_val_str) if pct_val_str else None

            if name:
                holdings.append({
                    "security_name": name,
                    "security_ticker": ticker,
                    "shares": balance,
                    "market_value": val_usd,
                    "portfolio_weight": pct_val,
                    "holding_key": normalize_key(ticker, name),
                })

    return holdings


# ─── 13F-HR ────────────────────────────────────────────────────────────────────

def get_latest_13f(cik: str) -> Optional[dict]:
    """Return info about the latest 13F-HR filing for a given CIK."""
    filing = _find_latest_filing(cik, "13F-HR")
    if not filing:
        filing = _find_latest_filing(cik, "13F-HR/A")
    return filing


def fetch_13f_xml(cik: str, filing: dict) -> bytes:
    """Fetch the information table XML for a 13F filing."""
    accession = filing["accession"]
    docs = _list_filing_docs(cik, accession)

    xml_name = None
    for doc in docs:
        name = doc.get("name", "").lower()
        if name.endswith(".xml") and ("info" in name or "13f" in name):
            xml_name = doc["name"]
            break
    if not xml_name:
        for doc in docs:
            if doc.get("name", "").lower().endswith(".xml"):
                xml_name = doc["name"]
                break

    if xml_name:
        return _fetch_xml_for_filing(cik, accession, xml_name)

    raise RuntimeError(f"Cannot find 13F XML for CIK={cik}, accession={accession}")


def parse_13f_xml(xml_bytes: bytes) -> list[dict]:
    """Parse 13F-HR information table XML and return holding dicts with computed weights."""
    holdings = []
    try:
        root = etree.fromstring(xml_bytes)
    except etree.XMLSyntaxError as e:
        raise RuntimeError(f"Failed to parse 13F XML: {e}")

    def find_text(element, path) -> Optional[str]:
        node = element.find(path, namespaces=element.nsmap) if "{" in path else element.find(path)
        return node.text.strip() if node is not None and node.text else None

    raw = []
    total_value = 0.0

    for it in root.findall(".//{*}infoTable") + root.findall(".//infoTable"):
        name = find_text(it, ".//{*}nameOfIssuer") or find_text(it, "nameOfIssuer") or ""
        cusip = find_text(it, ".//{*}cusip") or find_text(it, "cusip") or ""
        value_str = find_text(it, ".//{*}value") or find_text(it, "value")
        shares_str = (
            find_text(it, ".//{*}shrsOrPrnAmt/{*}sshPrnamt")
            or find_text(it, "shrsOrPrnAmt/sshPrnamt")
        )

        value = (parse_number(value_str) or 0)  # convert to USD
        shares = parse_number(shares_str)

        if name:
            raw.append({
                "security_name": name,
                "security_ticker": None,  # 13F has CUSIP not ticker
                "cusip": cusip,
                "shares": shares,
                "market_value": value,
                "holding_key": cusip if cusip else normalize_key(None, name),
            })
            total_value += value

    for h in raw:
        if total_value > 0:
            h["portfolio_weight"] = round((h["market_value"] / total_value) * 100, 4)
        else:
            h["portfolio_weight"] = None
        holdings.append(h)

    return holdings
