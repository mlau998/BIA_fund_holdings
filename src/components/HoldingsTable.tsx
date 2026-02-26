"use client";

import { useState } from "react";
import { HoldingRecord } from "@/types";

type SortKey = keyof HoldingRecord | "fund_ticker" | "as_of_date";
type SortDir = "asc" | "desc";

interface HoldingRow extends HoldingRecord {
  fund_ticker?: string;
  as_of_date?: string;
}

interface Props {
  holdings: HoldingRow[];
  showFund?: boolean;
  showExtraColumns?: boolean;
}

function hasAny(rows: HoldingRow[], key: keyof HoldingRow): boolean {
  return rows.some((r) => r[key] != null && r[key] !== "");
}

function fmt(val: number | undefined | null, decimals = 2): string {
  if (val == null) return "—";
  return val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtCurrency(val: number | undefined | null): string {
  if (val == null) return "—";
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(2)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  return `$${val.toLocaleString()}`;
}

export default function HoldingsTable({ holdings, showFund = true, showExtraColumns = false }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("portfolio_weight");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const showCusip = showExtraColumns && hasAny(holdings, "cusip");
  const showSedol = showExtraColumns && hasAny(holdings, "sedol");
  const showIsin = showExtraColumns && hasAny(holdings, "isin");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = [...holdings].sort((a, b) => {
    const aVal = a[sortKey as keyof HoldingRow];
    const bVal = b[sortKey as keyof HoldingRow];
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
            {showFund && <Th col="fund_ticker" label="Fund" />}
            <Th col="security_name" label="Security" />
            <Th col="security_ticker" label="Ticker" />
            {showCusip && <Th col="cusip" label="CUSIP" />}
            {showSedol && <Th col="sedol" label="SEDOL" />}
            {showIsin && <Th col="isin" label="ISIN" />}
            <Th col="shares" label="Shares" />
            <Th col="portfolio_weight" label="Weight %" />
            <Th col="market_value" label="Market Value" />
            {showFund && <Th col="as_of_date" label="As of Date" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {sorted.map((h, i) => (
            <tr key={i} className="hover:bg-gray-50 transition-colors">
              {showFund && (
                <td className="px-3 py-2 font-mono text-xs font-semibold text-blue-700">
                  {h.fund_ticker}
                </td>
              )}
              <td className="px-3 py-2 font-medium text-gray-900 max-w-xs truncate" title={h.security_name}>
                {h.security_name}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-gray-600">
                {h.security_ticker || "—"}
              </td>
              {showCusip && (
                <td className="px-3 py-2 font-mono text-xs text-gray-500">{h.cusip || "—"}</td>
              )}
              {showSedol && (
                <td className="px-3 py-2 font-mono text-xs text-gray-500">{h.sedol || "—"}</td>
              )}
              {showIsin && (
                <td className="px-3 py-2 font-mono text-xs text-gray-500">{h.isin || "—"}</td>
              )}
              <td className="px-3 py-2 text-right text-gray-700">
                {h.shares != null ? h.shares.toLocaleString() : "—"}
              </td>
              <td className="px-3 py-2 text-right text-gray-700">
                {h.portfolio_weight != null ? `${fmt(h.portfolio_weight)}%` : "—"}
              </td>
              <td className="px-3 py-2 text-right text-gray-700">
                {fmtCurrency(h.market_value)}
              </td>
              {showFund && (
                <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">
                  {h.as_of_date}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
