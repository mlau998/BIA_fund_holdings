import { notFound } from "next/navigation";
import Link from "next/link";
import { getFunds, getFundConfig } from "@/lib/kv";
import { STATIC_TICKERS } from "@/lib/config";
import { readLatestSnapshot, listSnapshotDates } from "@/lib/snapshots";
import { isErrorSnapshot, Snapshot } from "@/types";
import HoldingsTable from "@/components/HoldingsTable";
import WarningBanner from "@/components/WarningBanner";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export function generateStaticParams() {
  return STATIC_TICKERS.map((ticker) => ({ ticker }));
}

interface Props {
  params: Promise<{ ticker: string }>;
}

export default async function FundDetailPage({ params }: Props) {
  const { ticker } = await params;
  const upperTicker = ticker.toUpperCase();

  const [funds, fundConfig] = await Promise.all([getFunds(), getFundConfig()]);
  const tickers = funds.map((f) => f.ticker);

  if (!tickers.includes(upperTicker)) {
    notFound();
  }

  const config = fundConfig[upperTicker];
  const snap = readLatestSnapshot(upperTicker);
  const dates = listSnapshotDates(upperTicker);

  const isError = !snap || isErrorSnapshot(snap);
  const snapshot = isError ? null : (snap as Snapshot);
  const warnings = snapshot?.warnings || [];

  return (
    <div className="space-y-[24px]">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[14px] text-[#A39A86]">
        <Link href="/" className="hover:text-[#1F3D63] transition-colors">
          Dashboard
        </Link>
        <span>/</span>
        <span className="font-semibold text-[#211C13]">{upperTicker}</span>
      </nav>

      {/* Fund meta card */}
      <div className="bg-white border border-[#E4DECF] rounded-[16px] p-[26px_28px]">
        <div className="flex items-center gap-[9px]">
          <span className="font-mono text-[15px] font-semibold text-[#1F3D63] bg-[#E5EAF1] px-[11px] py-[5px] rounded-[7px]">
            {upperTicker}
          </span>
          {config?.type && (
            <span className="font-mono text-[12.5px] font-semibold text-[#7C7563] bg-[#EFE9DD] px-[10px] py-[5px] rounded-[7px]">
              {config.type}
            </span>
          )}
          {config?.website && (
            <a
              href={config.website}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-[13px] text-[#1F3D63] hover:underline"
            >
              {config.website.replace(/^https?:\/\//, "")} →
            </a>
          )}
        </div>

        <h1 className="mt-4 font-serif text-[32px] font-medium tracking-[-0.01em] text-[#211C13] leading-snug m-0 mt-4">
          {config?.name || upperTicker}
        </h1>

        {config?.description && (
          <p className="mt-[10px] text-[15px] leading-relaxed text-[#7C7563] max-w-[680px]">
            {config.description}
          </p>
        )}

        {config?.dataNote && (
          <p className="mt-2 text-xs text-[#B45309] bg-[#FEF3DC] rounded-[7px] px-3 py-1.5 inline-block">
            {config.dataNote}
          </p>
        )}

        {snapshot && (
          <div className="mt-5 pt-[18px] border-t border-[#EAE4D7] flex items-center gap-7 flex-wrap">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold tracking-[0.05em] text-[#A39A86] uppercase">
                As of
              </span>
              <span className="font-mono text-[14px] font-semibold text-[#2C261B]">
                {snapshot.as_of_date}
              </span>
            </div>
            <div className="w-px self-stretch bg-[#EAE4D7]" />
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold tracking-[0.05em] text-[#A39A86] uppercase">
                Source
              </span>
              <span className="font-mono text-[14px] font-semibold text-[#2C261B]">
                {snapshot.source}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold tracking-[0.05em] text-[#A39A86] uppercase">
                Updated
              </span>
              <span className="font-mono text-[14px] font-semibold text-[#2C261B]">
                {new Date(snapshot.scrape_timestamp).toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold tracking-[0.05em] text-[#A39A86] uppercase">
                Snapshots
              </span>
              <span className="font-mono text-[14px] font-semibold text-[#2C261B]">
                {dates.length}
              </span>
            </div>
          </div>
        )}
      </div>

      {isError && (
        <div className="rounded-[12px] border border-[#F0DAD7] bg-[#FBF0EF] px-4 py-3 text-sm text-[#C23B30]">
          <strong>Failed to fetch holdings.</strong>{" "}
          {snap && isErrorSnapshot(snap) ? snap.error_message : "No snapshot found."}
        </div>
      )}

      {warnings.length > 0 && (
        <section>
          <div className="text-[11.5px] font-semibold tracking-[0.06em] text-[#A39A86] uppercase mb-2">
            Notifications
          </div>
          <WarningBanner warnings={warnings} />
        </section>
      )}

      {snapshot && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[11.5px] font-semibold tracking-[0.06em] text-[#A39A86] uppercase">
              Holdings ({snapshot.holdings.length})
            </div>
            <Link
              href={`/changes?fund=${upperTicker}`}
              className="text-[14px] font-semibold text-[#1F3D63] hover:underline"
            >
              View changes →
            </Link>
          </div>
          {upperTicker === "MPLY" ? (
            <HoldingsTable holdings={snapshot.holdings} fundTicker="MPLY" showFund={false} />
          ) : (
            <HoldingsTable
              holdings={snapshot.holdings}
              showFund={false}
              fundTicker={upperTicker}
            />
          )}
        </section>
      )}
    </div>
  );
}
