import { NextRequest, NextResponse } from "next/server";
import { getFunds, addFund } from "@/lib/kv";
import { FundMeta } from "@/types";

export async function GET() {
  const funds = await getFunds();
  return NextResponse.json({ funds });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { password, ...fund } = body as { password: string } & FundMeta;

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const required = ["ticker", "name", "cik", "form_type"] as const;
  for (const field of required) {
    if (!fund[field]) {
      return NextResponse.json(
        { error: `Missing required field: ${field}` },
        { status: 400 }
      );
    }
  }

  fund.ticker = fund.ticker.toUpperCase();

  try {
    await addFund(fund);
    return NextResponse.json({ success: true, fund });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
