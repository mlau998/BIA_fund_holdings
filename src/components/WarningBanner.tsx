"use client";

import { useState, useEffect } from "react";
import { SnapshotWarning } from "@/types";

interface Props {
  warnings: Array<SnapshotWarning & { fund_ticker?: string }>;
}

export default function WarningBanner({ warnings }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = localStorage.getItem("dismissed-notifications");
      if (stored) {
        const arr = JSON.parse(stored) as string[];
        setDismissed(new Set(arr));
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  if (!warnings.length) return null;

  function notifKey(w: SnapshotWarning & { fund_ticker?: string }): string {
    return `${w.fund_ticker ?? ""}|${w.level}|${w.message}`;
  }

  function dismiss(key: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(key);
      try {
        localStorage.setItem("dismissed-notifications", JSON.stringify([...next]));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }

  const errors = warnings.filter((w) => w.level === "error" && !dismissed.has(notifKey(w)));
  const warns = warnings.filter((w) => w.level === "warning" && !dismissed.has(notifKey(w)));

  if (!errors.length && !warns.length) return null;

  return (
    <div className="space-y-2 mb-4">
      {errors.map((w) => {
        const key = notifKey(w);
        return (
          <div
            key={key}
            className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            <span className="mt-0.5 shrink-0 font-bold">ERROR</span>
            {w.fund_ticker && (
              <span className="shrink-0 rounded bg-red-200 px-1.5 py-0.5 text-xs font-mono font-semibold">
                {w.fund_ticker}
              </span>
            )}
            <span>{w.message}</span>
            <button
              onClick={() => dismiss(key)}
              className="ml-auto shrink-0 text-red-500 hover:text-red-700"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        );
      })}
      {warns.map((w) => {
        const key = notifKey(w);
        return (
          <div
            key={key}
            className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800"
          >
            <span className="mt-0.5 shrink-0 font-bold">NOTICE</span>
            {w.fund_ticker && (
              <span className="shrink-0 rounded bg-yellow-200 px-1.5 py-0.5 text-xs font-mono font-semibold">
                {w.fund_ticker}
              </span>
            )}
            <span>{w.message}</span>
            <button
              onClick={() => dismiss(key)}
              className="ml-auto shrink-0 text-yellow-500 hover:text-yellow-700"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
