"use client";

interface Props {
  tickers: string[];
  selected: string;
  onChange: (v: string) => void;
}

export default function FundFilter({ tickers, selected, onChange }: Props) {
  const options = ["ALL", ...tickers];

  return (
    <div className="flex flex-wrap gap-[7px]">
      {options.map((t) => {
        const active = selected === t;
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={`rounded-[8px] px-[14px] py-[7px] text-[13px] font-semibold border transition-colors ${
              active
                ? "bg-[#211C13] text-white border-[#211C13]"
                : "bg-white text-[#4A4232] border-[#E4DECF] hover:border-[#C9C0AC]"
            }`}
          >
            {t === "ALL" ? "All Funds" : t}
          </button>
        );
      })}
    </div>
  );
}
