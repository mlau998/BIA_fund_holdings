"use client";

import { useState, useEffect } from "react";
import { ALL_TICKERS } from "@/lib/config";
import ChangesTable from "@/components/ChangesTable";
import { ChangeResult } from "@/types";

interface Props {
  defaultFund: string;
  snapshotDatesByFund: Record<string, string[]>;
}

export default function ChangesPageClient({ defaultFund, snapshotDatesByFund }: Props) {
  const [fund, setFund] = useState(defaultFund);
  const [date1, setDate1] = useState("");
  const [date2, setDate2] = useState("");
  const [loading, setLoading] = useState(false);
  const [changes, setChanges] = useState<ChangeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ additions: number; deletions: number; modifications: number } | null>(null);

  const dates = snapshotDatesByFund[fund] || [];

  // When fund changes, set defaults to latest two dates
  useEffect(() => {
    const d = snapshotDatesByFund[fund] || [];
    if (d.length >= 2) {
      setDate1(d[1]); // older
      setDate2(d[0]); // newer
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
      const resp = await fetch(
        `/api/changes?fund=${fund}&date1=${date1}&date2=${date2}`
      );
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

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          {/* Fund selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Fund</label>
            <select
              value={fund}
              onChange={(e) => setFund(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ALL_TICKERS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Date 1 (older) */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">From (older)</label>
            <select
              value={date1}
              onChange={(e) => setDate1(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={dates.length === 0}
            >
              {dates.length === 0 && <option value="">No snapshots</option>}
              {dates.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Date 2 (newer) */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">To (newer)</label>
            <select
              value={date2}
              onChange={(e) => setDate2(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Loading…" : "Compare"}
          </button>
        </div>

        {dates.length < 2 && (
          <p className="mt-2 text-xs text-amber-700">
            {dates.length === 0
              ? "No snapshots available for this fund. Run a scrape first."
              : "Only 1 snapshot available. Need at least 2 to compare."}
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="flex gap-4">
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-center">
            <div className="text-2xl font-bold text-green-700">{summary.additions}</div>
            <div className="text-xs text-green-600 font-medium">Added</div>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center">
            <div className="text-2xl font-bold text-red-700">{summary.deletions}</div>
            <div className="text-xs text-red-600 font-medium">Removed</div>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-center">
            <div className="text-2xl font-bold text-blue-700">{summary.modifications}</div>
            <div className="text-xs text-blue-600 font-medium">Modified</div>
          </div>
        </div>
      )}

      {/* Changes tables */}
      {changes && <ChangesTable changes={changes} />}

      {!changes && !error && !loading && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 py-12 text-center text-gray-400 text-sm">
          Select two dates and click Compare to see holdings changes
        </div>
      )}
    </div>
  );
}
