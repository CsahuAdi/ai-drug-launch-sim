import type { SavedScenario } from "@/types/simulation";
import { formatINR, formatPct } from "./format";

interface Dim {
  key: string;
  phrase: (s: SavedScenario) => string;
  /** Lower value wins when true */
  lowerIsBetter?: boolean;
  value: (s: SavedScenario) => number | null;
}

const DIMS: Dim[] = [
  { key: "revenue", value: (s) => s.result.summaryMetrics.cumulativeRevenue, phrase: (s) => `higher cumulative revenue (${formatINR(s.result.summaryMetrics.cumulativeRevenue)})` },
  { key: "profit", value: (s) => s.result.summaryMetrics.cumulativeProfit, phrase: (s) => `higher cumulative profit (${formatINR(s.result.summaryMetrics.cumulativeProfit)})` },
  { key: "margin", value: (s) => s.result.summaryMetrics.netRevenuePerPatientMonth, phrase: (s) => `higher net revenue per patient-month (${formatINR(s.result.summaryMetrics.netRevenuePerPatientMonth, { compact: false })})` },
  { key: "share", value: (s) => s.result.summaryMetrics.finalMarketShare, phrase: (s) => `larger final market share (${formatPct(s.result.summaryMetrics.finalMarketShare)})` },
  { key: "speed", value: (s) => s.result.summaryMetrics.monthsToHalfFinal, lowerIsBetter: true, phrase: (s) => `faster adoption (half of its final patient base by month ${s.result.summaryMetrics.monthsToHalfFinal})` },
  { key: "cac", value: (s) => s.result.summaryMetrics.customerAcquisitionCost, lowerIsBetter: true, phrase: (s) => `lower acquisition cost (${formatINR(s.result.summaryMetrics.customerAcquisitionCost, { compact: false })} per patient)` },
  { key: "be", value: (s) => s.result.summaryMetrics.breakEvenMonth, lowerIsBetter: true, phrase: (s) => `earlier break-even (month ${s.result.summaryMetrics.breakEvenMonth})` },
  { key: "roi", value: (s) => s.result.summaryMetrics.marketingROI, phrase: (s) => `higher incremental marketing ROI (${s.result.summaryMetrics.marketingROI.toFixed(1)}×)` },
];

export function leaderIndex(scenarios: SavedScenario[], key: string): number | null {
  const d = DIMS.find((x) => x.key === key);
  if (!d || scenarios.length < 2) return null;
  let best: number | null = null;
  let bestVal: number | null = null;
  scenarios.forEach((s, i) => {
    const v = d.value(s);
    if (v === null || !Number.isFinite(v)) return;
    if (bestVal === null || (d.lowerIsBetter ? v < bestVal : v > bestVal)) {
      best = i;
      bestVal = v;
    }
  });
  // no leader when scenarios are level (within 1%) — a tie is not a trade-off
  const vals = scenarios.map((s) => d.value(s)).filter((v): v is number => v !== null && Number.isFinite(v));
  const hi = Math.max(...vals);
  const lo = Math.min(...vals);
  if (vals.length && (hi - lo) / Math.max(Math.abs(hi), 1e-9) < 0.01) return null;
  return best;
}

/**
 * Trade-off sentences. Deliberately never names an overall "best" scenario —
 * each scenario is described by the dimensions on which it leads.
 */
export function tradeoffStatements(scenarios: SavedScenario[]): string[] {
  if (scenarios.length < 2) return [];
  const leads = new Map<number, Dim[]>();
  for (const d of DIMS) {
    const i = leaderIndex(scenarios, d.key);
    if (i === null) continue;
    leads.set(i, [...(leads.get(i) ?? []), d]);
  }
  const out: string[] = [];
  for (const [i, dims] of leads) {
    const s = scenarios[i];
    out.push(`${s.name} shows ${dims.slice(0, 3).map((d) => d.phrase(s)).join(", ")}.`);
  }
  if (out.length > 1) {
    out.push("The scenarios lead on different measures, so the right choice depends on whether the team prioritises margin per patient, speed of adoption, or total profit within the simulated horizon.");
  } else {
    out.push("One scenario leads on most measures in this simulated market, but results are sensitive to the seed and assumptions — check the Sensitivity view before drawing conclusions.");
  }
  return out;
}
