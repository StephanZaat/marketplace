import React, { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

/** Admin chart building blocks (single hue: ocean-600; one measure per chart). */

export const fmtDay = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });

export function Delta({ now, prev, unit = "vs previous 30 days" }: { now: number; prev: number; unit?: string }) {
  const diff = Math.round((now - prev) * 10) / 10;
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-gray-500">
      <Icon size={13} /> {diff > 0 ? "+" : ""}{diff} {unit}
    </span>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: number | string; sub?: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-3xl font-extrabold text-gray-900 mt-1">{typeof value === "number" ? value.toLocaleString() : value}</div>
      {sub && <div className="mt-1">{sub}</div>}
    </div>
  );
}

export interface Column { key: string; label: string; value: number }

/** Vertical bars with hover tooltip; first and last x labels only. */
export function ColumnChart({ title, subtitle, data, lastLabel }: { title: string; subtitle?: string; data: Column[]; lastLabel?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return null;
  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {subtitle && <span className="text-sm text-gray-500">{subtitle}</span>}
      </div>
      <div className="relative flex">
        <div className="flex flex-col justify-between text-[11px] text-gray-400 pr-2 h-32 text-right w-8">
          <span>{max}</span><span>0</span>
        </div>
        <div className="relative flex-1 h-32 border-b border-gray-200 flex items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
          {data.map((d, i) => (
            <div key={d.key} className="flex-1 h-full flex items-end justify-center cursor-default" onMouseEnter={() => setHover(i)}>
              <div
                className={`w-full max-w-6 rounded-t ${hover === i ? "bg-ocean-700" : "bg-ocean-600"}`}
                style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 2 : 0 }}
              />
            </div>
          ))}
          {hover !== null && (
            <div
              className="absolute -top-2 -translate-y-full -translate-x-1/2 bg-gray-900 text-white text-xs rounded-md px-2 py-1 whitespace-nowrap pointer-events-none"
              style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
            >
              {data[hover].label}: <strong>{data[hover].value}</strong>
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-between text-[11px] text-gray-400 mt-1 pl-10">
        <span>{data[0].label}</span><span>{lastLabel ?? data[data.length - 1].label}</span>
      </div>
    </div>
  );
}

export function HBars({ title, rows, empty }: { title: string; rows: { label: string; count: number }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="card p-5">
      <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-gray-400">{empty}</p> : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="grid grid-cols-[8rem_1fr] items-center gap-3 text-sm" title={`${r.label}: ${r.count}`}>
              <span className="truncate text-gray-700">{r.label}</span>
              <span className="flex items-center gap-2">
                <span className="h-4 rounded-r bg-ocean-600" style={{ width: `${(r.count / max) * 85}%`, minWidth: 2 }} />
                <span className="text-gray-600 tabular-nums">{r.count}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
