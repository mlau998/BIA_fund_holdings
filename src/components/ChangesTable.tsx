"use client";

import { useState } from "react";
import { ChangeResult, HoldingRecord } from "@/types";

function fmtCurrency(val: number | undefined | null): string {
  if (val == null) return "—";
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(2)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  return `$${val.toLocaleString()}`;
}

function fmt(val: number | undefined | null, decimals = 2): string {
  if (val == null) return "—";
  return val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function HoldingRow({ h, highlight }: { h: HoldingRecord; highlight?: "add" | "remove" }) {
  return (
    <tr className={`text-sm ${highlight === "add" ? "bg-green-50" : highlight === "remove" ? "bg-red-50" : "bg-white"}`}>
      <td className="px-3 py-2 font-medium text-gray-900 max-w-xs truncate" title={h.security_name}>
        {h.security_name}
      </td>
      <td className="px-3 py-2 font-mono text-xs">{h.security_ticker || "—"}</td>
      <td className="px-3 py-2 text-right">{h.shares != null ? h.shares.toLocaleString() : "—"}</td>
      <td className="px-3 py-2 text-right">
        {h.portfolio_weight != null ? `${fmt(h.portfolio_weight)}%` : "—"}
      </td>
      <td className="px-3 py-2 text-right">{fmtCurrency(h.market_value)}</td>
    </tr>
  );
}

function SectionHeader({
  label,
  count,
  color,
  open,
  onToggle,
}: {
  label: string;
  count: number;
  color: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between rounded-md px-4 py-2 text-sm font-semibold ${color} transition-colors`}
    >
      <span>
        {label} <span className="font-mono">({count})</span>
      </span>
      <span>{open ? "▲" : "▼"}</span>
    </button>
  );
}

const tableHead = (
  <thead className="bg-gray-50">
    <tr>
      {["Security", "Ticker", "Shares", "Weight %", "Market Value"].map((h) => (
        <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
          {h}
        </th>
      ))}
    </tr>
  </thead>
);

interface Props {
  changes: ChangeResult;
}

export default function ChangesTable({ changes }: Props) {
  const [addOpen, setAddOpen] = useState(true);
  const [rmOpen, setRmOpen] = useState(true);
  const [modOpen, setModOpen] = useState(true);

  return (
    <div className="space-y-4">
      {/* Additions */}
      <div>
        <SectionHeader
          label="Added Holdings"
          count={changes.additions.length}
          color="bg-green-100 text-green-800 hover:bg-green-200"
          open={addOpen}
          onToggle={() => setAddOpen(!addOpen)}
        />
        {addOpen && changes.additions.length > 0 && (
          <div className="mt-1 overflow-x-auto rounded-b-lg border border-green-200">
            <table className="min-w-full divide-y divide-gray-200">
              {tableHead}
              <tbody className="divide-y divide-gray-100">
                {changes.additions.map((h, i) => (
                  <HoldingRow key={i} h={h} highlight="add" />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {addOpen && changes.additions.length === 0 && (
          <p className="mt-1 px-4 py-2 text-sm text-gray-400">No additions</p>
        )}
      </div>

      {/* Removals */}
      <div>
        <SectionHeader
          label="Removed Holdings"
          count={changes.deletions.length}
          color="bg-red-100 text-red-800 hover:bg-red-200"
          open={rmOpen}
          onToggle={() => setRmOpen(!rmOpen)}
        />
        {rmOpen && changes.deletions.length > 0 && (
          <div className="mt-1 overflow-x-auto rounded-b-lg border border-red-200">
            <table className="min-w-full divide-y divide-gray-200">
              {tableHead}
              <tbody className="divide-y divide-gray-100">
                {changes.deletions.map((h, i) => (
                  <HoldingRow key={i} h={h} highlight="remove" />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rmOpen && changes.deletions.length === 0 && (
          <p className="mt-1 px-4 py-2 text-sm text-gray-400">No removals</p>
        )}
      </div>

      {/* Modifications */}
      <div>
        <SectionHeader
          label="Modified Holdings"
          count={changes.modifications.length}
          color="bg-blue-100 text-blue-800 hover:bg-blue-200"
          open={modOpen}
          onToggle={() => setModOpen(!modOpen)}
        />
        {modOpen && changes.modifications.length > 0 && (
          <div className="mt-1 overflow-x-auto rounded-b-lg border border-blue-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Security", "Ticker", "Shares (Before→After)", "Weight % (Before→After)", "Value (Before→After)"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {changes.modifications.map(({ before, after }, i) => (
                  <tr key={i} className="hover:bg-blue-50">
                    <td className="px-3 py-2 font-medium text-gray-900 max-w-xs truncate" title={after.security_name}>
                      {after.security_name}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{after.security_ticker || "—"}</td>
                    <td className="px-3 py-2 text-right text-xs">
                      {before.shares != null ? before.shares.toLocaleString() : "—"}
                      {" → "}
                      {after.shares != null ? after.shares.toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      {before.portfolio_weight != null ? `${fmt(before.portfolio_weight)}%` : "—"}
                      {" → "}
                      {after.portfolio_weight != null ? `${fmt(after.portfolio_weight)}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      {fmtCurrency(before.market_value)}
                      {" → "}
                      {fmtCurrency(after.market_value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {modOpen && changes.modifications.length === 0 && (
          <p className="mt-1 px-4 py-2 text-sm text-gray-400">No modifications</p>
        )}
      </div>
    </div>
  );
}
