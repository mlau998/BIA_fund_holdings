"use client";

import { useState } from "react";
import { HoldingRecord } from "@/types";

type SortKey = keyof HoldingRecord;
type SortDir = "asc" | "desc";

interface Props {
  holdings: HoldingRecord[];
}

function fmt(val: number | undefined | null, decimals = 2): string {
  if (val == null) return "—";
  return val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtCurrencyWhole(val: number | undefined | null): string {
  if (val == null) return "—";
  return `$${Math.round(val).toLocaleString()}`;
}

export default function MPLYHoldingsTable({ holdings }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("portfolio_weight");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = [...holdings].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    const cmp =
      typeof aVal === "number" && typeof bVal === "number"
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal));
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="ml-1 text-xs opacity-50">
      {sortKey === col ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );

  const Th = ({ col, label }: { col: SortKey; label: string }) => (
    <th
      className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 cursor-pointer hover:text-gray-900 whitespace-nowrap select-none"
      onClick={() => handleSort(col)}
    >
      {label}
      <SortIcon col={col} />
    </th>
  );

  if (holdings.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 py-12 text-center text-gray-400">
        No holdings found
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <Th col="security_name" label="Security Name" />
            <Th col="security_ticker" label="Ticker" />
            <Th col="market_value" label="Market Value" />
            <Th col="shares" label="Shares" />
            <Th col="asset_group" label="Asset Group" />
            <Th col="portfolio_weight" label="Wt% (Mkt)" />
            <Th col="notional_value_pct" label="Notional Wt%" />
            <Th col="notional_value" label="Notional Value" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {sorted.map((h, i) => (
            <tr key={i} className="hover:bg-gray-50 transition-colors">
              <td className="px-3 py-2 font-medium text-gray-900 max-w-xs truncate" title={h.security_name}>
                {h.security_name}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-gray-600">
                {h.security_ticker || "—"}
              </td>
              <td className="px-3 py-2 text-right text-gray-700">
                {fmtCurrencyWhole(h.market_value)}
              </td>
              <td className="px-3 py-2 text-right text-gray-700">
                {h.shares != null ? h.shares.toLocaleString() : "—"}
              </td>
              <td className="px-3 py-2 text-gray-700">
                {h.asset_group || "—"}
              </td>
              <td className="px-3 py-2 text-right text-gray-700">
                {h.portfolio_weight != null ? `${fmt(h.portfolio_weight)}%` : "—"}
              </td>
              <td className="px-3 py-2 text-right text-gray-700">
                {h.notional_value_pct != null ? `${fmt(h.notional_value_pct)}%` : "—"}
              </td>
              <td className="px-3 py-2 text-right text-gray-700">
                {fmtCurrencyWhole(h.notional_value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
