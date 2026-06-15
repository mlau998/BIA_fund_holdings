import { NextResponse } from "next/server";
import { getFunds } from "@/lib/kv";
import { listSnapshotDates, readSnapshot } from "@/lib/snapshots";
import { computeChanges } from "@/lib/diff";
import { isErrorSnapshot, Snapshot, HoldingRecord } from "@/types";

const RESEND_URL = "https://api.resend.com/emails";
const MIN_WEIGHT_CHANGE = 0.5;

function fmtWeight(h: HoldingRecord): string {
  return h.portfolio_weight != null ? `${h.portfolio_weight.toFixed(2)}%` : "";
}

function fmtLabel(h: HoldingRecord): string {
  if (h.security_ticker) {
    return `<strong>${h.security_ticker}</strong> <span style="color:#6b7280">${h.security_name}</span>`;
  }
  return `<strong>${h.security_name}</strong>`;
}

function isMajorChange(before: HoldingRecord, after: HoldingRecord): boolean {
  const bw = before.portfolio_weight ?? 0;
  const aw = after.portfolio_weight ?? 0;
  const absChange = Math.abs(aw - bw);
  const relChange = bw > 0 ? absChange / bw : Infinity;
  return absChange >= MIN_WEIGHT_CHANGE || relChange >= 1.0;
}

function section(title: string, color: string, rows: string[]): string {
  if (rows.length === 0) return "";
  const items = rows.map((r) => `<li style="margin:4px 0">${r}</li>`).join("");
  return `
    <div style="margin:16px 0">
      <h4 style="margin:0 0 8px;color:${color};font-size:13px;text-transform:uppercase;letter-spacing:.05em">${title}</h4>
      <ul style="margin:0;padding-left:20px;font-size:14px;color:#374151">${items}</ul>
    </div>`;
}

function buildHtml(
  results: Array<{ fundName: string; date1: string; date2: string; changes: ReturnType<typeof computeChanges> }>,
  appUrl: string
): string {
  let fundBlocks = "";

  for (const r of results) {
    const { additions, deletions, modifications } = r.changes;

    const majorMods = modifications
      .filter((m) => isMajorChange(m.before, m.after))
      .sort((a, b) => Math.abs((b.after.portfolio_weight ?? 0) - (b.before.portfolio_weight ?? 0))
        - Math.abs((a.after.portfolio_weight ?? 0) - (a.before.portfolio_weight ?? 0)))
      .slice(0, 10);

    if (additions.length === 0 && deletions.length === 0 && majorMods.length === 0) continue;

    const addRows = additions.map(
      (h) => `${fmtLabel(h)} &nbsp;<span style="color:#6b7280;font-size:12px">${fmtWeight(h)}</span>`
    );
    const delRows = deletions.map(
      (h) => `${fmtLabel(h)} &nbsp;<span style="color:#6b7280;font-size:12px">${fmtWeight(h)}</span>`
    );
    const modRows = majorMods.map((m) => {
      const bw = m.before.portfolio_weight ?? 0;
      const aw = m.after.portfolio_weight ?? 0;
      const delta = aw - bw;
      const color = delta > 0 ? "#16a34a" : "#dc2626";
      const sign = delta > 0 ? "+" : "";
      return `${fmtLabel(m.after)} &nbsp;<span style="color:${color}">${sign}${delta.toFixed(2)}%</span> <span style="color:#6b7280;font-size:12px">${bw.toFixed(2)}% → ${aw.toFixed(2)}%</span>`;
    });

    fundBlocks += `
      <div style="margin:24px 0;padding:16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb">
        <h3 style="margin:0 0 4px;font-size:16px;color:#111827">${r.fundName}</h3>
        <p style="margin:0 0 12px;font-size:12px;color:#6b7280">${r.date1} → ${r.date2} &nbsp;|&nbsp; +${additions.length} / -${deletions.length} / ~${majorMods.length}</p>
        ${section("Additions", "#16a34a", addRows)}
        ${section("Removals", "#dc2626", delRows)}
        ${section("Major position changes", "#2563eb", modRows)}
      </div>`;
  }

  if (!fundBlocks) {
    fundBlocks = `<p style="color:#6b7280">No significant changes detected this quarter.</p>`;
  }

  const dashLink = appUrl
    ? `<p style="margin-top:24px"><a href="${appUrl}" style="color:#2563eb">View full dashboard →</a></p>`
    : "";

  return `<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111827">
  <h2 style="margin:0 0 4px;font-size:20px">Quarterly Portfolio Update</h2>
  <p style="margin:0 0 24px;font-size:13px;color:#6b7280">Holdings changes since last quarter</p>
  ${fundBlocks}
  ${dashLink}
  <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb">
  <p style="font-size:11px;color:#9ca3af">Data sourced from SEC EDGAR filings.</p>
</body></html>`;
}

export async function POST() {
  const apiKey = process.env.RESEND_API_KEY;
  const toAddr = process.env.REPORT_EMAIL_TO;
  const fromAddr = process.env.REPORT_EMAIL_FROM ?? "onboarding@resend.dev";
  const appUrl = process.env.APP_URL ?? "";

  if (!apiKey) return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  if (!toAddr) return NextResponse.json({ error: "REPORT_EMAIL_TO not configured" }, { status: 500 });

  const funds = await getFunds();
  const results = [];

  for (const fund of funds) {
    const dates = listSnapshotDates(fund.ticker);
    if (dates.length < 2) continue;
    const older = readSnapshot(fund.ticker, dates[1]);
    const newer = readSnapshot(fund.ticker, dates[0]);
    if (!older || !newer || isErrorSnapshot(older) || isErrorSnapshot(newer)) continue;
    results.push({
      fundName: (newer as Snapshot).fund_name,
      date1: (older as Snapshot).as_of_date,
      date2: (newer as Snapshot).as_of_date,
      changes: computeChanges(older as Snapshot, newer as Snapshot),
    });
  }

  const html = buildHtml(results, appUrl);
  const recipients = toAddr.split(",").map((e) => e.trim()).filter(Boolean);

  const resp = await fetch(RESEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromAddr,
      to: recipients,
      subject: "Quarterly Portfolio Holdings Update",
      html,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    return NextResponse.json({ error: `Resend error: ${err}` }, { status: 502 });
  }

  const data = await resp.json();
  return NextResponse.json({ ok: true, id: data.id, recipients });
}
