"use client";

import { SnapshotWarning } from "@/types";

interface Props {
  warnings: Array<SnapshotWarning & { fund_ticker?: string }>;
}

export default function WarningBanner({ warnings }: Props) {
  if (!warnings.length) return null;

  const errors = warnings.filter((w) => w.level === "error");
  const warns = warnings.filter((w) => w.level === "warning");

  return (
    <div className="space-y-2 mb-4">
      {errors.map((w, i) => (
        <div
          key={i}
          className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <span className="mt-0.5 shrink-0 font-bold">ERROR</span>
          {w.fund_ticker && (
            <span className="shrink-0 rounded bg-red-200 px-1.5 py-0.5 text-xs font-mono font-semibold">
              {w.fund_ticker}
            </span>
          )}
          <span>{w.message}</span>
        </div>
      ))}
      {warns.map((w, i) => (
        <div
          key={i}
          className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800"
        >
          <span className="mt-0.5 shrink-0 font-bold">WARN</span>
          {w.fund_ticker && (
            <span className="shrink-0 rounded bg-yellow-200 px-1.5 py-0.5 text-xs font-mono font-semibold">
              {w.fund_ticker}
            </span>
          )}
          <span>{w.message}</span>
        </div>
      ))}
    </div>
  );
}
