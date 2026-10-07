"use client";

import { ReferenceLine } from "recharts";
import type { MonthlyResult } from "@/types/simulation";
import { cx } from "../ui";

/* Chart palette — brand teal for GlucoNova; muted, distinguishable hues elsewhere. */
export const COLORS = {
  brand: "#0f766e",
  brandSoft: "#99d5cf",
  indigo: "#4f46e5",
  sky: "#0284c7",
  violet: "#7c3aed",
  amber: "#d97706",
  rose: "#e11d48",
  slate: "#64748b",
  grid: "#e2e8f0",
  axis: "#64748b",
};

/** Up to five saved scenarios, colour-blind-safe-ish and distinct from event amber. */
export const SCENARIO_COLORS = ["#0f766e", "#4f46e5", "#db2777", "#0284c7", "#65a30d"];

export const COMPETITOR_COLORS = [COLORS.indigo, COLORS.sky, COLORS.violet, COLORS.slate];

export const AXIS_PROPS = {
  tick: { fontSize: 11, fill: COLORS.axis },
  tickLine: false,
  axisLine: { stroke: COLORS.grid },
} as const;

export const GRID_PROPS = { stroke: COLORS.grid, strokeDasharray: "3 3", vertical: false } as const;

export const TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
    fontSize: 12,
    padding: "8px 10px",
  },
  labelStyle: { fontWeight: 600, color: "#0f172a", marginBottom: 2 },
  itemStyle: { padding: 0 },
} as const;

export interface EventMarker {
  month: number;
  label: string;
  tag: string;
}

export function eventMarkers(rows: MonthlyResult[]): EventMarker[] {
  const out: EventMarker[] = [];
  rows.forEach((r) => {
    r.events.forEach((label) => out.push({ month: r.month, label, tag: `E${out.length + 1}` }));
  });
  return out;
}

/** Vertical dashed markers for competitor events. Only shows those already reached by the playhead. */
export function eventLines(markers: EventMarker[], upTo: number) {
  return markers
    .filter((m) => m.month <= upTo)
    .map((m) => (
      <ReferenceLine
        key={`${m.tag}-${m.month}`}
        x={m.month}
        stroke={COLORS.amber}
        strokeDasharray="4 3"
        label={{ value: m.tag, position: "top", fill: COLORS.amber, fontSize: 10, fontWeight: 600 }}
      />
    ));
}

export function EventLegend({ markers }: { markers: EventMarker[] }) {
  if (!markers.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      {markers.map((m) => (
        <li key={m.tag} className="flex items-center gap-1.5">
          <span className="rounded bg-amber-50 px-1 font-semibold text-amber-700">{m.tag}</span>
          Month {m.month}: {m.label}
        </li>
      ))}
    </ul>
  );
}

export function ChartCard({
  title,
  subtitle,
  children,
  className,
  height = 260,
  right,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  height?: number;
  right?: React.ReactNode;
}) {
  return (
    <section className={cx("rounded-xl border border-slate-200 bg-white p-5", className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {right}
      </div>
      <div style={{ height }} className="w-full min-w-0">
        {children}
      </div>
    </section>
  );
}

/** Round a maximum up to a tidy axis bound. */
export function niceMax(x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const n = x / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * p;
}
