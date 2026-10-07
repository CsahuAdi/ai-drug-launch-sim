import type { LaunchConfig, Level, ScenarioResult, SummaryMetrics } from "@/types/simulation";
import { LAKH } from "./defaults";
import { runSimulation } from "./simulation";
import { getPopulation } from "./generatePopulation";

export const GRID = {
  price: [1000, 1300, 1600, 1900, 2200],
  marketing: [40 * LAKH, 65 * LAKH, 95 * LAKH, 125 * LAKH, 150 * LAKH],
  insurance: [0.3, 0.45, 0.6, 0.7],
  outreach: ["Low", "Medium", "High"] as Level[],
};

/** Smaller virtual-patient sample keeps a 300-run grid search interactive. */
export const OPTIMIZER_SAMPLE = 4000;

export interface Candidate {
  price: number;
  marketing: number;
  insurance: number;
  outreach: Level;
  metrics: SummaryMetrics;
  /** Synthetic objective in [0,1] — normalised across the grid */
  score: number;
}

export interface OptimizerResult {
  evaluated: number;
  highestRevenue: Candidate;
  highestAdoption: Candidate;
  lowestAcquisitionCost: Candidate;
  fastestBreakEven: Candidate | null;
  tradeoffs: Candidate[];
}

export const OBJECTIVE_WEIGHTS = { profit: 0.35, share: 0.25, roi: 0.2, adoption: 0.2 };

export function applyCandidate(base: LaunchConfig, c: Candidate): LaunchConfig {
  return { ...base, price: c.price, marketingBudget: c.marketing, insuranceCoverage: c.insurance, outreachIntensity: c.outreach };
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export class OptimizerCancelled extends Error {
  constructor() {
    super("Optimizer cancelled");
    this.name = "OptimizerCancelled";
  }
}

export interface OptimizerOptions {
  /** Yield to the event loop every few runs. Needed on the main thread, pointless inside a worker. */
  yieldToEventLoop?: boolean;
  /** Polled between runs; return true to abort with OptimizerCancelled. */
  isCancelled?: () => boolean;
}

export async function findEfficientStrategies(
  base: LaunchConfig,
  onProgress?: (done: number, total: number) => void,
  options: OptimizerOptions = { yieldToEventLoop: true },
): Promise<OptimizerResult> {
  const pop = getPopulation(base.seed, base.physicianCount, OPTIMIZER_SAMPLE, base.competitors.map((c) => c.id));
  const cache = new Map<string, number[]>();
  const total = GRID.price.length * GRID.marketing.length * GRID.insurance.length * GRID.outreach.length;
  const all: Omit<Candidate, "score">[] = [];
  let done = 0;

  for (const price of GRID.price)
    for (const insurance of GRID.insurance)
      for (const outreach of GRID.outreach)
        for (const marketing of GRID.marketing) {
          const cfg: LaunchConfig = { ...base, price, insuranceCoverage: insurance, outreachIntensity: outreach, marketingBudget: marketing };
          const r: ScenarioResult = runSimulation(cfg, { population: pop, counterfactualCache: cache });
          all.push({ price, marketing, insurance, outreach, metrics: r.summaryMetrics });
          done++;
          if (options.isCancelled?.()) throw new OptimizerCancelled();
          if (done % 12 === 0) {
            onProgress?.(done, total);
            if (options.yieldToEventLoop) await tick();
          }
        }
  if (total % 12 !== 0) onProgress?.(total, total); // avoid reporting 100% twice

  const range = (f: (m: SummaryMetrics) => number) => {
    const v = all.map((c) => f(c.metrics));
    const lo = Math.min(...v);
    const hi = Math.max(...v);
    return (x: number) => (hi - lo < 1e-12 ? 0.5 : (x - lo) / (hi - lo));
  };
  const nProfit = range((m) => m.cumulativeProfit);
  const nShare = range((m) => m.finalMarketShare);
  const nRoi = range((m) => m.marketingROI);
  const nAdopt = range((m) => m.patientAdoptionRate);
  const W = OBJECTIVE_WEIGHTS;
  const scored: Candidate[] = all.map((c) => ({
    ...c,
    score: W.profit * nProfit(c.metrics.cumulativeProfit) + W.share * nShare(c.metrics.finalMarketShare) + W.roi * nRoi(c.metrics.marketingROI) + W.adoption * nAdopt(c.metrics.patientAdoptionRate),
  }));

  const pick = (better: (a: Candidate, b: Candidate) => boolean) => scored.reduce((a, b) => (better(b, a) ? b : a));
  const withBE = scored.filter((c) => c.metrics.breakEvenMonth !== null);

  // Trade-off candidates: top by synthetic objective, but keep them meaningfully different.
  const ranked = [...scored].sort((a, b) => b.score - a.score);
  const tradeoffs: Candidate[] = [];
  for (const c of ranked) {
    if (tradeoffs.every((t) => t.price !== c.price || t.outreach !== c.outreach || Math.abs(t.marketing - c.marketing) > 30 * LAKH)) tradeoffs.push(c);
    if (tradeoffs.length === 4) break;
  }

  return {
    evaluated: total,
    highestRevenue: pick((a, b) => a.metrics.cumulativeRevenue > b.metrics.cumulativeRevenue),
    highestAdoption: pick((a, b) => a.metrics.patientAdoptionRate > b.metrics.patientAdoptionRate),
    lowestAcquisitionCost: pick((a, b) => a.metrics.customerAcquisitionCost > 0 && a.metrics.customerAcquisitionCost < b.metrics.customerAcquisitionCost),
    fastestBreakEven: withBE.length
      ? withBE.reduce((a, b) =>
          b.metrics.breakEvenMonth! < a.metrics.breakEvenMonth! || (b.metrics.breakEvenMonth === a.metrics.breakEvenMonth && b.metrics.cumulativeProfit > a.metrics.cumulativeProfit) ? b : a,
        )
      : null,
    tradeoffs,
  };
}
