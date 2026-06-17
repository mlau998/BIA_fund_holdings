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
    <div className="space-y-[20px]">
      <div>
        <div className="font-mono text-[11px] font-semibold tracking-[0.2em] text-[#A39A86] uppercase mb-[9px]">
          Position Changes
        </div>
        <h1 className="font-serif text-[38px] font-medium tracking-[-0.01em] text-[#211C13] leading-none m-0">
          Changes in Holdings
        </h1>
      </div>
      <Suspense fallback={<div className="text-sm text-[#A39A86]">Loading…</div>}>
        <ChangesPageClient
          defaultFund={defaultFund}
          snapshotDatesByFund={snapshotDatesByFund}
          tickers={tickers}
        />
      </Suspense>
    </div>
  );
}
