export interface HoldingRecord {
  security_name: string;
  security_ticker?: string;
  cusip?: string;
  sedol?: string;
  isin?: string;
  shares?: number;
  portfolio_weight?: number;
  market_value?: number;
  holding_key: string;
  // Fund-specific optional fields
  title_of_class?: string;      // TCI 13F titleOfClass
  sector?: string;               // GRNY
  last_price?: number;           // GRNY
  market_price_change?: number;  // GRNY (MarketPriceCh%)
  effective_date?: string;       // MPLY
  asset_group?: string;          // MPLY
  notional_value_pct?: number;   // MPLY (NotionalValue%)
  notional_value?: number;       // MPLY
}

export interface SnapshotWarning {
  level: "error" | "warning";
  message: string;
}

export interface Snapshot {
  fund_name: string;
  fund_ticker: string;
  as_of_date: string;
  source: string;
  source_url: string;
  scrape_timestamp: string;
  warnings: SnapshotWarning[];
  holdings: HoldingRecord[];
}

export interface ErrorSnapshot {
  error: true;
  error_message: string;
  fund_ticker: string;
  scrape_timestamp: string;
}

export type AnySnapshot = Snapshot | ErrorSnapshot;

export function isErrorSnapshot(s: AnySnapshot): s is ErrorSnapshot {
  return (s as ErrorSnapshot).error === true;
}

export interface ChangeResult {
  additions: HoldingRecord[];
  deletions: HoldingRecord[];
  modifications: Array<{ before: HoldingRecord; after: HoldingRecord }>;
}

export interface FundMeta {
  name: string;
  ticker: string;
  description: string;
  website: string;
  type: string;
  dataNote?: string;
}

export interface FundStatus {
  ticker: string;
  latestDate: string | null;
  lastUpdated: string | null;
  hasError: boolean;
  errorMessage?: string;
  warningCount: number;
}
