"use client";

import Link from "next/link";
import { FundMeta, FundStatus } from "@/types";

interface Props {
  statuses: FundStatus[];
  fundConfig: Record<string, FundMeta>;
}

function fedHolidays(year: number): Set<string> {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const obs = (d: Date) => {
    const day = d.getUTCDay();
    if (day === 0) d.setUTCDate(d.getUTCDate() + 1);
    if (day === 6) d.setUTCDate(d.getUTCDate() - 1);
    return d;
  };
  const nth = (y: number, month: number, weekday: number, n: number) => {
    const d = new Date(Date.UTC(y, month, 1));
    let count = 0;
    while (true) {
      if (d.getUTCDay() === weekday && ++count === n) return d;
      d.setUTCDate(d.getUTCDate() + 1);
    }
  };
  const last = (y: number, month: number, weekday: number) => {
    const d = new Date(Date.UTC(y, month + 1, 0));
    while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() - 1);
    return d;
  };
  return new Set([
    fmt(obs(new Date(Date.UTC(year, 0, 1)))),
    fmt(nth(year, 0, 1, 3)),
    fmt(nth(year, 1, 1, 3)),
    fmt(last(year, 4, 1)),
    fmt(obs(new Date(Date.UTC(year, 5, 19)))),
    fmt(obs(new Date(Date.UTC(year, 6, 4)))),
    fmt(nth(year, 8, 1, 1)),
    fmt(nth(year, 9, 1, 2)),
    fmt(obs(new Date(Date.UTC(year, 10, 11)))),
    fmt(nth(year, 10, 4, 4)),
    fmt(obs(new Date(Date.UTC(year, 11, 25)))),
  ]);
}

function nextBusinessDay(d: Date): Date {
  const result = new Date(d);
  let holidays = fedHolidays(result.getUTCFullYear());
  const fmt = (x: Date) => x.toISOString().slice(0, 10);
  while (true) {
    const day = result.getUTCDay();
    if (day !== 0 && day !== 6 && !holidays.has(fmt(result))) break;
    result.setUTCDate(result.getUTCDate() + 1);
    if (result.getUTCFullYear() !== d.getUTCFullYear()) {
      holidays = new Set([...holidays, ...fedHolidays(result.getUTCFullYear())]);
    }
  }
  return result;
}

// 13F: due 45 days after quarter end. N-PORT: due 60 days after quarter end.
// Roll forward past weekends and federal holidays.
function estimatedRelease(asOfDate: string, formType?: string): Date {
  const lagDays = formType === "13F-HR" ? 45 : 60;
  const d = new Date(asOfDate + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 3);
  d.setUTCDate(d.getUTCDate() + lagDays);
  const now = Date.now();
  while (nextBusinessDay(d).getTime() <= now) {
    d.setUTCMonth(d.getUTCMonth() + 3);
  }
  return nextBusinessDay(d);
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
            ? estimatedRelease(status.latestDate, config?.form_type)
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
