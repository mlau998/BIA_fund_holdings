import { NextRequest, NextResponse } from "next/server";
import { listSnapshotDates } from "@/lib/snapshots";
import { ALL_TICKERS } from "@/lib/config";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const fund = searchParams.get("fund")?.toUpperCase();

  if (fund) {
    if (!ALL_TICKERS.includes(fund)) {
      return NextResponse.json({ error: "Unknown fund ticker" }, { status: 400 });
    }
    const dates = listSnapshotDates(fund);
    return NextResponse.json({ fund, dates });
  }

  // Return dates for all funds
  const result: Record<string, string[]> = {};
  for (const ticker of ALL_TICKERS) {
    result[ticker] = listSnapshotDates(ticker);
  }
  return NextResponse.json(result);
}
