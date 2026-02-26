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
    setLoading(true);
    setMessage(null);
    setIsError(false);

    try {
      const resp = await fetch("/api/refresh", { method: "POST" });
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
    } catch (e) {
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
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Refreshing...
          </span>
        ) : (
          "Refresh Data"
        )}
      </button>
      {message && (
        <span className={`text-sm ${isError ? "text-red-600" : "text-green-600"}`}>
          {message}
        </span>
      )}
    </div>
  );
}
