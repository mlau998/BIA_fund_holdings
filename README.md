# BIA Fund Holdings Monitor

Internal web platform for BIA portfolio managers to aggregate, monitor, and compare holdings across four funds: **GRNY**, **IVES**, **MPLY**, and **TCI**.

## Features

- Aggregated holdings dashboard with search and fund filter
- Per-fund detail pages
- Holdings change detection between any two snapshot dates
- Automatic validation warnings (0 holdings, count spikes, low ticker coverage)
- Daily automated scraping via GitHub Actions
- Manual on-demand refresh button (triggers GitHub Actions in production)

## Tech Stack

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS
- **Scrapers**: Python 3.11, requests, BeautifulSoup4, lxml
- **Data**: JSON snapshot files committed to `data/snapshots/`
- **Automation**: GitHub Actions (daily cron + manual trigger)
- **Deployment**: Vercel free tier

## Local Development

### Prerequisites

- Node.js 18+
- Python 3.11+

### Setup

```bash
# Install Node dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt

# Run scrapers to populate initial data
python scrapers/run_all.py

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

Copy `.env.local.example` to `.env.local` and fill in values:

```bash
cp .env.local.example .env.local
```

- `GITHUB_TOKEN` — Personal Access Token with `workflow` scope (for Refresh button in production)
- `GITHUB_REPO` — Your repo in `owner/repo` format

## Deployment (Vercel)

1. Push this repo to GitHub
2. Connect to [Vercel](https://vercel.com) (free tier), set root as `/` with framework **Next.js**
3. In Vercel settings, add environment variables:
   - `GITHUB_TOKEN` (with `workflow` scope)
   - `GITHUB_REPO` (e.g. `your-username/BIA_fund_platform`)
4. GitHub Actions runs daily at 8pm UTC and commits new snapshots → Vercel auto-deploys

## Data Sources

| Fund | Type | Source |
|------|------|--------|
| GRNY — Fundstrat Granny Shots | ETF | grannyshots.com/holdings/ (fallback: SEC N-PORT) |
| IVES — Dan Ives Wedbush AI | ETF | wedbushfunds.com/funds/ives/ (fallback: SEC N-PORT) |
| MPLY — Monopoly ETF | ETF | strategysharesetfs.com/mply/ (fallback: SEC N-PORT) |
| TCI — TCI Fund Management | Hedge Fund | SEC EDGAR 13F-HR (quarterly) |

## Snapshot Format

Snapshots are stored at `data/snapshots/<TICKER>/<YYYY-MM-DD>.json`:

```json
{
  "fund_name": "Fundstrat Granny Shots US Large Cap ETF",
  "fund_ticker": "GRNY",
  "as_of_date": "2024-01-15",
  "source": "website",
  "source_url": "https://grannyshots.com/holdings/",
  "scrape_timestamp": "2024-01-15T14:30:00Z",
  "warnings": [],
  "holdings": [
    {
      "security_name": "Apple Inc",
      "security_ticker": "AAPL",
      "shares": 12500,
      "portfolio_weight": 5.23,
      "market_value": 2187500,
      "holding_key": "AAPL"
    }
  ]
}
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/holdings` | GET | All holdings; params: `funds`, `search`, `ticker` |
| `/api/snapshots` | GET | List snapshot dates; param: `fund` |
| `/api/changes` | GET | Diff between two snapshots; params: `fund`, `date1`, `date2` |
| `/api/refresh` | POST | Trigger scrape (local subprocess or GitHub Actions) |

## Project Structure

```
BIA_fund_platform/
├── .github/workflows/     # GitHub Actions (daily + manual scrape)
├── data/snapshots/        # JSON snapshot files (GRNY/, IVES/, MPLY/, TCI/)
├── scrapers/              # Python connectors + EDGAR utilities
├── src/
│   ├── app/               # Next.js App Router pages + API routes
│   ├── components/        # React UI components
│   ├── lib/               # Server-side utilities (snapshots, diff, config)
│   └── types/             # TypeScript interfaces
└── requirements.txt
```
