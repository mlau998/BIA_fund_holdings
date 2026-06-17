"use client";

import { useState, useMemo } from "react";
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
  tickers: string[];
}

export default function DashboardClient({ initialHoldings, tickers }: Props) {
  const [selectedFund, setSelectedFund] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialHoldings.filter((h) => {
      if (selectedFund !== "ALL" && h.fund_ticker !== selectedFund) return false;
      if (
        q &&
        !h.security_name.toLowerCase().includes(q) &&
        !(h.security_ticker || "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [initialHoldings, selectedFund, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <RefreshButton onRefreshComplete={() => window.location.reload()} />
      </div>

      <div className="bg-white border border-[#E4DECF] rounded-[16px] overflow-hidden">
        {/* Filter + search bar */}
        <div className="px-5 py-4 border-b border-[#EAE4D7] flex items-center gap-4 flex-wrap">
          <FundFilter tickers={tickers} selected={selectedFund} onChange={setSelectedFund} />
          <div className="ml-auto flex items-center gap-3">
            <div className="relative">
              <span className="absolute left-[11px] top-1/2 -translate-y-1/2 text-[#B3AB97] text-[13px] pointer-events-none select-none">
                ⌕
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or ticker…"
                className="text-[13.5px] text-[#211C13] bg-[#F5F1E8] border border-[#E4DECF] rounded-[9px] py-2 pl-[30px] pr-3 w-[230px] outline-none focus:border-[#1F3D63] transition-colors"
              />
            </div>
            <span className="font-mono text-[12.5px] text-[#A39A86] whitespace-nowrap">
              {filtered.length} shown
            </span>
          </div>
        </div>

        <HoldingsTable holdings={filtered} showFund borderless />
      </div>
    </div>
  );
}
