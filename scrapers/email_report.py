"""Send a quarterly holdings-change report via Resend."""

import json
import logging
import os
import re
from pathlib import Path
from typing import Optional

import requests

logger = logging.getLogger(__name__)

SNAPSHOTS_DIR = Path(__file__).parent.parent / "data" / "snapshots"
RESEND_URL = "https://api.resend.com/emails"


# ─── Diff logic ───────────────────────────────────────────────────────────────

def _norm_name(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip().upper())


def compute_changes(old_holdings: list[dict], new_holdings: list[dict]) -> dict:
    old_map = {h["holding_key"]: h for h in old_holdings}
    new_map = {h["holding_key"]: h for h in new_holdings}
    old_by_name = {_norm_name(h["security_name"]): h for h in old_holdings}

    raw_additions = [h for h in new_holdings if h["holding_key"] not in old_map]
    raw_deletions = [h for h in old_holdings if h["holding_key"] not in new_map]

    # Match additions/deletions that are the same company under a different key
    paired_new, paired_old = set(), set()
    name_mods = []
    for new_h in raw_additions:
        old_h = old_by_name.get(_norm_name(new_h["security_name"]))
        if old_h and old_h["holding_key"] not in new_map and old_h["holding_key"] not in paired_old:
            paired_new.add(new_h["holding_key"])
            paired_old.add(old_h["holding_key"])
            if (old_h.get("shares") != new_h.get("shares") or
                    old_h.get("portfolio_weight") != new_h.get("portfolio_weight")):
                name_mods.append({"before": old_h, "after": new_h})

    additions = [h for h in raw_additions if h["holding_key"] not in paired_new]
    deletions = [h for h in raw_deletions if h["holding_key"] not in paired_old]

    def _is_major(before: dict, after: dict) -> bool:
        bw = before.get("portfolio_weight") or 0
        aw = after.get("portfolio_weight") or 0
        abs_change = abs(aw - bw)
        rel_change = abs(aw - bw) / bw if bw else float("inf")
        # Major if weight shifted ≥0.5pp, or position doubled/halved
        return abs_change >= 0.5 or rel_change >= 1.0

    key_mods = [
        {"before": old_map[k], "after": h}
        for k, h in new_map.items()
        if k in old_map and _is_major(old_map[k], h)
    ]

    all_mods = sorted(
        [m for m in name_mods + key_mods if _is_major(m["before"], m["after"])],
        key=lambda m: -abs(
            (m["after"].get("portfolio_weight") or 0) - (m["before"].get("portfolio_weight") or 0)
        ),
    )

    return {
        "additions": sorted(additions, key=lambda h: -(h.get("portfolio_weight") or 0)),
        "deletions": sorted(deletions, key=lambda h: -(h.get("portfolio_weight") or 0)),
        "modifications": all_mods[:10],
    }


def _load_two_latest(ticker: str) -> tuple[Optional[dict], Optional[dict]]:
    """Return (older_snapshot, newer_snapshot) or (None, None) if < 2 available."""
    ticker_dir = SNAPSHOTS_DIR / ticker
    if not ticker_dir.exists():
        return None, None
    dates = sorted([f.stem for f in ticker_dir.glob("*.json")], reverse=True)
    if len(dates) < 2:
        return None, None
    try:
        newer = json.load(open(ticker_dir / f"{dates[0]}.json"))
        older = json.load(open(ticker_dir / f"{dates[1]}.json"))
        if newer.get("error") or older.get("error"):
            return None, None
        return older, newer
    except Exception as e:
        logger.warning("Could not load snapshots for %s: %s", ticker, e)
        return None, None


# ─── HTML formatting ──────────────────────────────────────────────────────────

def _fmt_weight(h: dict) -> str:
    w = h.get("portfolio_weight")
    return f"{w:.2f}%" if w is not None else ""


def _fmt_label(h: dict) -> str:
    ticker = h.get("security_ticker")
    name = h.get("security_name", "")
    if ticker:
        return f"<strong>{ticker}</strong> <span style='color:#6b7280'>{name}</span>"
    return f"<strong>{name}</strong>"


def _section(title: str, color: str, rows: list[str]) -> str:
    if not rows:
        return ""
    items = "".join(f"<li style='margin:4px 0'>{r}</li>" for r in rows)
    return f"""
    <div style="margin:16px 0">
      <h4 style="margin:0 0 8px;color:{color};font-size:13px;text-transform:uppercase;letter-spacing:.05em">{title}</h4>
      <ul style="margin:0;padding-left:20px;font-size:14px;color:#374151">{items}</ul>
    </div>"""


def build_html(results: list[dict], app_url: str = "") -> str:
    fund_blocks = ""
    for r in results:
        if not r["changes"]:
            continue
        ch = r["changes"]
        has_anything = ch["additions"] or ch["deletions"] or ch["modifications"]
        if not has_anything:
            continue

        add_rows = [f"{_fmt_label(h)} &nbsp;<span style='color:#6b7280;font-size:12px'>{_fmt_weight(h)}</span>" for h in ch["additions"]]
        del_rows = [f"{_fmt_label(h)} &nbsp;<span style='color:#6b7280;font-size:12px'>{_fmt_weight(h)}</span>" for h in ch["deletions"]]
        mod_rows = []
        for m in ch["modifications"]:
            b, a = m["before"], m["after"]
            bw = b.get("portfolio_weight") or 0
            aw = a.get("portfolio_weight") or 0
            delta = aw - bw
            arrow = f"<span style='color:{'#16a34a' if delta > 0 else '#dc2626'}'>{'+' if delta > 0 else ''}{delta:.2f}%</span>"
            mod_rows.append(f"{_fmt_label(a)} &nbsp;{arrow} &nbsp;<span style='color:#6b7280;font-size:12px'>{bw:.2f}% → {aw:.2f}%</span>")

        fund_blocks += f"""
        <div style="margin:24px 0;padding:16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb">
          <h3 style="margin:0 0 4px;font-size:16px;color:#111827">{r['fund_name']}</h3>
          <p style="margin:0 0 12px;font-size:12px;color:#6b7280">{r['date1']} → {r['date2']} &nbsp;|&nbsp; +{len(ch['additions'])} / -{len(ch['deletions'])} / ~{len(ch['modifications'])}</p>
          {_section('Additions', '#16a34a', add_rows)}
          {_section('Removals', '#dc2626', del_rows)}
          {_section('Position changes', '#2563eb', mod_rows)}
        </div>"""

    if not fund_blocks:
        fund_blocks = "<p style='color:#6b7280'>No changes detected this quarter.</p>"

    dashboard_link = f'<p style="margin-top:24px"><a href="{app_url}" style="color:#2563eb">View full dashboard →</a></p>' if app_url else ""

    return f"""<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111827">
  <h2 style="margin:0 0 4px;font-size:20px">Quarterly Portfolio Update</h2>
  <p style="margin:0 0 24px;font-size:13px;color:#6b7280">Holdings changes since last quarter</p>
  {fund_blocks}
  {dashboard_link}
  <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb">
  <p style="font-size:11px;color:#9ca3af">You're receiving this because you manage these fund holdings. Data sourced from SEC EDGAR filings.</p>
</body></html>"""


# ─── Send ─────────────────────────────────────────────────────────────────────

def send_report(tickers: list[str], app_url: str = "") -> bool:
    api_key = os.environ.get("RESEND_API_KEY")
    to_addr = os.environ.get("REPORT_EMAIL_TO")
    from_addr = os.environ.get("REPORT_EMAIL_FROM", "onboarding@resend.dev")

    if not api_key:
        logger.info("RESEND_API_KEY not set — skipping email report")
        return False
    if not to_addr:
        logger.warning("REPORT_EMAIL_TO not set — skipping email report")
        return False

    results = []
    for ticker in tickers:
        older, newer = _load_two_latest(ticker)
        if not older or not newer:
            logger.info("[%s] Not enough snapshots for comparison — skipping", ticker)
            continue
        changes = compute_changes(older["holdings"], newer["holdings"])
        results.append({
            "fund_name": newer.get("fund_name", ticker),
            "date1": older["as_of_date"],
            "date2": newer["as_of_date"],
            "changes": changes,
        })

    total_changes = sum(
        len(r["changes"]["additions"]) + len(r["changes"]["deletions"]) + len(r["changes"]["modifications"])
        for r in results
    )
    if total_changes == 0:
        logger.info("No changes detected across any fund — skipping email")
        return False

    html = build_html(results, app_url)
    recipients = [e.strip() for e in to_addr.split(",") if e.strip()]

    try:
        resp = requests.post(
            RESEND_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "from": from_addr,
                "to": recipients,
                "subject": "Quarterly Portfolio Holdings Update",
                "html": html,
            },
            timeout=15,
        )
        resp.raise_for_status()
        logger.info("Email report sent to %s (id=%s)", recipients, resp.json().get("id"))
        return True
    except Exception as e:
        logger.error("Failed to send email report: %s", e)
        return False
