import { FundMeta } from "@/types";

export const STATIC_FUND_CONFIG: Record<string, FundMeta> = {
  GRNY: {
    name: "Fundstrat Granny Shots US Large Cap ETF",
    ticker: "GRNY",
    description:
      "Rules-based large-cap ETF selecting 'Granny Shots' — stocks with multi-year, multi-thematic institutional conviction.",
    website: "https://grannyshots.com/holdings/",
    type: "ETF",
    cik: "1722388",
    series_id: "S000088227",
    form_type: "N-PORT",
    dataNote: "Holdings reported monthly via SEC N-PORT filings. Data lags up to 60 days after month-end.",
  },
  IVES: {
    name: "Dan Ives Wedbush AI Revolution ETF",
    ticker: "IVES",
    description:
      "Actively managed ETF focusing on AI-driven technology companies, curated by analyst Dan Ives of Wedbush Securities.",
    website: "https://wedbushfunds.com/funds/ives/",
    type: "ETF",
    cik: "2055464",
    series_id: "S000091902",
    form_type: "N-PORT",
    dataNote: "Holdings reported monthly via SEC N-PORT filings. Data lags up to 60 days after month-end.",
  },
  MPLY: {
    name: "Monopoly ETF",
    ticker: "MPLY",
    description:
      "Actively managed ETF investing in companies with monopolistic or oligopolistic market structures and durable competitive advantages.",
    website: "https://strategysharesetfs.com/mply/",
    type: "ETF",
    cik: "1506213",
    series_id: "S000092393",
    form_type: "N-PORT",
    dataNote: "Holdings reported monthly via SEC N-PORT filings. Data lags up to 60 days after month-end.",
  },
  TCI: {
    name: "TCI Fund Management",
    ticker: "TCI",
    description:
      "London-based hedge fund managed by Sir Christopher Hohn. Holdings sourced from quarterly SEC 13F-HR filings.",
    website: "https://www.tcifund.com/",
    type: "Hedgefund",
    dataNote:
      "Holdings reported quarterly via SEC 13F filings. Data lags ~45 days after quarter-end.",
    cik: "1647251",
    series_id: null,
    form_type: "13F-HR",
  },
};

export const STATIC_TICKERS = Object.keys(STATIC_FUND_CONFIG);
