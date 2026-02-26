import { notFound } from "next/navigation";
import Link from "next/link";
import { FUND_CONFIG, ALL_TICKERS } from "@/lib/config";
import { readLatestSnapshot, getFundStatus, listSnapshotDates } from "@/lib/snapshots";
import { isErrorSnapshot, Snapshot } from "@/types";
import HoldingsTable from "@/components/HoldingsTable";
import WarningBanner from "@/components/WarningBanner";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return ALL_TICKERS.map((ticker) => ({ ticker }));
}

interface Props {
  params: Promise<{ ticker: string }>;
}

export default async function FundDetailPage({ params }: Props) {
  const { ticker } = await params;
  const upperTicker = ticker.toUpperCase();

  if (!ALL_TICKERS.includes(upperTicker)) {
    notFound();
  }

  const config = FUND_CONFIG[upperTicker];
  const status = getFundStatus(upperTicker);
  const snap = readLatestSnapshot(upperTicker);
  const dates = listSnapshotDates(upperTicker);

  const isError = !snap || isErrorSnapshot(snap);
  const snapshot = isError ? null : (snap as Snapshot);

  const warnings = snapshot?.warnings || [];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500">
        <Link href="/" className="hover:text-blue-600">Dashboard</Link>
        {" / "}
        <span className="font-medium text-gray-900">{upperTicker}</span>
      </nav>

      {/* Header */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="rounded bg-blue-100 px-2 py-1 font-mono text-sm font-bold text-blue-800">
                {upperTicker}
              </span>
              <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                {config.type}
              </span>
            </div>
            <h1 className="mt-2 text-xl font-bold text-gray-900">{config.name}</h1>
            <p className="mt-1 text-sm text-gray-600">{config.description}</p>
            {config.dataNote && (
              <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 inline-block">
                {config.dataNote}
              </p>
            )}
          </div>
          <div className="text-right text-xs text-gray-400 space-y-1">
            <div>
              <a href={config.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                {config.website}
              </a>
            </div>
            {snapshot && (
              <>
                <div>As of: <strong>{snapshot.as_of_date}</strong></div>
                <div>Source: {snapshot.source}</div>
                <div>Updated: {new Date(snapshot.scrape_timestamp).toLocaleString()}</div>
              </>
            )}
            <div>
              {dates.length} snapshot{dates.length !== 1 ? "s" : ""} available
            </div>
          </div>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Failed to fetch holdings.</strong>{" "}
          {snap && isErrorSnapshot(snap) ? snap.error_message : "No snapshot found."}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Warnings</h2>
          <WarningBanner warnings={warnings} />
        </section>
      )}

      {/* Holdings table */}
      {snapshot && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Holdings ({snapshot.holdings.length})
            </h2>
            <Link
              href={`/changes?fund=${upperTicker}`}
              className="text-xs text-blue-600 hover:underline"
            >
              View changes →
            </Link>
          </div>
          <HoldingsTable holdings={snapshot.holdings} showFund={false} showExtraColumns />
        </section>
      )}
    </div>
  );
}
