"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { useStore } from "@/lib/store";
import { kpisAt } from "@/lib/metrics";
import { formatCompact, formatINR, formatNumber, formatPct } from "@/lib/format";
import type { ScenarioResult } from "@/types/simulation";
import { Button, Callout, EmptyState, Kpi, PageHeader, Panel } from "../ui";
import {
  AXIS_PROPS,
  COLORS,
  COMPETITOR_COLORS,
  ChartCard,
  EventLegend,
  GRID_PROPS,
  TOOLTIP_STYLE,
  eventLines,
  eventMarkers,
  niceMax,
} from "../charts/common";
import { AnalystPanel } from "../AnalystPanel";
import { ExportButtons } from "../ExportButtons";
import { downloadBlob, downloadCsv } from "@/lib/download";
import { monthlyResultsCsv } from "@/lib/export";
import { generateInsights } from "@/lib/insights";

/** Remember which run has already been played so switching tabs doesn't replay the animation. */
let playedRunId = -1;

const roi = (x: number) => `${x.toFixed(1)}×`;

function usePlayback(runId: number, months: number) {
  const [visible, setVisible] = useState(() => (playedRunId === runId ? months : 1));
  const [playing, setPlaying] = useState(playedRunId !== runId);

  // A new run restarts playback (unless reduced motion). The ref guards StrictMode's double effect.
  const seenRun = useRef<number | null>(null);
  useEffect(() => {
    if (seenRun.current === runId) return;
    const firstMount = seenRun.current === null;
    seenRun.current = runId;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const alreadyPlayed = firstMount && playedRunId === runId;
    playedRunId = runId;
    if (alreadyPlayed || reduce) {
      setVisible(months);
      setPlaying(false);
    } else {
      setVisible(1);
      setPlaying(true);
    }
  }, [runId, months]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setVisible((v) => {
        if (v >= months) {
          setPlaying(false);
          return months;
        }
        return v + 1;
      });
    }, 1800 / Math.max(months, 12));
    return () => clearInterval(id);
  }, [playing, months]);

  return {
    visible,
    playing,
    setVisible: (v: number) => {
      setPlaying(false);
      setVisible(v);
    },
    toggle: () => {
      if (visible >= months) setVisible(1);
      setPlaying((p) => !p);
    },
    replay: () => {
      setVisible(1);
      setPlaying(true);
    },
    skip: () => {
      setPlaying(false);
      setVisible(months);
    },
  };
}

export function SimulationView() {
  const { result, status, run, runId, setView } = useStore();
  if (!result) {
    return (
      <div>
        <PageHeader title="Simulation Dashboard" subtitle="Adoption, share, revenue and profitability over time." />
        <EmptyState
          title="No simulation yet"
          body="Run a simulation to see physicians and patients adopt GlucoNova month by month."
          action={
            <div className="flex gap-2">
              <Button variant="primary" onClick={run}>
                <Play className="h-4 w-4" /> Run Simulation
              </Button>
              <Button onClick={() => setView("configure")}>Configure first</Button>
            </div>
          }
        />
      </div>
    );
  }
  return <Dashboard result={result} runId={runId} stale={status === "stale"} onRerun={run} />;
}

function Dashboard({ result, runId, stale, onRerun }: { result: ScenarioResult; runId: number; stale: boolean; onRerun: () => void }) {
  const rows = result.monthlyResults;
  const months = rows.length;
  const pb = usePlayback(runId, months);
  const k = useMemo(() => kpisAt(result, pb.visible), [result, pb.visible]);
  const markers = useMemo(() => eventMarkers(rows), [rows]);
  const competitors = result.config.competitors;
  const hasGeneric = rows.some((r) => "generic" in r.competitorShares);

  const data = useMemo(
    () =>
      rows.map((r) => ({
        month: r.month,
        active: Math.round(r.activePatients),
        new: Math.round(r.newPatients),
        churned: Math.round(r.churnedPatients),
        share: r.marketShare * 100,
        physAdoption: r.physicianAdoption * 100,
        physAwareness: r.physicianAwareness * 100,
        patAwareness: r.patientAwareness * 100,
        revenue: r.grossRevenue,
        cost: r.marketingSpend + r.salesforceSpend,
        profit: r.monthlyProfit,
        cumProfit: r.cumulativeProfit,
        marketing: r.marketingSpend,
        ...Object.fromEntries(Object.entries(r.competitorShares).map(([id, v]) => [`c_${id}`, v * 100])),
      })),
    [rows],
  );
  const shown = data.slice(0, pb.visible);

  const yMax = useMemo(
    () => ({
      active: niceMax(Math.max(...data.map((d) => d.active)) * 1.05),
      share: niceMax(Math.max(...data.map((d) => Math.max(d.share, ...competitors.map((c) => (d as Record<string, number>)[`c_${c.id}`] ?? 0)))) * 1.05),
      shareOwn: niceMax(Math.max(...data.map((d) => d.share)) * 1.1),
      revenue: niceMax(Math.max(...data.map((d) => Math.max(d.revenue, d.cost))) * 1.05),
      new: niceMax(Math.max(...data.map((d) => d.new)) * 1.1),
      marketing: niceMax(Math.max(...data.map((d) => d.marketing)) * 1.1),
      cumProfitMax: Math.max(...data.map((d) => d.cumProfit)),
      cumProfitMin: Math.min(...data.map((d) => d.cumProfit)),
    }),
    [data, competitors],
  );

  const [showCompetitors, setShowCompetitors] = useState(true);
  const commonX = <XAxis dataKey="month" type="number" domain={[1, months]} allowDecimals={false} tickCount={Math.min(months, 12)} {...AXIS_PROPS} />;
  const lines = eventLines(markers, pb.visible);

  return (
    <div>
      <PageHeader
        title="Simulation Dashboard"
        subtitle={`${result.config.simulationMonths}-month simulated launch of GlucoNova · ${formatNumber(result.config.marketSize)} eligible patients · seed ${result.config.seed}. Simulated commercial projections only.`}
        actions={
          <>
            <Button size="sm" onClick={pb.toggle} title={pb.playing ? "Pause playback" : "Play"}>
              {pb.playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {pb.playing ? "Pause" : "Play"}
            </Button>
            <Button size="sm" onClick={pb.replay} title="Replay from month 1">
              <RotateCcw className="h-3.5 w-3.5" /> Replay
            </Button>
            <Button size="sm" onClick={pb.skip} title="Jump to the final month">
              <SkipForward className="h-3.5 w-3.5" /> Skip to end
            </Button>
            <ExportButtons
              onCsv={() => downloadCsv(`gluconova-simulation-seed-${result.config.seed}.csv`, monthlyResultsCsv(result))}
              onPdf={async () => {
                const { buildSimulationReport } = await import("@/lib/pdfReport");
                const doc = await buildSimulationReport(result, generateInsights(result));
                downloadBlob(`gluconova-simulation-report-seed-${result.config.seed}.pdf`, doc.output("blob"));
              }}
            />
          </>
        }
      />

      {stale && (
        <div className="mb-5">
          <Callout tone="amber" title="Assumptions changed since this run">
            <span className="mr-3">The dashboard shows the previous configuration.</span>
            <Button size="sm" variant="primary" onClick={onRerun}>
              Run again
            </Button>
          </Callout>
        </div>
      )}

      <div className="mb-6 flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <span className="whitespace-nowrap text-sm font-semibold text-slate-900">Month {pb.visible}</span>
        <input
          type="range"
          className="range"
          min={1}
          max={months}
          step={1}
          value={pb.visible}
          onChange={(e) => pb.setVisible(Number(e.target.value))}
          aria-label="Simulation month"
          style={{ ["--fill" as string]: `${((pb.visible - 1) / Math.max(1, months - 1)) * 100}%` }}
        />
        <span className="whitespace-nowrap text-xs text-slate-500">of {months}</span>
      </div>

      {/* ------------------------------ KPIs ------------------------------ */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <Kpi label="Market share" value={formatPct(k.marketShare)} sub="of eligible patients" tone="good" />
        <Kpi label="Active patients" value={formatNumber(k.activePatients)} sub={`of ${formatNumber(result.config.marketSize)} eligible`} />
        <Kpi label="New patients this month" value={formatNumber(k.newPatients)} />
        <Kpi label="Physician adoption rate" value={formatPct(k.physicianAdoption)} sub="physicians prescribing" />
        <Kpi label="Patient awareness" value={formatPct(k.patientAwareness)} />
        <Kpi label="Physician awareness" value={formatPct(k.physicianAwareness)} />
        <Kpi label="Cumulative revenue" value={formatINR(k.cumulativeRevenue)} sub={`Profit ${formatINR(k.cumulativeProfit)}`} />
        <Kpi label="Marketing ROI" value={roi(k.marketingROI)} sub="incremental vs no marketing" tone={k.marketingROI >= 0 ? "default" : "warn"} />
        <Kpi label="Break-even month" value={k.breakEvenMonth ? `Month ${k.breakEvenMonth}` : "Not yet"} sub="cumulative profit ≥ 0" tone={k.breakEvenMonth ? "good" : "warn"} />
        <Kpi label="Customer acquisition cost" value={formatINR(k.customerAcquisitionCost, { compact: false })} sub="marketing + field force" />
        <Kpi label="Marketing cost / acquired patient" value={formatINR(k.marketingCostPerPatient, { compact: false })} />
        <Kpi label="Avg monthly growth" value={formatPct(k.avgMonthlyGrowthRate)} sub="active patients, geometric" />
      </div>

      {/* ------------------------------ charts ---------------------------- */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Adoption curve" subtitle="Active GlucoNova patients by month">
          <ResponsiveContainer>
            <AreaChart data={shown} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid {...GRID_PROPS} />
              {commonX}
              <YAxis {...AXIS_PROPS} domain={[0, yMax.active]} tickFormatter={formatCompact} width={46} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v) => formatNumber(Number(v))} labelFormatter={(m) => `Month ${m}`} />
              {lines}
              <Area type="monotone" dataKey="active" name="Active patients" stroke={COLORS.brand} strokeWidth={2.5} fill={COLORS.brand} fillOpacity={0.14} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Market share"
          subtitle="GlucoNova share of the eligible patient market"
          right={
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" checked={showCompetitors} onChange={(e) => setShowCompetitors(e.target.checked)} className="accent-teal-700" />
              Competitors
            </label>
          }
        >
          <ResponsiveContainer>
            <LineChart data={shown} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid {...GRID_PROPS} />
              {commonX}
              <YAxis {...AXIS_PROPS} domain={[0, showCompetitors ? yMax.share : yMax.shareOwn]} tickFormatter={(v) => `${v}%`} width={42} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v) => `${Number(v).toFixed(1)}%`} labelFormatter={(m) => `Month ${m}`} />
              {lines}
              <Line type="monotone" dataKey="share" name="GlucoNova" stroke={COLORS.brand} strokeWidth={3} dot={false} isAnimationActive={false} />
              {showCompetitors &&
                competitors.map((c, i) => (
                  <Line key={c.id} type="monotone" dataKey={`c_${c.id}`} name={c.name} stroke={COMPETITOR_COLORS[i % COMPETITOR_COLORS.length]} strokeWidth={1.5} strokeDasharray="5 3" dot={false} isAnimationActive={false} />
                ))}
              {showCompetitors && hasGeneric && (
                <Line type="monotone" dataKey="c_generic" name="Generic entrant" stroke={COLORS.rose} strokeWidth={1.5} dot={false} isAnimationActive={false} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Revenue and recurring cost" subtitle="Monthly gross revenue (bars) vs marketing + field-force cost (line); one-off launch cost excluded">
          <ResponsiveContainer>
            <ComposedChart data={shown} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid {...GRID_PROPS} />
              {commonX}
              <YAxis {...AXIS_PROPS} domain={[0, yMax.revenue]} tickFormatter={(v) => formatINR(v)} width={62} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v) => formatINR(Number(v))} labelFormatter={(m) => `Month ${m}`} />
              {lines}
              <Bar dataKey="revenue" name="Gross revenue" fill={COLORS.brand} fillOpacity={0.85} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Line type="monotone" dataKey="cost" name="Recurring cost" stroke={COLORS.rose} strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Cumulative profit" subtitle="Simulated operating contribution; break-even where the line crosses zero">
          <ResponsiveContainer>
            <AreaChart data={shown} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid {...GRID_PROPS} />
              {commonX}
              <YAxis
                {...AXIS_PROPS}
                domain={[Math.min(0, yMax.cumProfitMin * 1.1), Math.max(1, yMax.cumProfitMax * 1.1)]}
                tickFormatter={(v) => formatINR(v)}
                width={72}
              />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v) => formatINR(Number(v))} labelFormatter={(m) => `Month ${m}`} />
              <ReferenceLine y={0} stroke={COLORS.slate} />
              {lines}
              {k.breakEvenMonth && (
                <ReferenceLine x={k.breakEvenMonth} stroke={COLORS.brand} strokeDasharray="2 2" label={{ value: "Break-even", position: "insideTopLeft", fill: COLORS.brand, fontSize: 10, fontWeight: 600 }} />
              )}
              <Area type="monotone" dataKey="cumProfit" name="Cumulative profit" stroke={COLORS.indigo} strokeWidth={2.5} fill={COLORS.indigo} fillOpacity={0.12} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Physician adoption" subtitle="Share of simulated physicians prescribing GlucoNova, alongside awareness">
          <ResponsiveContainer>
            <LineChart data={shown} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid {...GRID_PROPS} />
              {commonX}
              <YAxis {...AXIS_PROPS} domain={[0, 100]} tickFormatter={(v) => `${v}%`} width={42} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v) => `${Number(v).toFixed(1)}%`} labelFormatter={(m) => `Month ${m}`} />
              {lines}
              <Line type="monotone" dataKey="physAdoption" name="Physicians prescribing" stroke={COLORS.brand} strokeWidth={3} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="physAwareness" name="Physician awareness" stroke={COLORS.indigo} strokeWidth={1.75} strokeDasharray="5 3" dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="patAwareness" name="Patient awareness" stroke={COLORS.sky} strokeWidth={1.75} strokeDasharray="2 3" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Marketing efficiency" subtitle="Monthly marketing spend (bars) vs new patients acquired (line)">
          <ResponsiveContainer>
            <ComposedChart data={shown} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...GRID_PROPS} />
              {commonX}
              <YAxis yAxisId="l" {...AXIS_PROPS} domain={[0, yMax.marketing]} tickFormatter={(v) => formatINR(v)} width={62} />
              <YAxis yAxisId="r" orientation="right" {...AXIS_PROPS} domain={[0, yMax.new]} tickFormatter={formatCompact} width={40} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v, name) => (name === "New patients" ? formatNumber(Number(v)) : formatINR(Number(v)))} labelFormatter={(m) => `Month ${m}`} />
              {lines}
              <Bar yAxisId="l" dataKey="marketing" name="Marketing spend" fill={COLORS.amber} fillOpacity={0.55} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Line yAxisId="r" type="monotone" dataKey="new" name="New patients" stroke={COLORS.brand} strokeWidth={2.5} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <EventLegend markers={markers.filter((m) => m.month <= pb.visible)} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Patient funnel" subtitle="End-of-simulation conversion, scaled to the eligible population">
          <Funnel stages={result.funnel} />
        </Panel>
        <Panel title="Marketing efficiency summary" subtitle="Whole-horizon totals">
          <EfficiencyTable result={result} />
        </Panel>
      </div>

      <div className="mt-6">
        <AnalystPanel result={result} />
      </div>

      <p className="mt-6 text-xs text-slate-500">
        Revenue values are simulated commercial projections. Simulation coefficients chosen for illustrative purposes.
      </p>
    </div>
  );
}

function Funnel({ stages }: { stages: ScenarioResult["funnel"] }) {
  const top = stages[0].value || 1;
  return (
    <ol className="space-y-2.5">
      {stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1].value : null;
        const step = prev && prev > 0 ? s.value / prev : null;
        return (
          <li key={s.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-slate-800">{s.label}</span>
              <span className="tabular-nums text-slate-600">
                {formatNumber(s.value)} <span className="text-xs text-slate-400">· {formatPct(s.value / top, 1)}</span>
                {step !== null && <span className="ml-2 text-xs text-teal-700">{formatPct(step, 0)} of prev</span>}
              </span>
            </div>
            <div className="h-5 rounded bg-slate-100">
              <div
                className="h-5 rounded"
                style={{ width: `${Math.max(1.5, (s.value / top) * 100)}%`, background: COLORS.brand, opacity: 1 - i * 0.11 }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function EfficiencyTable({ result }: { result: ScenarioResult }) {
  const s = result.summaryMetrics;
  const rowsData: [string, string, string?][] = [
    ["Marketing spend", formatINR(s.totalMarketingSpend), "Budget deployed over the horizon"],
    ["Field force & events", formatINR(s.totalSalesforceSpend), "Reps and educational events"],
    ["Patients acquired", formatNumber(s.patientsAcquired), "Ever-adopted, scaled to market"],
    ["Marketing cost per patient", formatINR(s.marketingCostPerPatient, { compact: false }), "Marketing only"],
    ["Customer acquisition cost", formatINR(s.customerAcquisitionCost, { compact: false }), "Marketing + field force"],
    ["Marketing ROI", roi(s.marketingROI), "Incremental margin over a no-marketing launch, net of spend"],
    ["Total launch cost", formatINR(s.totalLaunchCost), "Including fixed launch cost"],
    ["Net revenue / patient-month", formatINR(s.netRevenuePerPatientMonth, { compact: false }), "After discounts, rebates, support"],
  ];
  return (
    <dl className="divide-y divide-slate-100 text-sm">
      {rowsData.map(([k, v, hint]) => (
        <div key={k} className="flex items-baseline justify-between gap-4 py-2">
          <dt>
            <div className="text-slate-800">{k}</div>
            {hint && <div className="text-[11px] text-slate-400">{hint}</div>}
          </dt>
          <dd className="font-semibold tabular-nums text-slate-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
