import { Suspense } from "react";
import { getFunds, getFundConfig } from "@/lib/kv";
import { readLatestSnapshot, getFundStatus } from "@/lib/snapshots";
import { isErrorSnapshot, Snapshot } from "@/types";
import StatusPanel from "@/components/StatusPanel";
import WarningBanner from "@/components/WarningBanner";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [funds, fundConfig] = await Promise.all([getFunds(), getFundConfig()]);
  const tickers = funds.map((f) => f.ticker);

  const statuses = tickers.map(getFundStatus);

  const allWarnings: Array<{ level: "error" | "warning"; message: string; fund_ticker: string }> = [];
  for (const ticker of tickers) {
    const snap = readLatestSnapshot(ticker);
    if (!snap) continue;
    if (isErrorSnapshot(snap)) {
      allWarnings.push({ level: "error", message: snap.error_message, fund_ticker: ticker });
    } else {
      for (const w of (snap as Snapshot).warnings || []) {
        allWarnings.push({ ...w, fund_ticker: ticker });
      }
    }
  }

  const initialHoldings: Array<{
    security_name: string;
    security_ticker?: string;
    shares?: number;
    portfolio_weight?: number;
    market_value?: number;
    holding_key: string;
    fund_ticker: string;
    as_of_date: string;
  }> = [];

  for (const ticker of tickers) {
    const snap = readLatestSnapshot(ticker);
    if (!snap || isErrorSnapshot(snap)) continue;
    const s = snap as Snapshot;
    for (const h of s.holdings) {
      initialHoldings.push({ ...h, fund_ticker: ticker, as_of_date: s.as_of_date });
    }
  }

  return (
    <div className="space-y-[26px]">
      {/* Page header */}
      <div>
        <div className="font-mono text-[11px] font-semibold tracking-[0.2em] text-[#A39A86] uppercase mb-[9px]">
          Portfolio Intelligence
        </div>
        <h1 className="font-serif text-[38px] font-medium tracking-[-0.01em] text-[#211C13] leading-none m-0">
          Holdings Dashboard
        </h1>
        <p className="mt-[7px] text-[15px] text-[#8A8170]">
          Aggregated holdings across {tickers.length} funds · {initialHoldings.length} positions
        </p>
      </div>

      {/* Fund status */}
      <section>
        <div className="text-[11.5px] font-semibold tracking-[0.06em] text-[#A39A86] uppercase mb-3">
          Funds
        </div>
        <StatusPanel statuses={statuses} fundConfig={fundConfig} />
      </section>

      {/* Warnings */}
      {allWarnings.length > 0 && (
        <section>
          <div className="text-[11.5px] font-semibold tracking-[0.06em] text-[#A39A86] uppercase mb-2">
            Notifications
          </div>
          <WarningBanner warnings={allWarnings} />
        </section>
      )}

      {/* Holdings */}
      <section>
        <Suspense fallback={<div className="text-sm text-[#A39A86]">Loading holdings…</div>}>
          <DashboardClient initialHoldings={initialHoldings} tickers={tickers} />
        </Suspense>
      </section>
    </div>
  );
}
