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

  const input = (
    label: string,
    field: Field,
    opts?: { placeholder?: string; required?: boolean; hint?: string; type?: string }
  ) => (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}{opts?.required !== false && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type={opts?.type ?? (field === "password" ? "password" : "text")}
        value={form[field]}
        onChange={(e) => set(field, e.target.value)}
        placeholder={opts?.placeholder}
        required={opts?.required !== false}
        className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {opts?.hint && <p className="mt-0.5 text-xs text-gray-400">{opts.hint}</p>}
    </div>
  );

  const select = (label: string, field: Field, options: { value: string; label: string }[]) => (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}<span className="text-red-400 ml-0.5">*</span>
      </label>
      <select
        value={form[field]}
        onChange={(e) => set(field, e.target.value)}
        className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-blue-600 hover:text-blue-800 border border-blue-200 rounded-md px-3 py-1 hover:bg-blue-50 transition-colors"
      >
        + Add Fund
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">Add Fund</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  New fund will be scraped on the next run.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none -mt-1"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
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

              <div className="border-t border-gray-100 pt-3">
                {input("Password", "password", { placeholder: "Admin password" })}
              </div>

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {status === "loading" ? "Adding…" : "Add Fund"}
              </button>

              {status === "success" && (
                <p className="rounded bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
                  {message}
                </p>
              )}
              {status === "error" && (
                <p className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
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
