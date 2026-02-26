import { Suspense } from "react";
import ChangesPageClient from "./ChangesClient";
import { ALL_TICKERS } from "@/lib/config";
import { listSnapshotDates } from "@/lib/snapshots";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ fund?: string }>;
}

export default async function ChangesPage({ searchParams }: Props) {
  const params = await searchParams;
  const defaultFund = params.fund?.toUpperCase() || ALL_TICKERS[0];

  // Pre-fetch snapshot dates for all funds
  const snapshotDatesByFund: Record<string, string[]> = {};
  for (const ticker of ALL_TICKERS) {
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
        />
      </Suspense>
    </div>
  );
}
