"use client";

import { Play, RotateCcw, Shuffle } from "lucide-react";
import { useStore } from "@/lib/store";
import { CRORE, LAKH, PRESETS, otherMarketingShare } from "@/lib/defaults";
import { allocations, rebalance, type AllocKey } from "@/lib/allocation";
import { EVENT_COST } from "@/lib/financialModel";
import { formatINR, formatNumber } from "@/lib/format";
import type {
  AffordabilitySupport,
  CompetitorEvent,
  CompetitorStrength,
  LaunchConfig,
  Level,
} from "@/types/simulation";
import { Badge, Button, Callout, Field, NumberBox, PageHeader, Panel, SectionLabel, Segmented, SelectBox, SliderField, Toggle, cx } from "../ui";

const LEVELS: { value: Level; label: string }[] = [
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" },
];

const ALLOC: { key: AllocKey; label: string; color: string }[] = [
  { key: "consumer", label: "Consumer awareness", color: "bg-teal-600" },
  { key: "physician", label: "Physician marketing", color: "bg-indigo-500" },
  { key: "digital", label: "Digital campaign", color: "bg-amber-500" },
  { key: "other", label: "Other marketing", color: "bg-slate-400" },
];

function eventSentence(ev: CompetitorEvent): string {
  if (ev.type === "price_cut") return "Competitor reduces price";
  if (ev.type === "marketing_increase") return "Competitor increases marketing";
  return "New generic competitor enters the market";
}

export function ConfigView() {
  const { config, updateConfig, loadPreset, resetConfig, run, reseed, status } = useStore();
  const alloc = allocations(config);
  const c = config;

  const updateEvent = (id: string, patch: Partial<CompetitorEvent>) =>
    updateConfig({ competitorEvents: c.competitorEvents.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const updateCompetitor = (id: string, price: number) =>
    updateConfig({ competitors: c.competitors.map((x) => (x.id === id ? { ...x, price } : x)) });

  const salesforceTotal =
    c.simulationMonths *
    (c.salesReps * c.repMonthlyCost * ({ Low: 0.9, Medium: 1, High: 1.2 } as const)[c.outreachIntensity] +
      (c.eventsPerQuarter / 3) * EVENT_COST);
  const commitment = c.marketingBudget + salesforceTotal + c.fixedLaunchCost;

  return (
    <div>
      <PageHeader
        title="Configure Launch"
        subtitle="Define the GlucoNova launch strategy. Every input feeds the simulation — change a lever, run again, and watch physicians, patients, share and profit respond."
        actions={
          <>
            <Button variant="ghost" onClick={resetConfig}>
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
            <Button variant="primary" onClick={run} disabled={status === "running"}>
              <Play className="h-4 w-4" /> Run Simulation
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => loadPreset(p)}
            className="rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-teal-600 hover:bg-teal-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">{p.name}</span>
              <Badge tone="teal">Load</Badge>
            </div>
            <p className="mt-1 text-xs text-slate-600">{p.blurb}</p>
            <p className="mt-2 text-xs tabular-nums text-slate-500">
              {formatINR(p.overrides.price ?? 0)}/mo · {formatINR(p.overrides.marketingBudget ?? 0)} marketing ·{" "}
              {Math.round((p.overrides.insuranceCoverage ?? 0) * 100)}% coverage
            </p>
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {/* ---------------- Market ---------------- */}
          <Panel>
            <SectionLabel>Market assumptions</SectionLabel>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <SliderField
                label="Eligible patient population"
                value={c.marketSize}
                onChange={(v) => updateConfig({ marketSize: v })}
                min={25_000}
                max={500_000}
                step={5_000}
                hint="Simulated with ~10,000 virtual patients, scaled to this size."
              />
              <SliderField
                label="Number of physicians"
                value={c.physicianCount}
                onChange={(v) => updateConfig({ physicianCount: v })}
                min={100}
                max={5000}
                step={50}
              />
              <Field label="Simulation duration">
                <Segmented
                  label="Simulation duration"
                  value={c.simulationMonths}
                  onChange={(v) => updateConfig({ simulationMonths: v })}
                  options={[12, 18, 24, 36].map((m) => ({ value: m, label: `${m} mo` }))}
                />
              </Field>
              <Field label="Random seed" hint="Same seed + same inputs = identical results. Reseed for a different synthetic market.">
                <div className="flex items-center gap-2">
                  <NumberBox
                    ariaLabel="Random seed"
                    value={c.seed}
                    onChange={(v) => updateConfig({ seed: v })}
                    min={1}
                    max={2_000_000_000}
                    width="w-36"
                  />
                  <Button size="sm" onClick={reseed}>
                    <Shuffle className="h-3.5 w-3.5" /> Reseed
                  </Button>
                </div>
              </Field>
            </div>
            <p className="mt-4 text-xs text-slate-500">Geographic market: fictional Indian urban market · Currency: INR</p>
          </Panel>

          {/* ---------------- Drug ---------------- */}
          <Panel>
            <SectionLabel>Drug strategy</SectionLabel>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <SliderField
                  label="Monthly drug price"
                  value={c.price}
                  onChange={(v) => updateConfig({ price: v })}
                  min={500}
                  max={3000}
                  step={50}
                  prefix="₹"
                  hint="List price per patient per month, before insurance and discounts."
                />
              </div>
              <Field label="Perceived clinical differentiation" hint="How differentiated physicians perceive the fictional product to be (simulation variable only).">
                <Segmented label="Differentiation" options={LEVELS} value={c.differentiation} onChange={(v) => updateConfig({ differentiation: v })} />
              </Field>
              <Field label="Convenience advantage">
                <Segmented label="Convenience" options={LEVELS} value={c.convenienceAdvantage} onChange={(v) => updateConfig({ convenienceAdvantage: v })} />
              </Field>
              <Field label="Patient adherence attractiveness" hint="Higher attractiveness lowers simulated monthly drop-off.">
                <Segmented label="Adherence" options={LEVELS} value={c.adherenceAttractiveness} onChange={(v) => updateConfig({ adherenceAttractiveness: v })} />
              </Field>
            </div>
          </Panel>

          {/* ---------------- Marketing ---------------- */}
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionLabel>Marketing strategy</SectionLabel>
              <Badge tone="teal">Allocation total: 100%</Badge>
            </div>
            <div className="mt-4">
              <SliderField
                label="Total marketing budget"
                value={c.marketingBudget}
                onChange={(v) => updateConfig({ marketingBudget: v })}
                min={10 * LAKH}
                max={5 * CRORE}
                step={5 * LAKH}
                scale={LAKH}
                prefix="₹"
                suffix=" L"
                hint={`= ${formatINR(c.marketingBudget)}. Front-loaded around launch, then tapering.`}
              />
            </div>
            <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden>
              {ALLOC.map((a) => (
                <div key={a.key} className={a.color} style={{ width: `${alloc[a.key]}%` }} />
              ))}
            </div>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              {ALLOC.map((a) => (
                <div key={a.key}>
                  <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
                    <span className={cx("h-2.5 w-2.5 rounded-sm", a.color)} /> {a.label}
                  </div>
                  <SliderField
                    label={a.label}
                    value={alloc[a.key]}
                    onChange={(v) => updateConfig(rebalance(c, a.key, v))}
                    min={0}
                    max={100}
                    step={1}
                    suffix="%"
                  />
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">Adjusting one allocation rescales the others so the total always stays at 100%.</p>
          </Panel>

          {/* ---------------- Outreach ---------------- */}
          <Panel>
            <SectionLabel>Physician outreach</SectionLabel>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <SliderField label="Sales representatives" value={c.salesReps} onChange={(v) => updateConfig({ salesReps: v })} min={5} max={150} step={1} hint={`${formatINR(c.repMonthlyCost, { compact: false })} per rep per month (fictional).`} />
              <SliderField label="Educational events per quarter" value={c.eventsPerQuarter} onChange={(v) => updateConfig({ eventsPerQuarter: v })} min={0} max={30} step={1} hint={`${formatINR(EVENT_COST, { compact: false })} per event (fictional).`} />
              <Field label="Physician outreach intensity" hint="Call frequency. High reaches more physicians but costs more per rep.">
                <Segmented label="Outreach intensity" options={LEVELS} value={c.outreachIntensity} onChange={(v) => updateConfig({ outreachIntensity: v })} />
              </Field>
            </div>
          </Panel>

          {/* ---------------- Access ---------------- */}
          <Panel>
            <SectionLabel>Patient accessibility</SectionLabel>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <SliderField
                label="Insurance coverage"
                value={c.insuranceCoverage}
                onChange={(v) => updateConfig({ insuranceCoverage: v })}
                min={0}
                max={1}
                step={0.01}
                scale={0.01}
                suffix="%"
                hint="Share of patients with some reimbursement. Payers extract rebates from the company."
              />
              <SliderField
                label="Patient discount / rebate"
                value={c.discountRate}
                onChange={(v) => updateConfig({ discountRate: v })}
                min={0}
                max={0.4}
                step={0.01}
                scale={0.01}
                suffix="%"
                hint="Funded by the company; reduces both patient price and net revenue."
              />
              <Field label="Patient affordability support" hint="Extra company-funded price relief targeted at lower-income patients.">
                <Segmented<AffordabilitySupport>
                  label="Affordability support"
                  options={[
                    { value: "None", label: "None" },
                    { value: "Basic", label: "Basic" },
                    { value: "Strong", label: "Strong" },
                  ]}
                  value={c.affordabilitySupport}
                  onChange={(v) => updateConfig({ affordabilitySupport: v })}
                />
              </Field>
            </div>
          </Panel>

          {/* ---------------- Competition ---------------- */}
          <Panel>
            <SectionLabel>Competition</SectionLabel>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <Field label="Competitor strength">
                <Segmented<CompetitorStrength>
                  label="Competitor strength"
                  options={[
                    { value: "Weak", label: "Weak" },
                    { value: "Moderate", label: "Moderate" },
                    { value: "Strong", label: "Strong" },
                  ]}
                  value={c.competitorStrength}
                  onChange={(v) => updateConfig({ competitorStrength: v })}
                />
              </Field>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="py-2 font-medium">Competitor (fictional)</th>
                    <th className="py-2 text-right font-medium">Baseline share</th>
                    <th className="py-2 text-right font-medium">Monthly price</th>
                  </tr>
                </thead>
                <tbody>
                  {c.competitors.map((comp) => (
                    <tr key={comp.id} className="border-b border-slate-100">
                      <td className="py-2 font-medium text-slate-900">
                        {comp.name} <span className="text-xs font-normal text-slate-400">Competitor {comp.id}</span>
                      </td>
                      <td className="py-2 text-right tabular-nums text-slate-600">{Math.round(comp.baseShare * 100)}%</td>
                      <td className="py-2 text-right">
                        <NumberBox ariaLabel={`${comp.name} price`} value={comp.price} onChange={(v) => updateCompetitor(comp.id, v)} min={300} max={4000} step={50} prefix="₹" width="w-28" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4 className="mb-2 mt-6 text-sm font-semibold text-slate-900">Future competitor events</h4>
            <div className="space-y-2">
              {c.competitorEvents.map((ev) => (
                <div key={ev.id} className={cx("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2.5", ev.enabled ? "border-teal-200 bg-teal-50/40" : "border-slate-200")}>
                  <Toggle checked={ev.enabled} onChange={(v) => updateEvent(ev.id, { enabled: v })} label={eventSentence(ev)} />
                  <span className="min-w-[10rem] flex-1 text-sm text-slate-800">{eventSentence(ev)}</span>
                  {ev.type !== "generic_entry" && (
                    <>
                      <span className="text-xs text-slate-500">
                        {ev.type === "price_cut" ? "by" : "by +"}
                      </span>
                      <NumberBox ariaLabel="Event magnitude" value={ev.magnitude} onChange={(v) => updateEvent(ev.id, { magnitude: v })} min={0.05} max={0.6} step={0.05} scale={0.01} suffix="%" width="w-20" />
                      <SelectBox
                        ariaLabel="Target competitor"
                        value={ev.competitorId}
                        onChange={(v) => updateEvent(ev.id, { competitorId: v })}
                        options={[{ value: "all", label: "All competitors" }, ...c.competitors.map((x) => ({ value: x.id, label: x.name }))]}
                      />
                    </>
                  )}
                  <span className="text-xs text-slate-500">in month</span>
                  <NumberBox ariaLabel="Event month" value={ev.month} onChange={(v) => updateEvent(ev.id, { month: v })} min={1} max={36} step={1} width="w-16" />
                  {ev.enabled && ev.month > c.simulationMonths && <Badge tone="amber">Beyond horizon</Badge>}
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* ---------------- Snapshot rail ---------------- */}
        <aside className="xl:sticky xl:top-36 xl:self-start">
          <Panel title="Launch snapshot" subtitle="Live view of your commitments (simulated)">
            <dl className="space-y-2 text-sm">
              {[
                ["Monthly price", formatINR(c.price)],
                ["Marketing budget", formatINR(c.marketingBudget)],
                ["Field force + events", formatINR(salesforceTotal)],
                ["Fixed launch cost", formatINR(c.fixedLaunchCost)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="font-medium tabular-nums text-slate-900">{v}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t border-slate-200 pt-2">
                <dt className="font-medium text-slate-700">Total commitment</dt>
                <dd className="font-semibold tabular-nums text-slate-900">{formatINR(commitment)}</dd>
              </div>
            </dl>
            <div className="mt-4 text-xs text-slate-500">
              {formatNumber(c.marketSize)} eligible patients · {formatNumber(c.physicianCount)} physicians · {c.simulationMonths} months ·{" "}
              {c.salesReps} reps · {Math.round(c.insuranceCoverage * 100)}% coverage
            </div>
            <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
              {ALLOC.map((a) => (
                <div key={a.key} className={a.color} style={{ width: `${alloc[a.key]}%` }} />
              ))}
            </div>
            <div className="mt-1.5 text-[11px] text-slate-500">
              Consumer {alloc.consumer}% · Physician {alloc.physician}% · Digital {alloc.digital}% · Other {Math.round(otherMarketingShare(c) * 100)}%
            </div>
            <div className="mt-5">
              <Button variant="primary" onClick={run} disabled={status === "running"}>
                <Play className="h-4 w-4" /> Run Simulation
              </Button>
            </div>
          </Panel>
          <div className="mt-4">
            <Callout tone="amber">
              Coefficients are illustrative, chosen for a teaching prototype. Outputs are simulated commercial projections, not forecasts.
            </Callout>
          </div>
        </aside>
      </div>
    </div>
  );
}
