"use client";

import Link from "next/link";
import { FundMeta, FundStatus } from "@/types";

interface Props {
  statuses: FundStatus[];
  fundConfig: Record<string, FundMeta>;
}

/** Next expected filing date = quarter end (as_of_date + 3 months) + filing window */
function nextFilingDeadline(asOfDate: string, formType?: string): Date {
  const d = new Date(asOfDate + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 3);
  // N-PORT: 60 days after quarter end; 13F-HR: 45 days
  d.setUTCDate(d.getUTCDate() + (formType === "13F-HR" ? 45 : 60));
  return d;
}

function countdownLabel(deadline: Date): string {
  const diffMs = deadline.getTime() - Date.now();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (days < 0) return "overdue";
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `in ${days}d`;
}

export default function StatusPanel({ statuses, fundConfig }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {statuses.map((status) => {
        const config = fundConfig[status.ticker];
        const deadline =
          status.latestDate && !status.hasError
            ? nextFilingDeadline(status.latestDate, config?.form_type)
            : null;
        const daysLabel = deadline ? countdownLabel(deadline) : null;
        const isOverdue = deadline && deadline.getTime() < Date.now();

        return (
          <Link
            key={status.ticker}
            href={`/fund/${status.ticker}`}
            className={`block rounded-lg border p-3 transition-shadow hover:shadow-md ${
              status.hasError
                ? "border-red-300 bg-red-50"
                : status.warningCount > 0
                ? "border-yellow-300 bg-yellow-50"
                : "border-green-300 bg-green-50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-bold text-gray-800">
                {status.ticker}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  status.hasError
                    ? "bg-red-200 text-red-800"
                    : status.warningCount > 0
                    ? "bg-yellow-200 text-yellow-800"
                    : "bg-green-200 text-green-800"
                }`}
              >
                {status.hasError
                  ? "Error"
                  : status.warningCount > 0
                  ? `${status.warningCount} notice`
                  : "OK"}
              </span>
            </div>

            <p className="mt-1 text-xs text-gray-500 truncate">{config?.name}</p>

            {status.hasError ? (
              <p className="mt-1 text-xs text-red-700 truncate" title={status.errorMessage}>
                {status.errorMessage}
              </p>
            ) : (
              <p className="mt-1 text-xs text-gray-600">
                {status.latestDate ? `As of ${status.latestDate}` : "No data"}
              </p>
            )}

            {deadline && (
              <p className={`mt-1 text-xs ${isOverdue ? "text-orange-600 font-medium" : "text-gray-400"}`}>
                Next update {daysLabel}
                <span className="ml-1 text-gray-300">
                  ({deadline.toLocaleDateString("en-US", { month: "short", day: "numeric" })})
                </span>
              </p>
            )}
          </Link>
        );
      })}
    </div>
  );
}
