import { Suspense } from "react";
import Link from "next/link";
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
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Holdings Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Aggregated holdings across {tickers.length} funds
          </p>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Fund Status
        </h2>
        <StatusPanel statuses={statuses} fundConfig={fundConfig} />
      </section>

      <section className="flex flex-wrap gap-2">
        {funds.map((fund) => (
          <Link
            key={fund.ticker}
            href={`/fund/${fund.ticker}`}
            className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
          >
            {fund.ticker} — {fund.name}
          </Link>
        ))}
      </section>

      {allWarnings.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Notifications
          </h2>
          <WarningBanner warnings={allWarnings} />
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Holdings
        </h2>
        <Suspense fallback={<div className="text-sm text-gray-400">Loading holdings…</div>}>
          <DashboardClient initialHoldings={initialHoldings} tickers={tickers} />
        </Suspense>
      </section>
    </div>
  );
}
