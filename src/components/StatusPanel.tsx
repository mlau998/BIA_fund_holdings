"use client";

import Link from "next/link";
import { FundMeta, FundStatus } from "@/types";

interface Props {
  statuses: FundStatus[];
  fundConfig: Record<string, FundMeta>;
}

// Estimate: one quarter after last as_of_date + ~60 day filing lag.
// If already past (stale data), keep advancing by quarters.
function estimatedRelease(asOfDate: string): Date {
  const d = new Date(asOfDate + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 3);
  d.setUTCDate(d.getUTCDate() + 60);
  const now = Date.now();
  while (d.getTime() <= now) {
    d.setUTCMonth(d.getUTCMonth() + 3);
  }
  return d;
}

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function StatusPanel({ statuses, fundConfig }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
      {statuses.map((status) => {
        const config = fundConfig[status.ticker];
        const release =
          status.latestDate && !status.hasError
            ? estimatedRelease(status.latestDate)
            : null;
        const days = release ? daysUntil(release) : null;
        const urgent = !status.hasError && days !== null && days <= 14;

        return (
          <Link
            key={status.ticker}
            href={`/fund/${status.ticker}`}
            className="block bg-white border border-[#E4DECF] rounded-[14px] p-[18px_20px] transition-all duration-150 hover:border-[#C9C0AC] hover:shadow-md"
          >
            {/* Badge row */}
            <div className="flex items-center gap-2">
              <span className="font-mono text-[13px] font-semibold text-[#1F3D63] bg-[#E5EAF1] px-[9px] py-1 rounded-[6px] leading-none">
                {status.ticker}
              </span>
              {config?.type && (
                <span className="font-mono text-[11.5px] font-semibold text-[#7C7563] bg-[#EFE9DD] px-2 py-1 rounded-[6px] leading-none whitespace-nowrap">
                  {config.type}
                </span>
              )}
              {status.latestDate && !status.hasError && (
                <span className="ml-auto flex items-center gap-1.5 text-[11.5px] font-semibold text-[#0E7C4A] whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16A06A] inline-block shrink-0" />
                  As of {status.latestDate}
                </span>
              )}
            </div>

            {/* Fund name */}
            <div className="mt-[13px] font-serif text-[19px] font-medium text-[#211C13] leading-snug">
              {config?.name || status.ticker}
            </div>

            {/* Countdown row */}
            <div className="mt-[14px] pt-[13px] border-t border-[#EAE4D7] flex items-center gap-2">
              {status.hasError ? (
                <span className="text-[11.5px] font-semibold text-[#C23B30] bg-[#FBECEA] px-[9px] py-1 rounded-[7px]">
                  Error
                </span>
              ) : days !== null ? (
                <span
                  title="Estimated: ~3 months after last filing + 60-day SEC publication lag"
                  className={`flex items-center gap-1.5 text-[11.5px] font-semibold px-[9px] py-1 rounded-[7px] whitespace-nowrap cursor-help ${
                    urgent ? "text-[#B45309] bg-[#FEF3DC]" : "text-[#574F3D] bg-[#EFE9DD]"
                  }`}
                >
                  ↻ Est. release in {days} day{days === 1 ? "" : "s"}
                </span>
              ) : (
                <span className="text-[11.5px] text-[#A39A86]">No data</span>
              )}
              {release && (
                <span className="ml-auto font-mono text-[11.5px] text-[#A39A86]">
                  ~{fmtDate(release)}
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
