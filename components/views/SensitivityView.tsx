"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2, Search, Upload, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { SENSITIVITY_VARS, runSensitivity, type SensitivityPoint, type SensitivityVar } from "@/lib/sensitivity";
import { GRID, OBJECTIVE_WEIGHTS, OPTIMIZER_SAMPLE, OptimizerCancelled, applyCandidate, type Candidate, type OptimizerResult } from "@/lib/optimizer";
import { startOptimizer, type OptimizerJob } from "@/lib/optimizerClient";
import { formatINR, formatPct } from "@/lib/format";
import { ExportButtons } from "../ExportButtons";
import { downloadCsv } from "@/lib/download";
import { sensitivityCsv, slug } from "@/lib/export";
import { Badge, Button, Callout, PageHeader, Panel, Segmented, cx } from "../ui";
import { AXIS_PROPS, COLORS, ChartCard, GRID_PROPS, TOOLTIP_STYLE } from "../charts/common";

const CHARTS: { key: keyof SensitivityPoint; title: string; fmt: (v: number) => string; color: string; scale?: number }[] = [
  { key: "share", title: "Market share", fmt: (v) => `${v.toFixed(1)}%`, color: COLORS.brand, scale: 100 },
  { key: "revenue", title: "Cumulative revenue", fmt: (v) => formatINR(v), color: COLORS.indigo },
  { key: "profit", title: "Cumulative profit", fmt: (v) => formatINR(v), color: COLORS.amber },
  { key: "adoption", title: "Patient adoption (ever adopted)", fmt: (v) => `${v.toFixed(1)}%`, color: COLORS.sky, scale: 100 },
];

export function SensitivityView() {
  const { config, replaceConfig, setView, notify } = useStore();
  const [variable, setVariable] = useState<SensitivityVar>("price");
  const [points, setPoints] = useState<SensitivityPoint[] | null>(null);
  const [busy, setBusy] = useState(false);
  const def = SENSITIVITY_VARS.find((d) => d.key === variable)!;
  const configKey = JSON.stringify(config);

  useEffect(() => {
    setBusy(true);
    const t = setTimeout(() => {
      setPoints(runSensitivity(config, variable));
      setBusy(false);
    }, 30);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variable, configKey]);

  const current = def.current(config);
  const numeric = variable !== "competitorStrength";
  const data = useMemo(
    () =>
      (points ?? []).map((p) => ({
        ...p,
        share: p.share * 100,
        adoption: p.adoption * 100,
      })),
    [points],
  );

  const takeaway = useMemo(() => (points ? describe(points, def.label, def.format) : []), [points, def]);

  return (
    <div>
      <PageHeader
        title="Sensitivity Analysis"
        subtitle="Vary one strategic lever at a time, holding every other assumption and the random seed fixed, and watch how simulated outcomes respond."
        actions={
          <>
            {busy && (
              <Badge tone="amber">
                <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Running {def.values.length} simulations…
              </Badge>
            )}
            <ExportButtons disabled={!points || busy} csvLabel="Export sweep CSV" onCsv={() => points && downloadCsv(`gluconova-sensitivity-${slug(def.label)}.csv`, sensitivityCsv(def.label, points))} />
          </>
        }
      />

      <Panel className="mb-6">
        <div className="mb-2 text-sm font-medium text-slate-800">Variable to test</div>
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <Segmented<SensitivityVar>
              label="Variable"
              value={variable}
              onChange={setVariable}
              options={SENSITIVITY_VARS.map((d) => ({ value: d.key, label: d.label.replace("Physician outreach (sales reps)", "Physician outreach") }))}
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Testing {def.values.length} values: {def.values.map(def.format).join(" · ")}. The dashed line marks your current setting ({def.format(current)}).
        </p>
      </Panel>

      {takeaway.length > 0 && (
        <div className="mb-6">
          <Callout tone="teal" title="What moves">
            <ul className="list-disc space-y-1 pl-5">
              {takeaway.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </Callout>
        </div>
      )}

      <div className={cx("grid gap-6 lg:grid-cols-2", busy && "opacity-60")}>
        {CHARTS.map((c) => (
          <ChartCard key={c.key} title={`${def.label} vs ${c.title.toLowerCase()}`} height={250}>
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 12, right: 14, left: 0, bottom: 0 }}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis
                  dataKey={numeric ? "x" : "label"}
                  type={numeric ? "number" : "category"}
                  domain={numeric ? ["dataMin", "dataMax"] : undefined}
                  tickFormatter={numeric ? def.format : undefined}
                  {...AXIS_PROPS}
                  tick={{ fontSize: 10, fill: COLORS.axis }}
                />
                <YAxis {...AXIS_PROPS} tickFormatter={(v) => (c.scale ? `${v}%` : formatINR(v))} width={c.scale ? 42 : 64} domain={c.key === "profit" ? ["auto", "auto"] : [0, "auto"]} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v) => c.fmt(Number(v))} labelFormatter={(l) => (numeric ? def.format(Number(l)) : String(l))} />
                {c.key === "profit" && <ReferenceLine y={0} stroke={COLORS.slate} />}
                {numeric && current >= def.values[0] && current <= def.values[def.values.length - 1] && <ReferenceLine x={current} stroke={COLORS.slate} strokeDasharray="4 3" />}
                {!numeric && <ReferenceLine x={def.format(current)} stroke={COLORS.slate} strokeDasharray="4 3" />}
                <Line type="monotone" dataKey={c.key} name={c.title} stroke={c.color} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        ))}
      </div>

      <Panel className="mt-6 overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-right text-xs text-slate-500">
              <th className="px-4 py-2.5 text-left font-medium">{def.label}</th>
              <th className="px-4 py-2.5 font-medium">Market share</th>
              <th className="px-4 py-2.5 font-medium">Adoption</th>
              <th className="px-4 py-2.5 font-medium">Revenue</th>
              <th className="px-4 py-2.5 font-medium">Profit</th>
              <th className="px-4 py-2.5 font-medium">Break-even</th>
            </tr>
          </thead>
          <tbody>
            {(points ?? []).map((p) => (
              <tr key={p.x} className={cx("border-b border-slate-100 text-right tabular-nums", p.x === current && "bg-teal-50/50")}>
                <td className="px-4 py-2 text-left font-medium text-slate-900">
                  {p.label} {p.x === current && <Badge tone="teal">current</Badge>}
                </td>
                <td className="px-4 py-2">{formatPct(p.share)}</td>
                <td className="px-4 py-2">{formatPct(p.adoption)}</td>
                <td className="px-4 py-2">{formatINR(p.revenue)}</td>
                <td className="px-4 py-2">{formatINR(p.profit)}</td>
                <td className="px-4 py-2">{p.breakEven ? `Month ${p.breakEven}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Optimizer
        onApply={(c) => {
          replaceConfig(applyCandidate(config, c));
          notify("Loaded strategy into the configuration — press Run Simulation");
          setView("configure");
        }}
      />
    </div>
  );
}

/** Plain-language reading of a sweep. Purely descriptive of the simulated curve. */
function describe(points: SensitivityPoint[], label: string, fmt: (v: number) => string): string[] {
  const first = points[0];
  const last = points[points.length - 1];
  const topRev = points.reduce((a, b) => (b.revenue > a.revenue ? b : a));
  const topProfit = points.reduce((a, b) => (b.profit > a.profit ? b : a));
  const out: string[] = [];
  const change = first.adoption > 0 ? (last.adoption - first.adoption) / first.adoption : 0;
  out.push(
    `Across the tested range, simulated patient adoption goes from ${formatPct(first.adoption)} at ${fmt(first.x)} to ${formatPct(last.adoption)} at ${fmt(last.x)} (${change >= 0 ? "+" : ""}${Math.round(change * 100)}%).`,
  );
  const edge = topRev === first || topRev === last;
  out.push(
    edge
      ? `Simulated revenue is highest at the edge of the range (${fmt(topRev.x)}, ${formatINR(topRev.revenue)}), so the ${label.toLowerCase()} lever has not yet hit diminishing returns within these values.`
      : `Simulated revenue peaks around ${fmt(topRev.x)} (${formatINR(topRev.revenue)}) and declines on either side — more adoption does not always mean more revenue.`,
  );
  if (topProfit.x !== topRev.x) out.push(`Simulated profit peaks at ${fmt(topProfit.x)} (${formatINR(topProfit.profit)}), which differs from the revenue peak because costs and net price also move.`);
  return out;
}

function Optimizer({ onApply }: { onApply: (c: Candidate) => void }) {
  const { config } = useStore();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<OptimizerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const job = useRef<OptimizerJob | null>(null);

  // Never leave a background search running after leaving the page.
  useEffect(() => () => job.current?.cancel(), []);

  const go = async () => {
    job.current?.cancel();
    setRunning(true);
    setError(null);
    setProgress(0);
    const j = startOptimizer(config, setProgress);
    job.current = j;
    try {
      setResult(await j.promise);
    } catch (err) {
      if (!(err instanceof OptimizerCancelled)) setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      if (job.current === j) {
        job.current = null;
        setRunning(false);
      }
    }
  };
  const cancel = () => job.current?.cancel();

  return (
    <div className="mt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-slate-900">Find efficient strategies</h3>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Runs a grid search of {GRID.price.length * GRID.marketing.length * GRID.insurance.length * GRID.outreach.length} simulated launches over price (₹1,000–2,200), marketing (₹40 L–1.5 Cr), insurance support (30–70%) and outreach (Low/Medium/High), holding other assumptions at your current configuration. It surfaces trade-offs — not a guaranteed real-world optimum.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {running && (
            <Button onClick={cancel}>
              <X className="h-4 w-4" /> Cancel
            </Button>
          )}
          <Button variant="primary" onClick={go} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {running ? `Searching… ${Math.round(progress * 100)}%` : "Find Efficient Strategy"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <Callout tone="rose" title="The search could not finish">
            {error}
          </Callout>
        </div>
      )}

      {running && (
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden>
          <div className="h-full bg-teal-700 transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      {result && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Archetype title="Highest simulated revenue" c={result.highestRevenue} headline={formatINR(result.highestRevenue.metrics.cumulativeRevenue)} onApply={onApply} />
            <Archetype title="Highest simulated adoption" c={result.highestAdoption} headline={formatPct(result.highestAdoption.metrics.patientAdoptionRate)} onApply={onApply} />
            <Archetype title="Lowest acquisition cost" c={result.lowestAcquisitionCost} headline={`${formatINR(result.lowestAcquisitionCost.metrics.customerAcquisitionCost, { compact: false })} / patient`} onApply={onApply} />
            {result.fastestBreakEven ? (
              <Archetype title="Fastest simulated break-even" c={result.fastestBreakEven} headline={`Month ${result.fastestBreakEven.metrics.breakEvenMonth}`} onApply={onApply} />
            ) : (
              <Panel title="Fastest simulated break-even">
                <p className="text-sm text-slate-500">No strategy in the grid broke even within the horizon.</p>
              </Panel>
            )}
          </div>

          <Panel className="mt-6" title="Efficient trade-off candidates" subtitle={`Ranked by a synthetic objective: ${Math.round(OBJECTIVE_WEIGHTS.profit * 100)}% profit, ${Math.round(OBJECTIVE_WEIGHTS.share * 100)}% share, ${Math.round(OBJECTIVE_WEIGHTS.roi * 100)}% ROI, ${Math.round(OBJECTIVE_WEIGHTS.adoption * 100)}% adoption (each normalised across the grid). These are candidates to discuss, not a universal best.`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-right text-xs text-slate-500">
                    <th className="py-2 text-left font-medium">Strategy</th>
                    <th className="py-2 font-medium">Share</th>
                    <th className="py-2 font-medium">Adoption</th>
                    <th className="py-2 font-medium">Profit</th>
                    <th className="py-2 font-medium">ROI</th>
                    <th className="py-2 font-medium">Score</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {result.tradeoffs.map((c) => (
                    <tr key={`${c.price}-${c.marketing}-${c.insurance}-${c.outreach}`} className="border-b border-slate-100 text-right tabular-nums">
                      <td className="py-2 text-left font-medium text-slate-900">{describeCandidate(c)}</td>
                      <td className="py-2">{formatPct(c.metrics.finalMarketShare)}</td>
                      <td className="py-2">{formatPct(c.metrics.patientAdoptionRate)}</td>
                      <td className="py-2">{formatINR(c.metrics.cumulativeProfit)}</td>
                      <td className="py-2">{c.metrics.marketingROI.toFixed(1)}×</td>
                      <td className="py-2">{c.score.toFixed(2)}</td>
                      <td className="py-2 pl-3">
                        <Button size="sm" onClick={() => onApply(c)}>
                          <Upload className="h-3.5 w-3.5" /> Use
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Evaluated on a {OPTIMIZER_SAMPLE.toLocaleString("en-IN")}-patient sample for speed, so figures can differ slightly from a full run. Several winners sit at the edge of the searched grid, which suggests the true trade-off frontier extends beyond it.
            </p>
          </Panel>
        </>
      )}
    </div>
  );
}

const describeCandidate = (c: Candidate) =>
  `${formatINR(c.price, { compact: false })} · ${formatINR(c.marketing)} marketing · ${Math.round(c.insurance * 100)}% coverage · ${c.outreach} outreach`;

function Archetype({ title, c, headline, onApply }: { title: string; c: Candidate; headline: string; onApply: (c: Candidate) => void }) {
  return (
    <section className="flex flex-col rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium text-slate-500">{title}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-teal-800">{headline}</div>
      <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-600">{describeCandidate(c)}</p>
      <dl className="mt-3 space-y-0.5 text-xs text-slate-500">
        <div className="flex justify-between"><dt>Share</dt><dd className="tabular-nums text-slate-800">{formatPct(c.metrics.finalMarketShare)}</dd></div>
        <div className="flex justify-between"><dt>Profit</dt><dd className="tabular-nums text-slate-800">{formatINR(c.metrics.cumulativeProfit)}</dd></div>
      </dl>
      <div className="mt-3">
        <Button size="sm" onClick={() => onApply(c)}>
          <Upload className="h-3.5 w-3.5" /> Load into Configure
        </Button>
      </div>
    </section>
  );
}
