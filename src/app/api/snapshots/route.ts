import { NextRequest, NextResponse } from "next/server";
import { listSnapshotDates } from "@/lib/snapshots";
import { getFunds } from "@/lib/kv";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const fund = searchParams.get("fund")?.toUpperCase();

  const allFunds = await getFunds();
  const allTickers = allFunds.map((f) => f.ticker);

  if (fund) {
    if (!allTickers.includes(fund)) {
      return NextResponse.json({ error: "Unknown fund ticker" }, { status: 400 });
    }
    const dates = listSnapshotDates(fund);
    return NextResponse.json({ fund, dates });
  }

  const result: Record<string, string[]> = {};
  for (const ticker of allTickers) {
    result[ticker] = listSnapshotDates(ticker);
  }
  return NextResponse.json(result);
}
