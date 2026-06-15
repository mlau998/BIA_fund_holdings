"use client";

interface Props {
  tickers: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export default function FundFilter({ tickers, selected, onChange }: Props) {
  const toggle = (ticker: string) => {
    if (selected.includes(ticker)) {
      onChange(selected.filter((t) => t !== ticker));
    } else {
      onChange([...selected, ticker]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {tickers.map((ticker) => {
        const active = selected.includes(ticker);
        return (
          <button
            key={ticker}
            onClick={() => toggle(ticker)}
            className={`rounded-full px-3 py-1 text-sm font-semibold transition-colors ${
              active
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {ticker}
          </button>
        );
      })}
    </div>
  );
}
