"use client";

import { useState } from "react";

export default function SendReportButton() {
  const [state, setState] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSend = async () => {
    if (state === "loading") return;
    const password = window.prompt("Enter admin password to send report:");
    if (!password) return;
    setState("loading");
    setErrorMsg("");
    try {
      const resp = await fetch("/api/send-report", {
        method: "POST",
        headers: { "x-admin-password": password },
      });
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
        className={`flex items-center gap-1.5 rounded-[9px] px-[15px] py-2 text-[13.5px] font-semibold transition-colors disabled:opacity-50 ${
          state === "sent"
            ? "bg-[#0E7C4A] text-white border border-[#0E7C4A]"
            : state === "error"
            ? "bg-[#C23B30] text-white border border-[#C23B30]"
            : "bg-[#211C13] text-white border border-[#211C13] hover:bg-[#2C261B]"
        }`}
      >
        <span className="text-[13px]">✉</span>
        {state === "loading" ? "Sending…" : state === "sent" ? "Sent ✓" : state === "error" ? "Failed" : "Send Report"}
      </button>
      {state === "error" && errorMsg && (
        <div className="absolute right-0 top-10 z-10 w-56 rounded-[9px] border border-[#F0DAD7] bg-[#FBF0EF] px-3 py-2 text-xs text-[#C23B30] shadow-md">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
