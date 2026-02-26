import { NextRequest, NextResponse } from "next/server";
import { readSnapshot } from "@/lib/snapshots";
import { computeChanges } from "@/lib/diff";
import { isErrorSnapshot } from "@/types";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const fund = searchParams.get("fund")?.toUpperCase();
  const date1 = searchParams.get("date1");
  const date2 = searchParams.get("date2");

  if (!fund || !date1 || !date2) {
    return NextResponse.json(
      { error: "Required params: fund, date1, date2" },
      { status: 400 }
    );
  }

  const snap1 = readSnapshot(fund, date1);
  const snap2 = readSnapshot(fund, date2);

  if (!snap1) return NextResponse.json({ error: `Snapshot not found: ${fund}/${date1}` }, { status: 404 });
  if (!snap2) return NextResponse.json({ error: `Snapshot not found: ${fund}/${date2}` }, { status: 404 });

  if (isErrorSnapshot(snap1)) return NextResponse.json({ error: `Snapshot ${date1} is an error snapshot` }, { status: 422 });
  if (isErrorSnapshot(snap2)) return NextResponse.json({ error: `Snapshot ${date2} is an error snapshot` }, { status: 422 });

  const changes = computeChanges(snap1, snap2);
  return NextResponse.json({
    fund,
    date1,
    date2,
    summary: {
      additions: changes.additions.length,
      deletions: changes.deletions.length,
      modifications: changes.modifications.length,
    },
    ...changes,
  });
}
