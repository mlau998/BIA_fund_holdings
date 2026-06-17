"use client";

import { useState, useEffect } from "react";
import ChangesTable from "@/components/ChangesTable";
import { ChangeResult } from "@/types";

interface Props {
  defaultFund: string;
  snapshotDatesByFund: Record<string, string[]>;
  tickers: string[];
}

export default function ChangesPageClient({ defaultFund, snapshotDatesByFund, tickers }: Props) {
  const [fund, setFund] = useState(defaultFund);
  const [date1, setDate1] = useState("");
  const [date2, setDate2] = useState("");
  const [loading, setLoading] = useState(false);
  const [changes, setChanges] = useState<ChangeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    additions: number;
    deletions: number;
    modifications: number;
  } | null>(null);

  const dates = snapshotDatesByFund[fund] || [];

  useEffect(() => {
    const d = snapshotDatesByFund[fund] || [];
    if (d.length >= 2) {
      setDate1(d[1]);
      setDate2(d[0]);
    } else if (d.length === 1) {
      setDate1(d[0]);
      setDate2(d[0]);
    } else {
      setDate1("");
      setDate2("");
    }
    setChanges(null);
    setError(null);
    setSummary(null);
  }, [fund, snapshotDatesByFund]);

  const handleCompare = async () => {
    if (!date1 || !date2 || date1 === date2) {
      setError("Please select two different dates to compare.");
      return;
    }
    setLoading(true);
    setError(null);
    setChanges(null);
    setSummary(null);

    try {
      const resp = await fetch(`/api/changes?fund=${fund}&date1=${date1}&date2=${date2}`);
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || "Failed to load changes");
      } else {
        setChanges({
          additions: data.additions,
          deletions: data.deletions,
          modifications: data.modifications,
        });
        setSummary(data.summary);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const selectCls =
    "font-mono text-[14px] bg-[#F5F1E8] border border-[#E4DECF] rounded-[9px] px-[14px] py-[9px] text-[#211C13] outline-none focus:border-[#1F3D63] transition-colors";

  return (
    <div className="space-y-[18px]">
      {/* Controls */}
      <div className="bg-white border border-[#E4DECF] rounded-[14px] p-[16px_18px] flex items-end gap-[18px] flex-wrap">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold tracking-[0.05em] text-[#A39A86] uppercase">
            Fund
          </label>
          <select
            value={fund}
            onChange={(e) => setFund(e.target.value)}
            className={selectCls}
          >
            {tickers.map((t: string) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold tracking-[0.05em] text-[#A39A86] uppercase">
            From (older)
          </label>
          <select
            value={date1}
            onChange={(e) => setDate1(e.target.value)}
            className={selectCls}
            disabled={dates.length === 0}
          >
            {dates.length === 0 && <option value="">No snapshots</option>}
            {dates.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold tracking-[0.05em] text-[#A39A86] uppercase">
            To (newer)
          </label>
          <select
            value={date2}
            onChange={(e) => setDate2(e.target.value)}
            className={selectCls}
            disabled={dates.length === 0}
          >
            {dates.length === 0 && <option value="">No snapshots</option>}
            {dates.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleCompare}
          disabled={loading || !date1 || !date2}
          className="rounded-[9px] bg-[#211C13] px-5 py-[10px] text-[13.5px] font-semibold text-white hover:bg-[#2C261B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Loading…" : "Compare"}
        </button>

        {dates.length < 2 && (
          <p className="w-full text-xs text-[#B45309] mt-0">
            {dates.length === 0
              ? "No snapshots available for this fund. Run a scrape first."
              : "Only 1 snapshot available. Need at least 2 to compare."}
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-[12px] border border-[#F0DAD7] bg-[#FBF0EF] px-4 py-3 text-sm text-[#C23B30]">
          {error}
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-[14px]">
          <div
            className="bg-white border border-[#E4DECF] rounded-[13px] p-[16px_18px]"
            style={{ borderLeft: "3px solid #16A06A" }}
          >
            <div className="text-[11px] font-semibold tracking-[0.05em] text-[#A39A86] uppercase">
              Added
            </div>
            <div className="mt-1.5 font-mono text-[28px] font-bold text-[#0E7C4A]">
              {summary.additions}
            </div>
            <div className="mt-0.5 font-mono text-[12.5px] text-[#8A8170]">new positions</div>
          </div>
          <div
            className="bg-white border border-[#E4DECF] rounded-[13px] p-[16px_18px]"
            style={{ borderLeft: "3px solid #D5564B" }}
          >
            <div className="text-[11px] font-semibold tracking-[0.05em] text-[#A39A86] uppercase">
              Removed
            </div>
            <div className="mt-1.5 font-mono text-[28px] font-bold text-[#C23B30]">
              {summary.deletions}
            </div>
            <div className="mt-0.5 font-mono text-[12.5px] text-[#8A8170]">exited positions</div>
          </div>
          <div
            className="bg-white border border-[#E4DECF] rounded-[13px] p-[16px_18px]"
            style={{ borderLeft: "3px solid #1F3D63" }}
          >
            <div className="text-[11px] font-semibold tracking-[0.05em] text-[#A39A86] uppercase">
              Modified
            </div>
            <div className="mt-1.5 font-mono text-[28px] font-bold text-[#1F3D63]">
              {summary.modifications}
            </div>
            <div className="mt-0.5 font-mono text-[12.5px] text-[#8A8170]">re-weighted</div>
          </div>
        </div>
      )}

      {/* Changes tables */}
      {changes && <ChangesTable changes={changes} />}

      {!changes && !error && !loading && (
        <div className="rounded-[14px] border border-[#E4DECF] bg-white py-12 text-center text-[#A39A86] text-sm">
          Select two dates and click Compare to see holdings changes
        </div>
      )}
    </div>
  );
}
