"use client";

import { ArrowRight, Play } from "lucide-react";
import { useStore, type ViewKey } from "@/lib/store";
import { PRESETS } from "@/lib/defaults";
import { formatINR, formatNumber, formatPct } from "@/lib/format";
import { Button, Callout, PageHeader, Panel } from "../ui";

const STEPS: { n: number; title: string; body: string; view: ViewKey }[] = [
  { n: 1, title: "Configure", body: "Set price, marketing mix, field force, coverage and competitor behaviour — or load a preset.", view: "configure" },
  { n: 2, title: "Simulate", body: "Watch 500 synthetic physicians and ~10,000 virtual patients react month by month.", view: "simulation" },
  { n: 3, title: "Compare", body: "Save up to five scenarios and see the trade-offs side by side.", view: "compare" },
  { n: 4, title: "Stress-test", body: "Sweep one lever at a time, or search for efficient strategies.", view: "sensitivity" },
];

export function OverviewView() {
  const { config, loadPreset, run, setView, result, status } = useStore();
  const balanced = PRESETS.find((p) => p.key === "balanced")!;
  const s = result?.summaryMetrics;

  return (
    <div>
      <PageHeader
        title="Simulate a launch before you spend a rupee"
        subtitle="PharmaLaunch AI is a strategy sandbox for a fictional Type-2 diabetes therapy, GlucoNova. Tweak pricing, marketing and access decisions, then see how simulated doctors, patients and competitors respond."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Panel>
            <div className="text-xs font-semibold uppercase tracking-wider text-teal-800">Quick start</div>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">Run the Balanced Launch in one click</h3>
            <p className="mt-1 text-sm text-slate-600">
              Loads {formatINR(balanced.overrides.price ?? 0)}/month pricing, {formatINR(balanced.overrides.marketingBudget ?? 0)} of marketing and{" "}
              {Math.round((balanced.overrides.insuranceCoverage ?? 0) * 100)}% coverage, then simulates 24 months.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  loadPreset(balanced);
                  setTimeout(run, 0);
                }}
              >
                <Play className="h-4 w-4" /> Load Balanced &amp; Run
              </Button>
              <Button onClick={() => setView("configure")}>
                Open configuration <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Panel>

          <div className="grid gap-3 sm:grid-cols-2">
            {STEPS.map((st) => (
              <button
                key={st.n}
                onClick={() => setView(st.view)}
                className="group rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-700 text-xs font-semibold text-white">{st.n}</span>
                  <span className="text-sm font-semibold text-slate-900">{st.title}</span>
                  <ArrowRight className="ml-auto h-4 w-4 text-slate-300 transition-colors group-hover:text-teal-700" />
                </div>
                <p className="mt-2 text-sm text-slate-600">{st.body}</p>
              </button>
            ))}
          </div>

          <Callout tone="amber" title="Not a clinical or forecasting tool">
            This is an educational proof of concept. It does not recommend drugs to patients or make medical claims, and its coefficients are illustrative — not validated for real pharmaceutical forecasting or investment decisions.
          </Callout>
        </div>

        <div className="space-y-6">
          <Panel title="Demo market" subtitle="All values are simulated">
            <dl className="space-y-2 text-sm">
              {[
                ["Drug", "GlucoNova (fictional oral therapy)"],
                ["Therapy area", "Type-2 diabetes"],
                ["Eligible patients", formatNumber(config.marketSize)],
                ["Simulated physicians", formatNumber(config.physicianCount)],
                ["Competitors", config.competitors.map((c) => c.name).join(", ")],
                ["Horizon", `${config.simulationMonths} months`],
                ["Market", "Fictional Indian urban market · INR"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="text-right font-medium text-slate-900">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Latest run" subtitle={status === "stale" ? "Assumptions changed since this run" : undefined}>
            {s ? (
              <dl className="space-y-2 text-sm">
                <Row k="Market share" v={formatPct(s.finalMarketShare)} />
                <Row k="Active patients" v={formatNumber(s.activePatients)} />
                <Row k="Cumulative revenue" v={formatINR(s.cumulativeRevenue)} />
                <Row k="Break-even" v={s.breakEvenMonth ? `Month ${s.breakEvenMonth}` : "Not reached"} />
                <div className="pt-2">
                  <Button size="sm" onClick={() => setView("simulation")}>
                    Open dashboard <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-slate-500">No simulation yet. Run one to populate the dashboard.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{k}</dt>
      <dd className="font-medium tabular-nums text-slate-900">{v}</dd>
    </div>
  );
}
