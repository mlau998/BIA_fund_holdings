"""SEC EDGAR utilities: N-PORT and 13F-HR fetching and parsing."""

import logging
from typing import Any, Optional
from urllib.parse import urljoin

from lxml import etree

from scrapers.base import Connector
from scrapers.utils import retry_get, parse_number, normalize_key

logger = logging.getLogger(__name__)

EDGAR_BASE = "https://data.sec.gov"
EDGAR_SUBMISSIONS = "https://data.sec.gov/submissions/CIK{cik:010d}.json"
EDGAR_FILING_URL = "https://www.sec.gov/Archives/edgar/data/{cik_digits}/{accession_nodash}/index.json"


def _submissions_json(cik: str) -> dict:
    url = EDGAR_SUBMISSIONS.format(cik=int(cik))
    resp = retry_get(url, headers={"Accept": "application/json"})
    return resp.json()


def _find_latest_filing(cik: str, form_type: str, series_id: Optional[str] = None, skip: int = 0) -> Optional[dict]:
    """Return the (skip+1)-th most recent filing of the given form type.

    skip=0 → latest, skip=1 → previous. If series_id is provided, skips filings
    whose seriesId field doesn't match (only reliable for 13F-HR; N-PORT submissions
    JSON never populates seriesId, so use _find_nport_for_series for that case).
    """
    data = _submissions_json(cik)
    filings = data.get("filings", {}).get("recent", {})
    forms = filings.get("form", [])
    accessions = filings.get("accessionNumber", [])
    dates = filings.get("filingDate", [])
    report_dates = filings.get("reportDate", [])
    primary_docs = filings.get("primaryDocument", [])
    series_ids = filings.get("seriesId", [])

    found = 0
    for i, form in enumerate(forms):
        if form != form_type:
            continue
        if series_id and i < len(series_ids) and series_ids[i] and series_ids[i] != series_id:
            continue
        if found >= skip:
            return {
                "accession": accessions[i],
                "filing_date": dates[i],
                "report_date": report_dates[i] if i < len(report_dates) else dates[i],
                "primary_doc": primary_docs[i] if i < len(primary_docs) else "",
            }
        found += 1
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

def _find_nport_for_series(cik: str, series_id: str, skip: int = 0) -> Optional[dict]:
    """
    Find the (skip+1)-th most recent NPORT-P filing for a specific fund series.
    skip=0 → latest, skip=1 → previous quarter. EDGAR submissions JSON never
    populates seriesId in metadata so we scan candidate XMLs until we find matches.
    Different series within the same trust can have different filing schedules,
    so we scan all recent filings rather than just the latest date group.
    """
    data = _submissions_json(cik)
    filings = data.get("filings", {}).get("recent", {})
    forms = filings.get("form", [])
    accessions = filings.get("accessionNumber", [])
    dates = filings.get("filingDate", [])
    report_dates = filings.get("reportDate", [])
    primary_docs = filings.get("primaryDocument", [])

    needle = f"<seriesId>{series_id}</seriesId>".encode()
    found = 0

    for i, form in enumerate(forms):
        if form not in ("NPORT-P", "NPORT-P/A"):
            continue
        candidate = {
            "accession": accessions[i],
            "filing_date": dates[i],
            "report_date": report_dates[i] if i < len(report_dates) else dates[i],
            "primary_doc": primary_docs[i] if i < len(primary_docs) else "",
        }
        try:
            xml_bytes = fetch_nport_xml(cik, candidate)
            if needle in xml_bytes:
                if found >= skip:
                    return candidate
                found += 1
        except Exception as e:
            logger.debug("Skip accession %s for series %s: %s", accessions[i], series_id, e)

    return None


def get_latest_nport(cik: str, series_id: Optional[str] = None) -> Optional[dict]:
    """Return info about the latest NPORT-P filing, filtered by series ID if provided."""
    if series_id:
        return _find_nport_for_series(cik, series_id, skip=0)
    filing = _find_latest_filing(cik, "NPORT-P")
    if not filing:
        filing = _find_latest_filing(cik, "NPORT-P/A")
    return filing


def get_previous_nport(cik: str, series_id: Optional[str] = None) -> Optional[dict]:
    """Return info about the second-most-recent NPORT-P filing (previous quarter)."""
    if series_id:
        return _find_nport_for_series(cik, series_id, skip=1)
    filing = _find_latest_filing(cik, "NPORT-P", skip=1)
    if not filing:
        filing = _find_latest_filing(cik, "NPORT-P/A", skip=1)
    return filing


def fetch_nport_xml(cik: str, filing: dict) -> bytes:
    """Fetch the raw N-PORT XML document for a filing.

    The primaryDocument field from submissions JSON often points to an XSLT path
    (xslFormNPORT-P_X01/primary_doc.xml) that returns an HTML rendering, not raw XML.
    We use the filing index instead to find the actual XML file.
    """
    accession = filing["accession"]
    docs = _list_filing_docs(cik, accession)

    # Find .xml file in the filing root (skip subdirectory/XSLT paths)
    xml_name = None
    for doc in docs:
        name = doc.get("name", "")
        if name.lower().endswith(".xml") and "/" not in name:
            xml_name = name
            if "primary" in name.lower():
                break  # prefer primary_doc.xml

    if not xml_name:
        # Fallback: strip any XSLT prefix from primaryDocument and try basename
        primary_doc = filing.get("primary_doc", "")
        if primary_doc:
            xml_name = primary_doc.split("/")[-1]

    if not xml_name:
        raise RuntimeError(f"Cannot find N-PORT XML for CIK={cik}, accession={accession}")

    return _fetch_xml_for_filing(cik, accession, xml_name)


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

            # CUSIP is an attribute on <cusip> inside <identifiers>, not text content
            cusip = None
            for child in elem.iter():
                if strip_ns(child.tag) == "cusip":
                    cusip = child.get("value") or (child.text or "").strip() or None
                    break

            if name:
                holdings.append({
                    "security_name": name,
                    "security_ticker": ticker,
                    "cusip": cusip,
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


def get_previous_13f(cik: str) -> Optional[dict]:
    """Return info about the second-most-recent 13F-HR filing (previous quarter)."""
    filing = _find_latest_filing(cik, "13F-HR", skip=1)
    if not filing:
        filing = _find_latest_filing(cik, "13F-HR/A", skip=1)
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
        title_of_class = (
            find_text(it, ".//{*}titleOfClass") or find_text(it, "titleOfClass") or None
        )
        ticker = (
            find_text(it, ".//{*}ticker") or find_text(it, "ticker") or None
        )

        value = (parse_number(value_str) or 0)  # convert to USD
        shares = parse_number(shares_str)

        if name:
            raw.append({
                "security_name": name,
                "security_ticker": ticker,
                "cusip": cusip,
                "shares": shares,
                "market_value": value,
                "title_of_class": title_of_class,
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


# ─── Generic N-PORT Connector ──────────────────────────────────────────────────

class NPortConnector(Connector):
    """
    Base connector for any ETF that files N-PORT with the SEC.
    Subclass and set the four class variables — no other code needed.

    To add a new fund:
        class XYZConnector(NPortConnector):
            fund_name = "XYZ Fund Name"
            fund_ticker = "XYZ"
            cik = "0001234567"
            series_id = "S000012345"
    """
    fund_name: str
    fund_ticker: str
    cik: str
    series_id: str
    CUSIP_FALLBACK: dict = {}  # {cusip: ticker} for non-US CUSIPs OpenFIGI can't resolve
    NAME_FALLBACK: dict = {}   # {uppercase_name: ticker} for holdings with placeholder CUSIPs

    def fetch_raw(self) -> Any:
        filing = get_latest_nport(self.cik, self.series_id)
        if not filing:
            raise RuntimeError(
                f"{self.fund_ticker}: No N-PORT filing found on EDGAR "
                f"(CIK={self.cik}, series={self.series_id})"
            )
        xml_bytes = fetch_nport_xml(self.cik, filing)
        return {
            "source": "edgar_nport",
            "xml": xml_bytes,
            "filing": filing,
            "url": (
                f"https://www.sec.gov/cgi-bin/browse-edgar?"
                f"action=getcompany&CIK={self.cik}&type=N-PORT"
            ),
        }

    def fetch_raw_previous(self) -> Any:
        filing = get_previous_nport(self.cik, self.series_id)
        if not filing:
            return None
        xml_bytes = fetch_nport_xml(self.cik, filing)
        return {
            "source": "edgar_nport",
            "xml": xml_bytes,
            "filing": filing,
            "url": (
                f"https://www.sec.gov/cgi-bin/browse-edgar?"
                f"action=getcompany&CIK={self.cik}&type=N-PORT"
            ),
        }

    def parse_holdings(self, raw: Any) -> tuple[list[dict], str, str]:
        from scrapers.utils import cusip_to_tickers
        holdings = parse_nport_xml(raw["xml"])

        cusips = [h["cusip"] for h in holdings if h.get("cusip") and not h.get("security_ticker")]
        if cusips:
            ticker_map = cusip_to_tickers(cusips)
            for h in holdings:
                if not h.get("security_ticker") and h.get("cusip") in ticker_map:
                    h["security_ticker"] = ticker_map[h["cusip"]]
                    h["holding_key"] = normalize_key(h["security_ticker"], h["security_name"])

        for h in holdings:
            if not h.get("security_ticker") and h.get("cusip") in self.CUSIP_FALLBACK:
                h["security_ticker"] = self.CUSIP_FALLBACK[h["cusip"]]
                h["holding_key"] = normalize_key(h["security_ticker"], h["security_name"])
            if not h.get("security_ticker") and h["security_name"].upper() in self.NAME_FALLBACK:
                h["security_ticker"] = self.NAME_FALLBACK[h["security_name"].upper()]
                h["holding_key"] = normalize_key(h["security_ticker"], h["security_name"])

        as_of_date = raw["filing"].get("report_date", raw["filing"].get("filing_date", ""))
        return holdings, as_of_date, raw["url"]


# ─── Generic 13F-HR Connector ──────────────────────────────────────────────────

class ThirteenFConnector(Connector):
    """
    Base connector for any institutional manager that files 13F-HR with the SEC.
    Subclass and set fund_name, fund_ticker, CIK, and optionally CUSIP_FALLBACK.

    To add a new fund:
        class XYZConnector(ThirteenFConnector):
            fund_name = "XYZ Fund"
            fund_ticker = "XYZ"
            CIK = "0001234567"
            CUSIP_FALLBACK = {"XXXXXXXXX": "TICK"}  # optional
    """
    from scrapers.utils import cusip_to_tickers as _cusip_to_tickers  # imported at class level to avoid circular at module load

    fund_name: str
    fund_ticker: str
    CIK: str
    CUSIP_FALLBACK: dict = {}

    def fetch_raw(self) -> Any:
        filing = get_latest_13f(self.CIK)
        if not filing:
            raise RuntimeError(
                f"{self.fund_ticker}: No 13F-HR filing found on EDGAR (CIK={self.CIK})"
            )
        xml_bytes = fetch_13f_xml(self.CIK, filing)
        return {
            "source": "edgar_13f",
            "xml": xml_bytes,
            "filing": filing,
            "url": (
                f"https://www.sec.gov/cgi-bin/browse-edgar?"
                f"action=getcompany&CIK={self.CIK}&type=13F-HR"
            ),
        }

    def fetch_raw_previous(self) -> Any:
        filing = get_previous_13f(self.CIK)
        if not filing:
            return None
        xml_bytes = fetch_13f_xml(self.CIK, filing)
        return {
            "source": "edgar_13f",
            "xml": xml_bytes,
            "filing": filing,
            "url": (
                f"https://www.sec.gov/cgi-bin/browse-edgar?"
                f"action=getcompany&CIK={self.CIK}&type=13F-HR"
            ),
        }

    def parse_holdings(self, raw: Any) -> tuple[list[dict], str, str]:
        from scrapers.utils import cusip_to_tickers
        holdings = parse_13f_xml(raw["xml"])

        cusips = [h["cusip"] for h in holdings if h.get("cusip") and not h.get("security_ticker")]
        if cusips:
            ticker_map = cusip_to_tickers(cusips)
            for h in holdings:
                if not h.get("security_ticker") and h.get("cusip") in ticker_map:
                    h["security_ticker"] = ticker_map[h["cusip"]]

        for h in holdings:
            if not h.get("security_ticker") and h.get("cusip") in self.CUSIP_FALLBACK:
                h["security_ticker"] = self.CUSIP_FALLBACK[h["cusip"]]

        as_of_date = raw["filing"].get("report_date", raw["filing"].get("filing_date", ""))
        return holdings, as_of_date, raw["url"]
