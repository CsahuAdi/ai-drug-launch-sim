"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Play } from "lucide-react";
import { useStore } from "@/lib/store";
import { formatNumber, formatPct } from "@/lib/format";
import type { ScenarioResult, SegmentRow } from "@/types/simulation";
import { Badge, Button, Callout, EmptyState, PageHeader, Panel } from "../ui";
import { AXIS_PROPS, COLORS, ChartCard, GRID_PROPS, TOOLTIP_STYLE } from "../charts/common";

const DIMENSIONS: { key: keyof ScenarioResult["segmentResults"]; title: string; noun: string }[] = [
  { key: "income", title: "By income segment", noun: "income" },
  { key: "insurance", title: "By insurance status", noun: "insurance" },
  { key: "age", title: "By age group", noun: "age" },
  { key: "priceSensitivity", title: "By price sensitivity", noun: "price-sensitivity" },
  { key: "digitalEngagement", title: "By digital engagement", noun: "digital-engagement" },
];

/** Descriptive statements derived from the run — commercial behaviour only, never medical. */
export function segmentInsights(r: ScenarioResult): string[] {
  const out: string[] = [];
  for (const d of DIMENSIONS) {
    const rows = r.segmentResults[d.key].filter((x) => x.patients > 0);
    if (rows.length < 2) continue;
    const sorted = [...rows].sort((a, b) => b.adoptionRate - a.adoptionRate);
    const hi = sorted[0];
    const lo = sorted[sorted.length - 1];
    out.push(
      `${label(d.key, hi)} patients show the highest simulated adoption by ${d.noun} (${formatPct(hi.adoptionRate)}), while ${label(d.key, lo).toLowerCase()} patients show the lowest (${formatPct(lo.adoptionRate)}).`,
    );
  }
  return out;
}

function label(key: string, row: SegmentRow): string {
  if (key === "priceSensitivity") return `${row.label} price-sensitivity`;
  if (key === "digitalEngagement") return `${row.label} digital-engagement`;
  if (key === "age") return `Age ${row.label}`;
  if (key === "income") return `${row.label}-income`;
  return row.label;
}

export function SegmentsView() {
  const { result, run, setView, status } = useStore();
  if (!result) {
    return (
      <div>
        <PageHeader title="Segments" subtitle="Who adopts GlucoNova in the simulated market — patients and physicians." />
        <EmptyState
          title="Run a simulation first"
          body="Segment analytics are generated from the simulated patient and physician populations."
          action={
            <Button variant="primary" onClick={run}>
              <Play className="h-4 w-4" /> Run Simulation
            </Button>
          }
        />
      </div>
    );
  }

  const insights = segmentInsights(result);
  const phys = result.physicianResults;
  const totalPhys = phys.segments.reduce((s, x) => s + x.count, 0) || 1;

  return (
    <div>
      <PageHeader
        title="Segments"
        subtitle="Simulated adoption broken down by patient and physician segment. Observations describe simulated commercial behaviour, not medical outcomes."
        actions={status === "stale" ? <Badge tone="amber">Showing previous run</Badge> : undefined}
      />

      <Callout tone="teal" title="What the simulation shows">
        <ul className="list-disc space-y-1 pl-5">
          {insights.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </Callout>

      <h3 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wider text-teal-800">Patient segments</h3>
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {DIMENSIONS.map((d) => (
          <SegmentChart key={d.key} title={d.title} rows={result.segmentResults[d.key]} />
        ))}
      </div>

      <h3 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wider text-teal-800">Physician segments</h3>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Physicians prescribing, by type" subtitle="Share of each simulated physician segment prescribing at the end of the run" height={280}>
          <ResponsiveContainer>
            <BarChart data={phys.segments.map((s) => ({ name: s.segment, rate: s.prescribingRate * 100 }))} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="name" {...AXIS_PROPS} interval={0} tick={{ fontSize: 10, fill: COLORS.axis }} />
              <YAxis {...AXIS_PROPS} domain={[0, 100]} tickFormatter={(v) => `${v}%`} width={40} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v) => `${Number(v).toFixed(1)}%`} />
              <Bar dataKey="rate" name="Prescribing" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {phys.segments.map((s, i) => (
                  <Cell key={s.segment} fill={COLORS.brand} fillOpacity={1 - i * 0.14} />
                ))}
                <LabelList dataKey="rate" position="top" formatter={(v: unknown) => `${Number(v).toFixed(0)}%`} fontSize={11} fill="#334155" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <Panel title="Physician segment distribution" subtitle={`${formatNumber(totalPhys)} synthetic physicians`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 font-medium">Segment</th>
                <th className="py-2 text-right font-medium">Physicians</th>
                <th className="py-2 text-right font-medium">Mix</th>
                <th className="py-2 text-right font-medium">Awareness</th>
                <th className="py-2 text-right font-medium">Prescribing</th>
              </tr>
            </thead>
            <tbody>
              {phys.segments.map((s) => (
                <tr key={s.segment} className="border-b border-slate-100">
                  <td className="py-2 font-medium text-slate-900">{s.segment}</td>
                  <td className="py-2 text-right tabular-nums">{s.count}</td>
                  <td className="py-2 text-right tabular-nums text-slate-600">{formatPct(s.count / totalPhys, 0)}</td>
                  <td className="py-2 text-right tabular-nums text-slate-600">{formatPct(s.avgAwareness, 0)}</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-teal-800">{formatPct(s.prescribingRate, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Sample of simulated physicians" subtitle="First 12 records of the synthetic panel (fictional)">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  {["ID", "Segment", "Specialty", "Patients / mo", "Awareness", "Rx probability", "Status"].map((h, i) => (
                    <th key={h} className={`py-2 font-medium ${i >= 3 ? "text-right" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {phys.sample.map((p) => (
                  <tr key={p.physicianId} className="border-b border-slate-100">
                    <td className="py-1.5 tabular-nums text-slate-500">PH-{String(p.physicianId).padStart(4, "0")}</td>
                    <td className="py-1.5">{p.segment}</td>
                    <td className="py-1.5 text-slate-600">{p.specialtyType}</td>
                    <td className="py-1.5 text-right tabular-nums">{p.patientVolume}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatPct(p.awareness, 0)}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatPct(p.prescriptionProbability, 0)}</td>
                    <td className="py-1.5 text-right">{p.prescribing ? <Badge tone="teal">Prescribing</Badge> : <Badge>Not yet</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      <p className="mt-4 text-xs text-slate-500">
        <button className="underline" onClick={() => setView("methodology")}>How segments are generated</button> · All data simulated.
      </p>
    </div>
  );
}

function SegmentChart({ title, rows }: { title: string; rows: SegmentRow[] }) {
  const max = Math.max(...rows.map((r) => r.adoptionRate));
  const data = rows.map((r) => ({ name: r.label, rate: r.adoptionRate * 100, patients: r.patients, top: r.adoptionRate === max }));
  return (
    <ChartCard title={title} subtitle="Share of segment that adopted GlucoNova at any point" height={220}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="name" {...AXIS_PROPS} interval={0} tick={{ fontSize: 10, fill: COLORS.axis }} />
          <YAxis {...AXIS_PROPS} tickFormatter={(v) => `${v}%`} width={40} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(v, _n, item) => [`${Number(v).toFixed(1)}% (${formatNumber((item.payload as { patients: number }).patients)} patients in segment)`, "Adoption"]} />
          <Bar dataKey="rate" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.top ? COLORS.brand : COLORS.brandSoft} />
            ))}
            <LabelList dataKey="rate" position="top" formatter={(v: unknown) => `${Number(v).toFixed(0)}%`} fontSize={11} fill="#334155" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
