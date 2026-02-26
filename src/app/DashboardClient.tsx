"use client";

import { useState, useMemo } from "react";
import { ALL_TICKERS } from "@/lib/config";
import FundFilter from "@/components/FundFilter";
import HoldingsTable from "@/components/HoldingsTable";
import RefreshButton from "@/components/RefreshButton";

interface HoldingRow {
  security_name: string;
  security_ticker?: string;
  shares?: number;
  portfolio_weight?: number;
  market_value?: number;
  holding_key: string;
  fund_ticker: string;
  as_of_date: string;
}

interface Props {
  initialHoldings: HoldingRow[];
}

export default function DashboardClient({ initialHoldings }: Props) {
  const [selectedFunds, setSelectedFunds] = useState<string[]>(ALL_TICKERS);
  const [nameSearch, setNameSearch] = useState("");
  const [tickerSearch, setTickerSearch] = useState("");

  const filtered = useMemo(() => {
    return initialHoldings.filter((h) => {
      if (!selectedFunds.includes(h.fund_ticker)) return false;
      if (nameSearch && !h.security_name.toLowerCase().includes(nameSearch.toLowerCase())) return false;
      if (tickerSearch && !(h.security_ticker || "").toLowerCase().includes(tickerSearch.toLowerCase())) return false;
      return true;
    });
  }, [initialHoldings, selectedFunds, nameSearch, tickerSearch]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <RefreshButton onRefreshComplete={() => window.location.reload()} />
        <FundFilter selected={selectedFunds} onChange={setSelectedFunds} />
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by name..."
          value={nameSearch}
          onChange={(e) => setNameSearch(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
        />
        <input
          type="text"
          placeholder="Search by ticker..."
          value={tickerSearch}
          onChange={(e) => setTickerSearch(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
        />
        <span className="self-center text-xs text-gray-400">
          {filtered.length} holdings
        </span>
      </div>

      <HoldingsTable holdings={filtered} showFund={true} />
    </div>
  );
}
