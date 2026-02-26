import { FundMeta } from "@/types";

export const FUND_CONFIG: Record<string, FundMeta> = {
  GRNY: {
    name: "Fundstrat Granny Shots US Large Cap ETF",
    ticker: "GRNY",
    description:
      "Rules-based large-cap ETF selecting 'Granny Shots' — stocks with multi-year, multi-thematic institutional conviction.",
    website: "https://grannyshots.com/holdings/",
    type: "ETF",
  },
  IVES: {
    name: "Dan Ives Wedbush AI Revolution ETF",
    ticker: "IVES",
    description:
      "Actively managed ETF focusing on AI-driven technology companies, curated by analyst Dan Ives of Wedbush Securities.",
    website: "https://wedbushfunds.com/funds/ives/",
    type: "ETF",
  },
  MPLY: {
    name: "Monopoly ETF",
    ticker: "MPLY",
    description:
      "Actively managed ETF investing in companies with monopolistic or oligopolistic market structures and durable competitive advantages.",
    website: "https://strategysharesetfs.com/mply/",
    type: "ETF",
  },
  TCI: {
    name: "TCI Fund Management",
    ticker: "TCI",
    description:
      "London-based hedge fund managed by Sir Christopher Hohn. Holdings sourced from quarterly SEC 13F-HR filings.",
    website: "https://www.tcifund.com/",
    type: "Hedge Fund",
    dataNote:
      "Holdings reported quarterly via SEC 13F filings. Data lags ~45 days after quarter-end.",
  },
};

export const ALL_TICKERS = Object.keys(FUND_CONFIG);
