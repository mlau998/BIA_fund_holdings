import { Redis } from "@upstash/redis";
import { FundMeta } from "@/types";
import { STATIC_FUND_CONFIG } from "./config";

const redis = Redis.fromEnv();

const KV_KEY = "funds:config";

export async function getFunds(): Promise<FundMeta[]> {
  try {
    const stored = await redis.get<FundMeta[]>(KV_KEY);
    if (stored && stored.length > 0) return stored;
  } catch (e) {
    console.error("KV read failed, falling back to static config:", e);
  }
  // First use or KV unavailable — seed from static config and return it
  const seed = Object.values(STATIC_FUND_CONFIG);
  try {
    await redis.set(KV_KEY, seed);
  } catch {
    // Seed failed silently — read-only token or network issue; static fallback is fine
  }
  return seed;
}

export async function getFundConfig(): Promise<Record<string, FundMeta>> {
  const funds = await getFunds();
  return Object.fromEntries(funds.map((f) => [f.ticker, f]));
}

export async function addFund(fund: FundMeta): Promise<void> {
  const funds = await getFunds();
  if (funds.find((f) => f.ticker === fund.ticker)) {
    throw new Error(`Fund ${fund.ticker} already exists`);
  }
  await redis.set(KV_KEY, [...funds, fund]);
}
