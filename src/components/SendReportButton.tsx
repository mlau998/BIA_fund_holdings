"use client";

import { useState } from "react";

export default function SendReportButton() {
  const [state, setState] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSend = async () => {
    if (state === "loading") return;
    setState("loading");
    setErrorMsg("");
    try {
      const resp = await fetch("/api/send-report", { method: "POST" });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error ?? "Failed to send");
        setState("error");
      } else {
        setState("sent");
        setTimeout(() => setState("idle"), 4000);
      }
    } catch {
      setErrorMsg("Network error");
      setState("error");
      setTimeout(() => setState("idle"), 4000);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleSend}
        disabled={state === "loading"}
        title="Send quarterly report email"
        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
          state === "sent"
            ? "bg-green-100 text-green-700 border border-green-200"
            : state === "error"
            ? "bg-red-100 text-red-700 border border-red-200"
            : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
        }`}
      >
        {state === "loading" ? "Sending…" : state === "sent" ? "Sent ✓" : state === "error" ? "Failed" : "Send Report"}
      </button>
      {state === "error" && errorMsg && (
        <div className="absolute right-0 top-8 z-10 w-56 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 shadow">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
