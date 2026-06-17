"use client";

import { useState } from "react";
import { HoldingRecord } from "@/types";
import { toTitleCase } from "@/lib/utils";

type SortKey = keyof HoldingRecord | "fund_ticker" | "as_of_date";
type SortDir = "asc" | "desc";

interface HoldingRow extends HoldingRecord {
  fund_ticker?: string;
  as_of_date?: string;
}

interface Props {
  holdings: HoldingRow[];
  showFund?: boolean;
  fundTicker?: string;
  borderless?: boolean;
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
  if (val >= 1_000) return `$${(val / 1_000).toFixed(2)}K`;
  return `$${val.toLocaleString()}`;
}

function fmtCurrencyWhole(val: number | undefined | null): string {
  if (val == null) return "—";
  return `$${Math.round(val).toLocaleString()}`;
}

export default function HoldingsTable({
  holdings,
  showFund = true,
  fundTicker,
  borderless = false,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>(() => showFund ? "fund_ticker" : "portfolio_weight");
  const [sortDir, setSortDir] = useState<SortDir>(() => showFund ? "asc" : "desc");

  const showTitleOfClass = fundTicker === "TCI" && hasAny(holdings, "title_of_class");
  const showGrnyCols =
    fundTicker === "GRNY" &&
    (hasAny(holdings, "sector") ||
      hasAny(holdings, "last_price") ||
      hasAny(holdings, "market_price_change"));

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
    <span className="ml-1 text-xs opacity-40">
      {sortKey === col ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );

  const thCls =
    "px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#A39A86] cursor-pointer hover:text-[#211C13] whitespace-nowrap select-none";

  const Th = ({ col, label, right }: { col: SortKey; label: string; right?: boolean }) => (
    <th className={`${thCls} ${right ? "text-right" : ""}`} onClick={() => handleSort(col)}>
      {label}
      <SortIcon col={col} />
    </th>
  );

  const useWholeDollar =
    fundTicker === "IVES" ||
    fundTicker === "GRNY" ||
    fundTicker === "TCI" ||
    fundTicker === "MPLY";

  if (holdings.length === 0) {
    return (
      <div className={`py-12 text-center text-[#A39A86] text-sm ${!borderless ? "rounded-[14px] border border-[#E4DECF] bg-white" : ""}`}>
        No holdings found
      </div>
    );
  }

  const table = (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="border-b border-[#EAE4D7]">
          <tr>
            {showFund && <Th col="fund_ticker" label="Fund" />}
            <Th col="security_name" label="Security" />
            <Th col="security_ticker" label="Ticker" />
            <Th col="shares" label="Shares" right />
            {showTitleOfClass && <Th col="title_of_class" label="Title of Class" />}
            <Th col="market_value" label="Market Value" right />
            <Th col="portfolio_weight" label="Weight %" right />
            {showGrnyCols && (
              <>
                <Th col="sector" label="Sector" />
                <Th col="last_price" label="Last Price" right />
                <Th col="market_price_change" label="Price Chg %" right />
              </>
            )}
            {showFund && <Th col="as_of_date" label="As of Date" />}
          </tr>
        </thead>
        <tbody>
          {sorted.map((h, i) => (
            <tr key={i} className="border-b border-[#F0EBE0] last:border-0 hover:bg-[#F7F3EA] transition-colors">
              {showFund && (
                <td className="px-5 py-[13px]">
                  <span className="font-mono text-[11.5px] font-semibold text-[#1F3D63] bg-[#E5EAF1] px-[6px] py-[3px] rounded-[5px]">
                    {h.fund_ticker}
                  </span>
                </td>
              )}
              <td
                className="px-5 py-[13px] text-[13.5px] font-medium text-[#2C261B] max-w-xs truncate"
                title={toTitleCase(h.security_name)}
              >
                {toTitleCase(h.security_name)}
              </td>
              <td className="px-5 py-[13px] font-mono text-[12.5px] text-[#8A8170]">
                {h.security_ticker || "—"}
              </td>
              <td className="px-5 py-[13px] font-mono text-[13px] text-right text-[#2C261B]">
                {h.shares != null ? h.shares.toLocaleString() : "—"}
              </td>
              {showTitleOfClass && (
                <td className="px-5 py-[13px] text-xs text-[#7C7563]">{h.title_of_class || "—"}</td>
              )}
              <td className="px-5 py-[13px] font-mono text-[13px] text-right text-[#2C261B]">
                {useWholeDollar ? fmtCurrencyWhole(h.market_value) : fmtCurrency(h.market_value)}
              </td>
              <td className="px-5 py-[13px] font-mono text-[13px] font-semibold text-[#211C13] text-right">
                {h.portfolio_weight != null ? `${fmt(h.portfolio_weight)}%` : "—"}
              </td>
              {showGrnyCols && (
                <>
                  <td className="px-5 py-[13px] text-[#7C7563]">{h.sector || "—"}</td>
                  <td className="px-5 py-[13px] font-mono text-[13px] text-right text-[#2C261B]">
                    {h.last_price != null ? `$${h.last_price.toLocaleString()}` : "—"}
                  </td>
                  <td
                    className={`px-5 py-[13px] font-mono text-[13px] text-right font-medium ${
                      h.market_price_change != null && h.market_price_change < 0
                        ? "text-[#C23B30]"
                        : h.market_price_change != null && h.market_price_change > 0
                        ? "text-[#0E7C4A]"
                        : "text-[#2C261B]"
                    }`}
                  >
                    {h.market_price_change != null ? `${fmt(h.market_price_change)}%` : "—"}
                  </td>
                </>
              )}
              {showFund && (
                <td className="px-5 py-[13px] font-mono text-xs text-[#A39A86] whitespace-nowrap">
                  {h.as_of_date}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (borderless) return table;

  return (
    <div className="overflow-hidden rounded-[14px] border border-[#E4DECF] bg-white">
      {table}
    </div>
  );
}
