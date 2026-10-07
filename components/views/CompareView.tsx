"use client";

import { Fragment, useMemo } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Pencil, Save, Trash2, Upload } from "lucide-react";
import { MAX_SCENARIOS, useStore } from "@/lib/store";
import { formatINR, formatNumber, formatPct } from "@/lib/format";
import { leaderIndex, tradeoffStatements } from "@/lib/tradeoffs";
import type { SavedScenario } from "@/types/simulation";
import { ExportButtons } from "../ExportButtons";
import { downloadBlob, downloadCsv } from "@/lib/download";
import { scenarioComparisonCsv } from "@/lib/export";
import { Badge, Button, Callout, EmptyState, PageHeader, Panel, cx } from "../ui";
import { AXIS_PROPS, ChartCard, GRID_PROPS, SCENARIO_COLORS, TOOLTIP_STYLE, niceMax } from "../charts/common";

interface Row {
  label: string;
  group?: string;
  get: (s: SavedScenario) => string;
  /** key into leaderIndex for outcome rows */
  lead?: string;
}

const m = (s: SavedScenario) => s.result.summaryMetrics;
const ROWS: Row[] = [
  { group: "Decisions", label: "Price (monthly)", get: (s) => formatINR(s.config.price, { compact: false }) },
  { label: "Marketing spend", get: (s) => formatINR(s.config.marketingBudget) },
  { label: "Insurance coverage", get: (s) => formatPct(s.config.insuranceCoverage, 0) },
  { label: "Physician outreach", get: (s) => `${s.config.outreachIntensity} · ${s.config.salesReps} reps` },
  { label: "Consumer marketing share", get: (s) => formatPct(s.config.consumerMarketingShare, 0) },
  { group: "Simulated outcomes", label: "Patient adoption (ever adopted)", get: (s) => formatPct(m(s).patientAdoptionRate) },
  { label: "Market share (final)", get: (s) => formatPct(m(s).finalMarketShare), lead: "share" },
  { label: "Active patients", get: (s) => formatNumber(m(s).activePatients) },
  { label: "Months to half of final base", get: (s) => `Month ${m(s).monthsToHalfFinal}`, lead: "speed" },
  { label: "Net revenue / patient-month", get: (s) => formatINR(m(s).netRevenuePerPatientMonth, { compact: false }), lead: "margin" },
  { label: "Revenue (cumulative)", get: (s) => formatINR(m(s).cumulativeRevenue), lead: "revenue" },
  { label: "Profit (cumulative)", get: (s) => formatINR(m(s).cumulativeProfit), lead: "profit" },
  { label: "Break-even month", get: (s) => (m(s).breakEvenMonth ? `Month ${m(s).breakEvenMonth}` : "Not reached"), lead: "be" },
  { label: "Marketing ROI (incremental)", get: (s) => `${m(s).marketingROI.toFixed(1)}×`, lead: "roi" },
  { label: "Cost per acquisition", get: (s) => formatINR(m(s).customerAcquisitionCost, { compact: false }), lead: "cac" },
];

function useSeries(scenarios: SavedScenario[]) {
  return useMemo(() => {
    const maxM = Math.max(...scenarios.map((s) => s.result.monthlyResults.length));
    const rows = Array.from({ length: maxM }, (_, i) => {
      const o: Record<string, number | undefined> = { month: i + 1 };
      scenarios.forEach((s, k) => {
        const r = s.result.monthlyResults[i];
        if (!r) return;
        o[`share${k}`] = r.marketShare * 100;
        o[`rev${k}`] = r.grossRevenue;
        o[`act${k}`] = r.activePatients;
      });
      return o;
    });
    return { rows, maxM };
  }, [scenarios]);
}

export function CompareView() {
  const { scenarios, deleteScenario, renameScenario, replaceConfig, setView, setSaveDialogOpen, loadDemoScenarios, notify } = useStore();
  const { rows, maxM } = useSeries(scenarios.length ? scenarios : []);
  const statements = useMemo(() => tradeoffStatements(scenarios), [scenarios]);

  const actions = (
    <>
      <ExportButtons
        disabled={scenarios.length === 0}
        onCsv={() => downloadCsv("gluconova-scenario-comparison.csv", scenarioComparisonCsv(scenarios))}
        onPdf={async () => {
          const { buildComparisonReport } = await import("@/lib/pdfReport");
          const doc = await buildComparisonReport(scenarios);
          downloadBlob("gluconova-scenario-comparison.pdf", doc.output("blob"));
        }}
      />
      <Button size="sm" onClick={loadDemoScenarios}>
        <Download className="h-3.5 w-3.5" /> Load demo scenarios
      </Button>
      <Button size="sm" variant="primary" onClick={() => setSaveDialogOpen(true)} disabled={scenarios.length >= MAX_SCENARIOS} title={scenarios.length >= MAX_SCENARIOS ? "Delete a scenario to free a slot" : undefined}>
        <Save className="h-3.5 w-3.5" /> Save current
      </Button>
    </>
  );

  if (scenarios.length === 0) {
    return (
      <div>
        <PageHeader title="Scenario Comparison" subtitle="Save up to five launch strategies and compare their simulated trade-offs side by side." actions={actions} />
        <EmptyState
          title="No saved scenarios yet"
          body="Save the current configuration as a scenario, or load the three demo strategies — Premium, Balanced and Market Penetration — to compare instantly."
          action={
            <Button variant="primary" onClick={loadDemoScenarios}>
              Load demo scenarios
            </Button>
          }
        />
      </div>
    );
  }

  const label = (i: number) => scenarios[i].name;

  return (
    <div>
      <PageHeader
        title="Scenario Comparison"
        subtitle="Compare saved strategies on the same synthetic market. Bold values mark the leader on that single measure — not an overall winner."
        actions={actions}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {scenarios.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-3 pr-1.5 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }} />
            <span className="font-medium text-slate-900">{s.name}</span>
            <button
              className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label={`Rename ${s.name}`}
              onClick={() => {
                const n = window.prompt("Rename scenario", s.name);
                if (n && n.trim()) renameScenario(s.id, n.trim().slice(0, 40));
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label={`Load ${s.name} into configuration`}
              title="Load into Configure"
              onClick={() => {
                replaceConfig(s.config);
                notify(`Loaded “${s.name}” into the configuration`);
                setView("configure");
              }}
            >
              <Upload className="h-3.5 w-3.5" />
            </button>
            <button className="rounded-full p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700" aria-label={`Delete ${s.name}`} onClick={() => deleteScenario(s.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <span className="self-center text-xs text-slate-500">
          {scenarios.length}/{MAX_SCENARIOS} saved
        </span>
      </div>

      {scenarios.length < 2 && (
        <div className="mb-6">
          <Callout tone="amber">Save at least two scenarios to see trade-offs. Change a lever on the Configure page, run again and save.</Callout>
        </div>
      )}

      <Panel className="overflow-x-auto p-0">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Metric</th>
              {scenarios.map((s, i) => (
                <th key={s.id} className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                  <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }} />
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => {
              const lead = r.lead ? leaderIndex(scenarios, r.lead) : null;
              return (
                <Fragment key={r.label}>
                  {r.group && (
                    <tr className="bg-white">
                      <td colSpan={scenarios.length + 1} className="px-4 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-teal-800">
                        {r.group}
                      </td>
                    </tr>
                  )}
                  <tr className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2 text-slate-600">{r.label}</td>
                    {scenarios.map((s, i) => (
                      <td key={s.id} className={cx("px-4 py-2 text-right tabular-nums", lead === i ? "font-semibold text-teal-800" : "text-slate-900")}>
                        {r.get(s)}
                      </td>
                    ))}
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Panel>

      {statements.length > 0 && (
        <div className="mt-6">
          <Callout tone="teal" title="Trade-offs">
            <ul className="list-disc space-y-1 pl-5">
              {statements.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </Callout>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <CompareChart
          title="Market share over time"
          rows={rows}
          maxM={maxM}
          scenarios={scenarios}
          prefix="share"
          fmt={(v) => `${v.toFixed(1)}%`}
          tick={(v) => `${v}%`}
          label={label}
        />
        <CompareChart title="Monthly revenue over time" rows={rows} maxM={maxM} scenarios={scenarios} prefix="rev" fmt={(v) => formatINR(v)} tick={(v) => formatINR(v)} label={label} width={64} />
        <CompareChart title="Patient adoption over time" subtitle="Active patients" rows={rows} maxM={maxM} scenarios={scenarios} prefix="act" fmt={(v) => formatNumber(v)} tick={(v) => (v >= 1000 ? `${v / 1000}k` : `${v}`)} label={label} />
        <Panel title="Reading the comparison" subtitle="Simulated, single seed">
          <ul className="space-y-2 text-sm text-slate-600">
            <li>All scenarios run on the same synthetic physicians and patients, so differences come from the levers you changed.</li>
            <li>
              <Badge tone="teal">Leader</Badge> marks the highest (or lowest, for cost and time) value on that row only.
            </li>
            <li>Load a scenario into Configure to tweak it further; re-save under a new name to keep both versions.</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function CompareChart({
  title,
  subtitle,
  rows,
  maxM,
  scenarios,
  prefix,
  fmt,
  tick,
  label,
  width = 46,
}: {
  title: string;
  subtitle?: string;
  rows: Record<string, number | undefined>[];
  maxM: number;
  scenarios: SavedScenario[];
  prefix: string;
  fmt: (v: number) => string;
  tick: (v: number) => string;
  label: (i: number) => string;
  width?: number;
}) {
  const top = niceMax(Math.max(...rows.flatMap((r) => scenarios.map((_, k) => r[`${prefix}${k}`] ?? 0))) * 1.05);
  return (
    <ChartCard title={title} subtitle={subtitle} height={280}>
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="month" type="number" domain={[1, maxM]} allowDecimals={false} {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} domain={[0, top]} tickFormatter={tick} width={width} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(v) => fmt(Number(v))} labelFormatter={(mo) => `Month ${mo}`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {scenarios.map((_, k) => (
            <Line key={k} type="monotone" dataKey={`${prefix}${k}`} name={label(k)} stroke={SCENARIO_COLORS[k % SCENARIO_COLORS.length]} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
