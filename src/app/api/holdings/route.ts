import { NextRequest, NextResponse } from "next/server";
import { ALL_TICKERS } from "@/lib/config";
import { readLatestSnapshot } from "@/lib/snapshots";
import { isErrorSnapshot, HoldingRecord } from "@/types";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const fundsParam = searchParams.get("funds");
  const search = (searchParams.get("search") || "").toLowerCase();
  const tickerSearch = (searchParams.get("ticker") || "").toLowerCase();

  const tickers = fundsParam
    ? fundsParam.split(",").map((t) => t.trim().toUpperCase())
    : ALL_TICKERS;

  const result: Array<HoldingRecord & { fund_ticker: string; as_of_date: string }> = [];

  for (const ticker of tickers) {
    const snapshot = readLatestSnapshot(ticker);
    if (!snapshot || isErrorSnapshot(snapshot)) continue;

    for (const holding of snapshot.holdings) {
      const nameMatch = !search || holding.security_name.toLowerCase().includes(search);
      const tickerMatch =
        !tickerSearch ||
        (holding.security_ticker || "").toLowerCase().includes(tickerSearch);
      if (nameMatch && tickerMatch) {
        result.push({
          ...holding,
          fund_ticker: snapshot.fund_ticker,
          as_of_date: snapshot.as_of_date,
        });
      }
    }
  }

  return NextResponse.json({ holdings: result, count: result.length });
}
