"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { ScenarioResult } from "@/types/simulation";
import { generateInsights, type Insight } from "@/lib/insights";
import { Badge } from "./ui";

/** Rule-based "AI Strategy Analyst": no LLM call; every line is derived from the simulation. */
export function AnalystPanel({ result }: { result: ScenarioResult }) {
  const [insights, setInsights] = useState<Insight[] | null>(null);

  useEffect(() => {
    setInsights(null);
    // Probes re-run the simulator a few times; defer a tick so the dashboard paints first.
    const t = setTimeout(() => setInsights(generateInsights(result)), 60);
    return () => clearTimeout(t);
  }, [result]);

  return (
    <section className="rounded-xl border border-teal-200 bg-teal-50/40 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-700 text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">AI Strategy Analyst</h3>
            <p className="text-xs text-slate-500">Rule-based observations generated from this simulation run</p>
          </div>
        </div>
        <Badge tone="teal">Simulated · not a forecast</Badge>
      </div>
      {!insights ? (
        <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Analysing simulation and running what-if probes…
        </div>
      ) : (
        <ol className="space-y-3">
          {insights.map((i, n) => (
            <li key={i.id} className="flex gap-3 text-sm leading-relaxed text-slate-800">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-700 text-[11px] font-semibold text-white">{n + 1}</span>
              <span>
                {i.text}{" "}
                {i.basis === "probe" && <span className="whitespace-nowrap rounded bg-white px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">what-if probe</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
