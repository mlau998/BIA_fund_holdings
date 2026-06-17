"use client";

import { useState } from "react";
import { ChangeResult, HoldingRecord } from "@/types";
import { toTitleCase } from "@/lib/utils";

function fmtCurrency(val: number | undefined | null): string {
  if (val == null) return "—";
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(2)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  return `$${val.toLocaleString()}`;
}

function fmt(val: number | undefined | null, decimals = 2): string {
  if (val == null) return "—";
  return val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ─── Added / Removed rows ────────────────────────────────────────────────────

function SimpleHoldingRow({
  h,
  highlight,
}: {
  h: HoldingRecord;
  highlight: "add" | "remove";
}) {
  const isAdd = highlight === "add";
  const ppColor = isAdd ? "text-[#0E7C4A]" : "text-[#C23B30]";
  const ppSign = isAdd ? "+" : "−";

  return (
    <tr
      className={`border-b border-[#F0EBE0] last:border-0 transition-colors ${
        isAdd ? "bg-[#F0F8F3] hover:bg-[#E8F4EE]" : "bg-[#FBF0EF] hover:bg-[#FBECEA]"
      }`}
    >
      <td className="px-5 py-[13px] text-[13.5px] font-medium text-[#2C261B] max-w-xs truncate" title={toTitleCase(h.security_name)}>
        {toTitleCase(h.security_name)}
      </td>
      <td className="px-5 py-[13px] font-mono text-[12.5px] text-[#8A8170]">
        {h.security_ticker || "—"}
      </td>
      <td className="px-5 py-[13px] font-mono text-[13px] text-right text-[#2C261B]">
        {h.shares != null ? h.shares.toLocaleString() : "—"}
      </td>
      <td className={`px-5 py-[13px] font-mono text-[13px] text-right font-semibold ${ppColor}`}>
        {h.portfolio_weight != null
          ? `${ppSign}${fmt(h.portfolio_weight)} pp`
          : "—"}
      </td>
      <td className="px-5 py-[13px] font-mono text-[13px] text-right text-[#2C261B]">
        {fmtCurrency(h.market_value)}
      </td>
    </tr>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  variant: "add" | "remove" | "modify";
}

function SectionHeader({ label, count, open, onToggle, variant }: SectionHeaderProps) {
  const styles = {
    add: { bg: "bg-[#F0F8F3]", border: "border-[#DDEBE2]", icon: "text-[#0E7C4A]", label: "text-[#0E6B41]", count: "text-[#5C9678]" },
    remove: { bg: "bg-[#FBF0EF]", border: "border-[#F0DAD7]", icon: "text-[#C23B30]", label: "text-[#A8362C]", count: "text-[#C08A84]" },
    modify: { bg: "bg-[#EAEEF4]", border: "border-[#D3DAE6]", icon: "text-[#1F3D63]", label: "text-[#243E60]", count: "text-[#6E83A8]" },
  };
  const s = styles[variant];

  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-[9px] px-5 py-[14px] ${s.bg} border-b ${s.border} transition-colors`}
    >
      {variant === "add" && <span className={`${s.icon} text-[13px]`}>▲</span>}
      {variant === "remove" && <span className={`${s.icon} text-[13px]`}>▼</span>}
      <span className={`text-[14.5px] font-bold ${s.label}`}>{label}</span>
      <span className={`font-mono text-[12.5px] ${s.count}`}>({count})</span>
      <span className="ml-auto text-[#A39A86] text-xs">{open ? "▲" : "▼"}</span>
    </button>
  );
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function Tooltip({ text }: { text: string }) {
  return (
    <div
      className="absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 bg-[#211C13] text-white font-mono text-[11.5px] font-medium whitespace-nowrap px-[10px] py-[6px] rounded-[7px] shadow-lg z-50 pointer-events-none"
      style={{ animation: "tipIn .12s ease" }}
    >
      {text}
    </div>
  );
}

// ─── Modified rows ────────────────────────────────────────────────────────────

interface ModRowProps {
  before: HoldingRecord;
  after: HoldingRecord;
  maxAbsWDelta: number;
  hoverKey: string | null;
  onHover: (key: string | null) => void;
  rowKey: string;
}

function ModifiedRow({ before, after, maxAbsWDelta, hoverKey, onHover, rowKey }: ModRowProps) {
  const wBefore = before.portfolio_weight ?? 0;
  const wAfter = after.portfolio_weight ?? 0;
  const wDelta = wAfter - wBefore;
  const wUp = wDelta > 0;

  const vBefore = before.market_value ?? 0;
  const vAfter = after.market_value ?? 0;
  const vDelta = vAfter - vBefore;
  const vUp = vDelta >= 0;

  const sBefore = before.shares ?? 0;
  const sAfter = after.shares ?? 0;
  const sDelta = sAfter - sBefore;
  const sUp = sDelta >= 0;

  const barPct = maxAbsWDelta > 0
    ? Math.min((Math.abs(wDelta) / maxAbsWDelta) * 50, 50).toFixed(1)
    : "0";

  const posColor = "#0E7C4A";
  const negColor = "#C23B30";
  const wColor = wUp ? posColor : negColor;
  const vColor = vUp ? posColor : negColor;
  const sColor = sUp ? posColor : negColor;

  const deltaTextCls = `font-mono text-[13.5px] font-semibold whitespace-nowrap min-w-[78px]`;

  return (
    <tr className="border-b border-[#F0EBE0] last:border-0 hover:bg-[#F7F3EA] transition-colors">
      {/* Security + ticker */}
      <td className="px-5 py-[13px]">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[13.5px] font-medium text-[#2C261B] truncate" title={toTitleCase(after.security_name)}>
            {toTitleCase(after.security_name)}
          </span>
          <span className="font-mono text-[11.5px] text-[#A39A86]">
            {after.security_ticker || "—"}
          </span>
        </div>
      </td>

      {/* Weight delta + diverging bar */}
      <td className="px-5 py-[13px]">
        <div
          className="relative flex items-center gap-3"
          onMouseEnter={() => onHover(`${rowKey}:w`)}
          onMouseLeave={() => onHover(null)}
        >
          <span className={deltaTextCls} style={{ color: wColor }}>
            {wUp ? "▲" : "▼"} {Math.abs(wDelta).toFixed(2)} pp
          </span>
          {/* Diverging bar */}
          <div
            className="relative flex-1 h-[9px] bg-[#EAE4D7] rounded-[3px]"
            style={{ minWidth: "80px" }}
          >
            {/* Center tick */}
            <div className="absolute left-1/2 -top-0.5 -bottom-0.5 w-px bg-[#C9C0AC]" />
            {/* Bar fill */}
            {wUp ? (
              <div
                style={{ left: "50%", width: `${barPct}%`, background: posColor }}
                className="absolute top-0 h-full rounded-r-[3px]"
              />
            ) : (
              <div
                style={{ right: "50%", width: `${barPct}%`, background: negColor }}
                className="absolute top-0 h-full rounded-l-[3px]"
              />
            )}
          </div>
          {hoverKey === `${rowKey}:w` && (
            <Tooltip text={`${fmt(wBefore)}% → ${fmt(wAfter)}%`} />
          )}
        </div>
      </td>

      {/* Value delta */}
      <td className="px-5 py-[13px] text-right">
        <div
          className="relative inline-flex justify-end"
          onMouseEnter={() => onHover(`${rowKey}:v`)}
          onMouseLeave={() => onHover(null)}
        >
          <span className={deltaTextCls} style={{ color: vColor }}>
            {vUp ? "▲" : "▼"} {fmtCurrency(Math.abs(vDelta))}
          </span>
          {hoverKey === `${rowKey}:v` && (
            <Tooltip text={`${fmtCurrency(vBefore)} → ${fmtCurrency(vAfter)}`} />
          )}
        </div>
      </td>

      {/* Shares delta */}
      <td className="px-5 py-[13px] text-right">
        <div
          className="relative inline-flex justify-end"
          onMouseEnter={() => onHover(`${rowKey}:s`)}
          onMouseLeave={() => onHover(null)}
        >
          <span className={deltaTextCls} style={{ color: sColor }}>
            {sUp ? "▲" : "▼"} {sDelta !== 0 ? Math.abs(sDelta).toLocaleString() : "0"}
          </span>
          {hoverKey === `${rowKey}:s` && (
            <Tooltip text={`${sBefore.toLocaleString()} → ${sAfter.toLocaleString()}`} />
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  changes: ChangeResult;
}

const thCls = "px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#A39A86] whitespace-nowrap";

export default function ChangesTable({ changes }: Props) {
  const [addOpen, setAddOpen] = useState(true);
  const [rmOpen, setRmOpen] = useState(true);
  const [modOpen, setModOpen] = useState(true);
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  const maxAbsWDelta = Math.max(
    0.01,
    ...changes.modifications.map((m) =>
      Math.abs((m.after.portfolio_weight ?? 0) - (m.before.portfolio_weight ?? 0))
    )
  );

  return (
    <div className="space-y-[18px]">
      {/* ── Additions ── */}
      <div className="bg-white border border-[#E4DECF] rounded-[14px] overflow-hidden">
        <SectionHeader
          label="New positions"
          count={changes.additions.length}
          open={addOpen}
          onToggle={() => setAddOpen(!addOpen)}
          variant="add"
        />
        {addOpen && changes.additions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-[#EAE4D7]">
                <tr>
                  <th className={thCls}>Security</th>
                  <th className={thCls}>Ticker</th>
                  <th className={`${thCls} text-right`}>Shares</th>
                  <th className={`${thCls} text-right`}>Wt Added</th>
                  <th className={`${thCls} text-right`}>Market Value</th>
                </tr>
              </thead>
              <tbody>
                {changes.additions.map((h, i) => (
                  <SimpleHoldingRow key={i} h={h} highlight="add" />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {addOpen && changes.additions.length === 0 && (
          <p className="px-5 py-3 text-sm text-[#A39A86]">No additions</p>
        )}
      </div>

      {/* ── Removals ── */}
      <div className="bg-white border border-[#E4DECF] rounded-[14px] overflow-hidden">
        <SectionHeader
          label="Exited positions"
          count={changes.deletions.length}
          open={rmOpen}
          onToggle={() => setRmOpen(!rmOpen)}
          variant="remove"
        />
        {rmOpen && changes.deletions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-[#EAE4D7]">
                <tr>
                  <th className={thCls}>Security</th>
                  <th className={thCls}>Ticker</th>
                  <th className={`${thCls} text-right`}>Shares</th>
                  <th className={`${thCls} text-right`}>Wt Removed</th>
                  <th className={`${thCls} text-right`}>Market Value</th>
                </tr>
              </thead>
              <tbody>
                {changes.deletions.map((h, i) => (
                  <SimpleHoldingRow key={i} h={h} highlight="remove" />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rmOpen && changes.deletions.length === 0 && (
          <p className="px-5 py-3 text-sm text-[#A39A86]">No removals</p>
        )}
      </div>

      {/* ── Modifications ── */}
      <div className="bg-white border border-[#E4DECF] rounded-[14px] overflow-hidden">
        <SectionHeader
          label="Re-weighted positions"
          count={changes.modifications.length}
          open={modOpen}
          onToggle={() => setModOpen(!modOpen)}
          variant="modify"
        />
        {modOpen && changes.modifications.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-[#EAE4D7]">
                <tr>
                  <th className={thCls}>Security</th>
                  <th className={thCls}>Weight change</th>
                  <th className={`${thCls} text-right`}>Value Δ</th>
                  <th className={`${thCls} text-right`}>Shares Δ</th>
                </tr>
              </thead>
              <tbody>
                {changes.modifications.map(({ before, after }, i) => (
                  <ModifiedRow
                    key={i}
                    before={before}
                    after={after}
                    maxAbsWDelta={maxAbsWDelta}
                    hoverKey={hoverKey}
                    onHover={setHoverKey}
                    rowKey={`mod-${i}`}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {modOpen && changes.modifications.length === 0 && (
          <p className="px-5 py-3 text-sm text-[#A39A86]">No modifications</p>
        )}
      </div>
    </div>
  );
}
