import { NextResponse } from "next/server";
import { getFunds } from "@/lib/kv";
import { listSnapshotDates, readSnapshot } from "@/lib/snapshots";
import { computeChanges } from "@/lib/diff";
import { isErrorSnapshot, Snapshot, HoldingRecord } from "@/types";
import { STATIC_FUND_CONFIG } from "@/lib/config";
import { toTitleCase } from "@/lib/utils";

const RESEND_URL = "https://api.resend.com/emails";

const POS = "#0E7C4A";
const NEG = "#C23B30";
const POS_BG = "#E8F4EE";
const NEG_BG = "#FBECEA";

function fmtDate(d: string): string {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

function daysBetween(d1: string, d2: string): number {
  return Math.round((new Date(d2).getTime() - new Date(d1).getTime()) / (1000 * 60 * 60 * 24));
}

function fmtW(w: number | undefined | null): string {
  return w != null ? w.toFixed(2) + "%" : "—";
}

function fmtMoney(v: number | undefined | null): string {
  if (v == null) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(2)}K`;
  return `$${v.toLocaleString()}`;
}

function pill(color: string, bg: string, text: string): string {
  return `<span style="display:inline-block;font-family:'Courier New',monospace;font-size:12.5px;font-weight:600;color:${color};background:${bg};padding:3px 9px;border-radius:7px;white-space:nowrap;">${text}</span>`;
}

function holdingRow(h: HoldingRecord, accent: string, weightText: string): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #F0EBDF;">
    <tr>
      <td width="3" bgcolor="${accent}" style="background:${accent};border-radius:2px;padding:0;"></td>
      <td style="padding:14px 12px;vertical-align:middle;">
        <div style="font-size:15px;font-weight:500;color:#241F16;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${toTitleCase(h.security_name)}</div>
        <div style="margin-top:4px;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.05em;color:#AAA08A;">${h.security_ticker || "—"}</div>
      </td>
      <td style="text-align:right;white-space:nowrap;vertical-align:middle;padding:14px 0 14px 12px;">
        <div style="font-family:'Courier New',monospace;font-size:15px;font-weight:600;color:${accent};letter-spacing:-0.01em;">${weightText}</div>
        <div style="margin-top:4px;font-family:'Courier New',monospace;font-size:11.5px;color:#6B6255;">${fmtMoney(h.market_value)}</div>
      </td>
    </tr>
  </table>`;
}

type FundResult = {
  fundName: string;
  ticker: string;
  fundType: string;
  date1: string;
  date2: string;
  changes: ReturnType<typeof computeChanges>;
};

function buildFundMiniCard(r: FundResult): string {
  const { fundName, ticker, fundType, date1, date2, changes } = r;
  const { additions, deletions, modifications } = changes;

  const addedW = additions.reduce((s, h) => s + (h.portfolio_weight ?? 0), 0);
  const removedW = deletions.reduce((s, h) => s + (h.portfolio_weight ?? 0), 0);
  const days = daysBetween(date1, date2);

  const addedRows = additions.map(h => holdingRow(h, POS, fmtW(h.portfolio_weight))).join("");
  const removedRows = deletions.map(h => holdingRow(h, NEG, fmtW(h.portfolio_weight))).join("");

  const topMods = [...modifications]
    .sort((a, b) =>
      Math.abs((b.after.portfolio_weight ?? 0) - (b.before.portfolio_weight ?? 0)) -
      Math.abs((a.after.portfolio_weight ?? 0) - (a.before.portfolio_weight ?? 0))
    )
    .slice(0, 10);

  const modRows = topMods.map((m, i) => {
    const wB = m.before.portfolio_weight ?? 0;
    const wA = m.after.portfolio_weight ?? 0;
    const wD = wA - wB;
    const vD = (m.after.market_value ?? 0) - (m.before.market_value ?? 0);
    const up = wD >= 0;
    const c = up ? POS : NEG;
    const deltaText = Math.abs(wD).toFixed(2) + "pp";
    const vText = fmtMoney(Math.abs(vD));
    const rank = String(i + 1).padStart(2, "0");
    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #F0EBDF;">
      <tr>
        <td width="22" style="padding:14px 12px 14px 0;vertical-align:middle;white-space:nowrap;">
          <span style="font-family:'Courier New',monospace;font-size:11.5px;font-weight:600;color:#CABFA2;">${rank}</span>
        </td>
        <td style="padding:14px 0;vertical-align:middle;width:100%;">
          <div style="font-size:15px;font-weight:500;color:#241F16;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${toTitleCase(m.after.security_name)}</div>
          <div style="margin-top:4px;font-family:'Courier New',monospace;font-size:11.5px;color:#AAA08A;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.after.security_ticker || "—"} · ${wB.toFixed(2)}% → ${wA.toFixed(2)}%</div>
        </td>
        <td style="text-align:right;white-space:nowrap;vertical-align:middle;padding:14px 0 14px 12px;">
          ${pill(c, up ? POS_BG : NEG_BG, deltaText)}
          <div style="margin-top:5px;font-family:'Courier New',monospace;font-size:12px;font-weight:600;color:${c};">${vText}</div>
        </td>
      </tr>
    </table>`;
  }).join("");

  const sectionHeader = (label: string, labelColor: string, right: string) => `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #EAE4D7;padding-bottom:12px;margin-bottom:0;">
      <tr>
        <td style="vertical-align:baseline;padding:0;">
          <span style="font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${labelColor};">${label}</span>
        </td>
        <td style="text-align:right;vertical-align:baseline;padding:0;white-space:nowrap;">
          <span style="font-family:'Courier New',monospace;font-size:12px;color:#A39A86;">${right}</span>
        </td>
      </tr>
    </table>`;

  const addedSection = additions.length > 0 ? `
  <div style="padding:26px 32px 0;">
    ${sectionHeader("New positions", "#0E6B41", `(${additions.length})`)}
    ${addedRows}
  </div>` : "";

  const removedSection = deletions.length > 0 ? `
  <div style="padding:26px 32px 0;">
    ${sectionHeader("Exited positions", "#A8362C", `(${deletions.length})`)}
    ${removedRows}
  </div>` : "";

  const modSection = modifications.length > 0 ? `
  <div style="padding:26px 32px 12px;">
    ${sectionHeader("Top changes", "#243E60", `Top ${topMods.length} of ${modifications.length} re-weighted`)}
    ${modRows}
  </div>` : "";

  const noChanges = additions.length === 0 && deletions.length === 0 && modifications.length === 0;

  return `
  <div style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E4DECF;margin-bottom:16px;">
    <!-- fund card header -->
    <div style="padding:18px 32px 16px;border-bottom:1px solid #EAE4D7;background:#FAFAF8;">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-family:'Courier New',monospace;font-size:12.5px;font-weight:700;color:#1F3D63;background:#E5EAF1;padding:3px 9px;border-radius:6px;">${ticker}</span>
        <span style="font-family:'Courier New',monospace;font-size:11px;font-weight:600;color:#7C7563;background:#EFE9DD;padding:3px 8px;border-radius:6px;">${fundType}</span>
        <span style="font-family:'Courier New',monospace;font-size:11.5px;color:#A39A86;margin-left:4px;">${fmtDate(date1)} → ${fmtDate(date2)} · ${days}d</span>
      </div>
      <div style="margin-top:8px;font-family:Georgia,serif;font-size:17px;font-weight:500;color:#211C13;line-height:1.25;">${fundName}</div>
    </div>

    <!-- summary stats -->
    <div style="padding:18px 32px 6px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="33%" style="padding-right:8px;">
            <div style="border:1px solid #E4DECF;border-top:3px solid #16A06A;border-radius:10px;padding:12px 14px;">
              <div style="font-family:'Courier New',monospace;font-size:24px;font-weight:700;color:#0E7C4A;line-height:1;">${additions.length}</div>
              <div style="margin-top:5px;font-size:10px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:#A39A86;">Added</div>
              <div style="margin-top:2px;font-family:'Courier New',monospace;font-size:11px;color:#5C9678;">+${addedW.toFixed(2)}pp</div>
            </div>
          </td>
          <td width="33%" style="padding-right:8px;">
            <div style="border:1px solid #E4DECF;border-top:3px solid #D5564B;border-radius:10px;padding:12px 14px;">
              <div style="font-family:'Courier New',monospace;font-size:24px;font-weight:700;color:#C23B30;line-height:1;">${deletions.length}</div>
              <div style="margin-top:5px;font-size:10px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:#A39A86;">Removed</div>
              <div style="margin-top:2px;font-family:'Courier New',monospace;font-size:11px;color:#C08A84;">−${removedW.toFixed(2)}pp</div>
            </div>
          </td>
          <td width="33%">
            <div style="border:1px solid #E4DECF;border-top:3px solid #1F3D63;border-radius:10px;padding:12px 14px;">
              <div style="font-family:'Courier New',monospace;font-size:24px;font-weight:700;color:#1F3D63;line-height:1;">${modifications.length}</div>
              <div style="margin-top:5px;font-size:10px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:#A39A86;">Modified</div>
              <div style="margin-top:2px;font-family:'Courier New',monospace;font-size:11px;color:#6E83A8;">re-weighted</div>
            </div>
          </td>
        </tr>
      </table>
    </div>

    ${noChanges ? `<div style="padding:20px 32px;font-size:13px;color:#A39A86;">No changes detected for this period.</div>` : ""}
    ${addedSection}
    ${removedSection}
    ${modSection}
  </div>`;
}

function buildHtml(results: FundResult[], appUrl: string): string {
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const tickers = results.map(r => r.ticker);

  const tickerBadges = tickers.map(t =>
    `<span style="font-family:'Courier New',monospace;font-size:11.5px;font-weight:600;color:#D8CFB8;background:rgba(255,255,255,0.08);padding:3px 9px;border-radius:6px;">${t}</span>`
  ).join(" ");

  const fundCards = results.length > 0
    ? results.map(buildFundMiniCard).join("")
    : `<div style="background:#fff;border-radius:12px;padding:36px;text-align:center;color:#8A8170;font-size:14px;">No changes detected this period.</div>`;

  const dashLink = appUrl
    ? `<div style="text-align:center;margin-top:4px;"><a href="${appUrl}" style="font-family:'Courier New',monospace;font-size:12px;color:#8A8170;text-decoration:none;">View full dashboard →</a></div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,16,400;0,16,500;1,16,500&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box}body{margin:0}</style>
</head>
<body style="min-height:100vh;background:#D9D4C8;font-family:Geist,system-ui,sans-serif;color:#211C13;-webkit-font-smoothing:antialiased;padding:40px 20px;">
  <div style="max-width:640px;margin:0 auto;">

    <!-- shared masthead -->
    <div style="background:#211C13;border-radius:14px 14px 0 0;padding:30px 38px 34px;margin-bottom:0;">
      <div style="display:flex;align-items:center;gap:9px;">
        <div style="width:24px;height:24px;border-radius:50%;background:#E0B24A;font-family:Georgia,serif;font-style:italic;font-size:14px;color:#211C13;text-align:center;line-height:24px;">B</div>
        <span style="font-family:Georgia,serif;font-style:italic;font-size:16px;font-weight:500;color:#F4EFE3;">BIA Fund Monitor</span>
      </div>
      <div style="margin-top:24px;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#A79B72;">Holdings Change Report</div>
      <h1 style="margin:8px 0 0;font-family:Georgia,serif;font-size:26px;font-weight:500;line-height:1.2;color:#F7F3EA;letter-spacing:-0.01em;">Portfolio Update · ${today}</h1>
      <div style="margin-top:16px;display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
        ${tickerBadges}
      </div>
      <div style="margin-top:16px;font-size:12px;color:#A79B72;">
        <span style="color:#5C9678;">&#9632;</span>&nbsp;New&nbsp;/&nbsp;Increase
        &nbsp;&nbsp;&nbsp;
        <span style="color:#C23B30;">&#9632;</span>&nbsp;Exited&nbsp;/&nbsp;Decrease
      </div>
    </div>

    <!-- divider strip -->
    <div style="background:#2E2720;height:4px;border-radius:0;margin-bottom:16px;"></div>

    <!-- per-fund cards -->
    ${fundCards}

    <!-- footer -->
    <div style="background:#F7F3EA;border-radius:12px;padding:18px 28px;border:1px solid #E4DECF;margin-top:4px;">
      <div style="font-size:12px;color:#8A8170;line-height:1.55;">Generated by BIA Fund Monitor on ${today}. Source: SEC EDGAR filings. Weights shown as percentage points (pp) of total portfolio.</div>
    </div>

    ${dashLink}
  </div>
</body>
</html>`;
}

export async function POST(req: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const toAddr = process.env.REPORT_EMAIL_TO;
  const fromAddr = process.env.REPORT_EMAIL_FROM ?? "onboarding@resend.dev";
  const appUrl = process.env.APP_URL ?? "";
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || req.headers.get("x-admin-password") !== adminPassword) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!apiKey) return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  if (!toAddr) return NextResponse.json({ error: "REPORT_EMAIL_TO not configured" }, { status: 500 });

  const funds = await getFunds();
  const results: FundResult[] = [];

  for (const fund of funds) {
    const dates = listSnapshotDates(fund.ticker);
    if (dates.length < 2) continue;
    const older = readSnapshot(fund.ticker, dates[1]);
    const newer = readSnapshot(fund.ticker, dates[0]);
    if (!older || !newer || isErrorSnapshot(older) || isErrorSnapshot(newer)) continue;
    results.push({
      fundName: (newer as Snapshot).fund_name,
      ticker: fund.ticker,
      fundType: STATIC_FUND_CONFIG[fund.ticker]?.type ?? "Fund",
      date1: (older as Snapshot).as_of_date,
      date2: (newer as Snapshot).as_of_date,
      changes: computeChanges(older as Snapshot, newer as Snapshot),
    });
  }

  const html = buildHtml(results, appUrl);
  const recipients = toAddr.split(",").map((e) => e.trim()).filter(Boolean);
  const tickers = results.map(r => r.ticker).join(", ");

  const resp = await fetch(RESEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromAddr,
      to: recipients,
      subject: `BIA Fund Monitor — Holdings Change Report · ${tickers}`,
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
