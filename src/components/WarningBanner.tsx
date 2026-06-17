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
            className="flex items-start gap-2 rounded-[12px] border border-[#F0DAD7] bg-[#FBF0EF] px-4 py-3 text-sm text-[#C23B30]"
          >
            <span className="mt-0.5 shrink-0 font-bold text-[11px] tracking-wide uppercase">Error</span>
            {w.fund_ticker && (
              <span className="shrink-0 rounded-[5px] bg-[#FBECEA] border border-[#F0DAD7] px-1.5 py-0.5 text-xs font-mono font-semibold">
                {w.fund_ticker}
              </span>
            )}
            <span>{w.message}</span>
            <button
              onClick={() => dismiss(key)}
              className="ml-auto shrink-0 text-[#C08A84] hover:text-[#C23B30] transition-colors"
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
            className="flex items-start gap-2 rounded-[12px] border border-[#F5E8C0] bg-[#FFFBEB] px-4 py-3 text-sm text-[#B45309]"
          >
            <span className="mt-0.5 shrink-0 font-bold text-[11px] tracking-wide uppercase">Notice</span>
            {w.fund_ticker && (
              <span className="shrink-0 rounded-[5px] bg-[#FEF3DC] border border-[#F5E8C0] px-1.5 py-0.5 text-xs font-mono font-semibold">
                {w.fund_ticker}
              </span>
            )}
            <span>{w.message}</span>
            <button
              onClick={() => dismiss(key)}
              className="ml-auto shrink-0 text-[#D4A455] hover:text-[#B45309] transition-colors"
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
