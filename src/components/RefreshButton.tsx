"use client";

import { useState } from "react";

interface Props {
  onRefreshComplete?: () => void;
}

export default function RefreshButton({ onRefreshComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const handleRefresh = async () => {
    const password = window.prompt("Enter admin password to refresh data:");
    if (!password) return;
    setLoading(true);
    setMessage(null);
    setIsError(false);

    try {
      const resp = await fetch("/api/refresh", {
        method: "POST",
        headers: { "x-admin-password": password },
      });
      const data = await resp.json();

      if (resp.ok) {
        setMessage(
          data.mode === "github_actions"
            ? "GitHub Actions workflow triggered. Check back in a few minutes."
            : "Scrape complete. Refreshing..."
        );
        setIsError(false);
        if (data.mode === "local" && onRefreshComplete) {
          setTimeout(onRefreshComplete, 1000);
        }
      } else {
        setMessage(data.error || "Refresh failed");
        setIsError(true);
      }
    } catch {
      setMessage("Network error");
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleRefresh}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-[9px] border border-[#E4DECF] bg-white px-[14px] py-[7px] text-[13px] font-semibold text-[#4A4232] hover:border-[#C9C0AC] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Refreshing…
          </>
        ) : (
          "↻ Refresh Data"
        )}
      </button>
      {message && (
        <span className={`text-[12.5px] font-mono ${isError ? "text-[#C23B30]" : "text-[#0E7C4A]"}`}>
          {message}
        </span>
      )}
    </div>
  );
}
