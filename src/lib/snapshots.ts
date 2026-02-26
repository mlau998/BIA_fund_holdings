import fs from "fs";
import path from "path";
import { AnySnapshot, Snapshot, ErrorSnapshot, isErrorSnapshot, FundStatus } from "@/types";

const SNAPSHOTS_DIR = path.join(process.cwd(), "data", "snapshots");

export function listSnapshotDates(ticker: string): string[] {
  const dir = path.join(SNAPSHOTS_DIR, ticker.toUpperCase());
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""))
    .sort()
    .reverse();
}

export function readSnapshot(ticker: string, date: string): AnySnapshot | null {
  const file = path.join(SNAPSHOTS_DIR, ticker.toUpperCase(), `${date}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = fs.readFileSync(file, "utf-8");
    return JSON.parse(raw) as AnySnapshot;
  } catch {
    return null;
  }
}

export function readLatestSnapshot(ticker: string): AnySnapshot | null {
  const dates = listSnapshotDates(ticker);
  if (dates.length === 0) return null;
  return readSnapshot(ticker, dates[0]);
}

export function getFundStatus(ticker: string): FundStatus {
  const dates = listSnapshotDates(ticker);
  if (dates.length === 0) {
    return {
      ticker,
      latestDate: null,
      lastUpdated: null,
      hasError: false,
      warningCount: 0,
    };
  }

  const latest = readSnapshot(ticker, dates[0]);
  if (!latest) {
    return { ticker, latestDate: dates[0], lastUpdated: null, hasError: true, errorMessage: "Could not read snapshot", warningCount: 0 };
  }

  if (isErrorSnapshot(latest)) {
    return {
      ticker,
      latestDate: dates[0],
      lastUpdated: latest.scrape_timestamp,
      hasError: true,
      errorMessage: latest.error_message,
      warningCount: 0,
    };
  }

  const snap = latest as Snapshot;
  return {
    ticker,
    latestDate: snap.as_of_date,
    lastUpdated: snap.scrape_timestamp,
    hasError: false,
    warningCount: snap.warnings?.length ?? 0,
  };
}
