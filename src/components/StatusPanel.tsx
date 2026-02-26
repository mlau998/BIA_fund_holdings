"use client";

import { FundStatus } from "@/types";
import { FUND_CONFIG } from "@/lib/config";

interface Props {
  statuses: FundStatus[];
}

export default function StatusPanel({ statuses }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {statuses.map((status) => {
        const config = FUND_CONFIG[status.ticker];
        return (
          <div
            key={status.ticker}
            className={`rounded-lg border p-3 ${
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
            {status.lastUpdated && (
              <p className="text-xs text-gray-400 truncate">
                Updated: {new Date(status.lastUpdated).toLocaleString()}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
