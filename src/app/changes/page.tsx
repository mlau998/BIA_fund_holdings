import { Suspense } from "react";
import ChangesPageClient from "./ChangesClient";
import { getFunds } from "@/lib/kv";
import { listSnapshotDates } from "@/lib/snapshots";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ fund?: string }>;
}

export default async function ChangesPage({ searchParams }: Props) {
  const [params, funds] = await Promise.all([searchParams, getFunds()]);
  const tickers = funds.map((f) => f.ticker);
  const defaultFund = params.fund?.toUpperCase() || tickers[0];

  const snapshotDatesByFund: Record<string, string[]> = {};
  for (const ticker of tickers) {
    snapshotDatesByFund[ticker] = listSnapshotDates(ticker);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Holdings Changes</h1>
        <p className="mt-1 text-sm text-gray-500">
          Compare holdings between two snapshot dates for a fund
        </p>
      </div>
      <Suspense fallback={<div className="text-sm text-gray-400">Loading…</div>}>
        <ChangesPageClient
          defaultFund={defaultFund}
          snapshotDatesByFund={snapshotDatesByFund}
          tickers={tickers}
        />
      </Suspense>
    </div>
  );
}
