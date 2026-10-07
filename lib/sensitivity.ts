import type { CompetitorStrength, LaunchConfig } from "@/types/simulation";
import { CRORE, LAKH, otherMarketingShare } from "./defaults";
import { formatINR } from "./format";
import { runSimulation } from "./simulation";

export type SensitivityVar =
  | "price"
  | "marketingBudget"
  | "insuranceCoverage"
  | "salesReps"
  | "consumerShare"
  | "discountRate"
  | "competitorStrength";

export interface SensitivityDef {
  key: SensitivityVar;
  label: string;
  values: number[];
  format: (v: number) => string;
  current: (c: LaunchConfig) => number;
  apply: (c: LaunchConfig, v: number) => LaunchConfig;
}

const STRENGTHS: CompetitorStrength[] = ["Weak", "Moderate", "Strong"];

export const SENSITIVITY_VARS: SensitivityDef[] = [
  {
    key: "price",
    label: "Price",
    values: [800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400],
    format: (v) => formatINR(v, { compact: false }),
    current: (c) => c.price,
    apply: (c, v) => ({ ...c, price: v }),
  },
  {
    key: "marketingBudget",
    label: "Marketing budget",
    values: [10, 25, 40, 60, 80, 120, 200, 300, 500].map((l) => l * LAKH),
    format: (v) => formatINR(v),
    current: (c) => c.marketingBudget,
    apply: (c, v) => ({ ...c, marketingBudget: v }),
  },
  {
    key: "insuranceCoverage",
    label: "Insurance coverage",
    values: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
    format: (v) => `${Math.round(v * 100)}%`,
    current: (c) => c.insuranceCoverage,
    apply: (c, v) => ({ ...c, insuranceCoverage: v }),
  },
  {
    key: "salesReps",
    label: "Physician outreach (sales reps)",
    values: [5, 10, 20, 30, 40, 60, 80, 100, 150],
    format: (v) => `${v} reps`,
    current: (c) => c.salesReps,
    apply: (c, v) => ({ ...c, salesReps: v }),
  },
  {
    key: "consumerShare",
    label: "Consumer marketing share",
    values: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
    format: (v) => `${Math.round(v * 100)}%`,
    current: (c) => c.consumerMarketingShare,
    // Physician share absorbs the change so the total stays 100% and only the mix moves.
    apply: (c, v) => {
      const other = otherMarketingShare(c);
      return { ...c, consumerMarketingShare: v, physicianMarketingShare: Math.max(0, 1 - v - c.digitalMarketingShare - other) };
    },
  },
  {
    key: "discountRate",
    label: "Discount rate",
    values: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4],
    format: (v) => `${Math.round(v * 100)}%`,
    current: (c) => c.discountRate,
    apply: (c, v) => ({ ...c, discountRate: v }),
  },
  {
    key: "competitorStrength",
    label: "Competitor strength",
    values: [0, 1, 2],
    format: (v) => STRENGTHS[v],
    current: (c) => STRENGTHS.indexOf(c.competitorStrength),
    apply: (c, v) => ({ ...c, competitorStrength: STRENGTHS[v] }),
  },
];

export interface SensitivityPoint {
  x: number;
  label: string;
  share: number;
  revenue: number;
  profit: number;
  adoption: number;
  activePatients: number;
  roi: number;
  breakEven: number | null;
}

/** Vary ONE parameter, hold everything else (including the seed) fixed. */
export function runSensitivity(config: LaunchConfig, key: SensitivityVar): SensitivityPoint[] {
  const def = SENSITIVITY_VARS.find((d) => d.key === key)!;
  return def.values.map((v) => {
    const s = runSimulation(def.apply(config, v)).summaryMetrics;
    return {
      x: v,
      label: def.format(v),
      share: s.finalMarketShare,
      revenue: s.cumulativeRevenue,
      profit: s.cumulativeProfit,
      adoption: s.patientAdoptionRate,
      activePatients: s.activePatients,
      roi: s.marketingROI,
      breakEven: s.breakEvenMonth,
    };
  });
}

export const MARKETING_HINT = `${formatINR(10 * LAKH)}–${formatINR(5 * CRORE)}`;
