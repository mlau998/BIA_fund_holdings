"use client";

import { useState } from "react";

const DEFAULTS = {
  ticker: "",
  name: "",
  description: "",
  website: "",
  type: "ETF",
  cik: "",
  series_id: "",
  form_type: "N-PORT",
  password: "",
};

type Field = keyof typeof DEFAULTS;

export default function AddFundModal() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(DEFAULTS);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const set = (field: Field, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleClose = () => {
    setOpen(false);
    setForm(DEFAULTS);
    setStatus("idle");
    setMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    const { password, ...fund } = form;
    try {
      const res = await fetch("/api/funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fund, series_id: fund.series_id || null, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Something went wrong.");
      } else {
        setStatus("success");
        setMessage(`${fund.ticker.toUpperCase()} added successfully.`);
        setTimeout(handleClose, 1500);
      }
    } catch {
      setStatus("error");
      setMessage("Network error.");
    }
  };

  const inputCls =
    "w-full rounded-[9px] border border-[#E4DECF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#211C13] focus:outline-none focus:border-[#1F3D63] focus:ring-1 focus:ring-[#1F3D63] transition-colors";
  const labelCls =
    "block text-[11px] font-semibold uppercase tracking-wide text-[#A39A86] mb-1";

  const input = (
    label: string,
    field: Field,
    opts?: { placeholder?: string; required?: boolean; hint?: string; type?: string }
  ) => (
    <div>
      <label className={labelCls}>
        {label}
        {opts?.required !== false && <span className="text-[#C23B30] ml-0.5">*</span>}
      </label>
      <input
        type={opts?.type ?? (field === "password" ? "password" : "text")}
        value={form[field]}
        onChange={(e) => set(field, e.target.value)}
        placeholder={opts?.placeholder}
        required={opts?.required !== false}
        className={inputCls}
      />
      {opts?.hint && <p className="mt-1 text-xs text-[#A39A86]">{opts.hint}</p>}
    </div>
  );

  const select = (label: string, field: Field, options: { value: string; label: string }[]) => (
    <div>
      <label className={labelCls}>
        {label}
        <span className="text-[#C23B30] ml-0.5">*</span>
      </label>
      <select
        value={form[field]}
        onChange={(e) => set(field, e.target.value)}
        className={inputCls}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-[9px] px-[15px] py-2 text-[13.5px] font-semibold text-[#211C13] bg-white border border-[#DCD4C2] hover:border-[#C9C0AC] transition-colors"
      >
        + Add Fund
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-[rgba(19,24,32,0.42)] backdrop-blur-[3px]"
            onClick={handleClose}
          />

          <div className="relative bg-white rounded-[18px] shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 pt-5 pb-4 border-b border-[#EAE4D7] flex items-start justify-between">
              <div>
                <h2 className="font-serif italic text-2xl font-medium text-[#211C13]">Add Fund</h2>
                <p className="text-xs text-[#A39A86] mt-1">
                  New fund will be scraped on the next run.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="w-[30px] h-[30px] bg-[#F0EBE0] rounded-[8px] flex items-center justify-center text-[#8A8170] hover:text-[#211C13] text-lg font-medium transition-colors"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {input("Ticker", "ticker", { placeholder: "e.g. XYZ" })}
                {input("Fund Name", "name", { placeholder: "e.g. XYZ Growth ETF" })}
              </div>

              {input("Description", "description", { placeholder: "Brief description" })}
              {input("Website", "website", { placeholder: "https://..." })}

              <div className="grid grid-cols-2 gap-3">
                {select("Type", "type", [
                  { value: "ETF", label: "ETF" },
                  { value: "Hedge Fund", label: "Hedge Fund" },
                  { value: "Mutual Fund", label: "Mutual Fund" },
                ])}
                {select("Filing Type", "form_type", [
                  { value: "N-PORT", label: "N-PORT (ETF / mutual fund)" },
                  { value: "13F-HR", label: "13F-HR (hedge fund)" },
                ])}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {input("CIK", "cik", {
                  placeholder: "e.g. 1506213",
                  hint: "SEC EDGAR CIK (digits only)",
                })}
                {input("Series ID", "series_id", {
                  placeholder: "e.g. S000092393",
                  required: false,
                  hint: "N-PORT only — leave blank for 13F-HR",
                })}
              </div>

              <div className="border-t border-[#EAE4D7] pt-4">
                {input("Password", "password", { placeholder: "Admin password" })}
              </div>

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full rounded-[9px] bg-[#211C13] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2C261B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {status === "loading" ? "Adding…" : "Add Fund"}
              </button>

              {status === "success" && (
                <p className="rounded-[9px] bg-[#F0F8F3] border border-[#DDEBE2] px-3 py-2 text-sm text-[#0E7C4A]">
                  {message}
                </p>
              )}
              {status === "error" && (
                <p className="rounded-[9px] bg-[#FBF0EF] border border-[#F0DAD7] px-3 py-2 text-sm text-[#C23B30]">
                  {message}
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
