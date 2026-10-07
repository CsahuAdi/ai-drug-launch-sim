import type {
  AffordabilitySupport,
  IncomeSegment,
  InsuranceStatus,
  LaunchConfig,
  MonthlyResult,
} from "@/types/simulation";
import { clamp } from "./rng";
import { otherMarketingShare } from "./defaults";

/* Fictional financial assumptions (INR). Illustrative only. */
export const COGS_RATE = 0.2;
export const EVENT_COST = 200_000; // per educational event
export const INTENSITY_COST_MULT = { Low: 0.9, Medium: 1, High: 1.2 } as const;

/** Share of list price a patient's insurer covers (spec §11). */
export const INSURANCE_SUPPORT: Record<InsuranceStatus, number> = {
  Covered: 0.7,
  "Partially covered": 0.35,
  "Not covered": 0,
};

/** Fictional payer rebate the company concedes for covered volume. */
export const PAYER_REBATE: Record<InsuranceStatus, number> = {
  Covered: 0.15,
  "Partially covered": 0.08,
  "Not covered": 0,
};

/** Extra price reduction funded by the company for lower-income patients. */
export const AFFORDABILITY_SUPPORT: Record<AffordabilitySupport, Record<IncomeSegment, number>> = {
  None: { Low: 0, "Lower-middle": 0, "Upper-middle": 0, High: 0 },
  Basic: { Low: 0.05, "Lower-middle": 0.05, "Upper-middle": 0, High: 0 },
  Strong: { Low: 0.15, "Lower-middle": 0.12, "Upper-middle": 0.05, High: 0 },
};

/**
 * Coverage c (0-1) => share of patients with any coverage. Up to 65% of patients are
 * "Covered" and the remainder of the covered pool is "Partially covered".
 */
export function resolveInsuranceStatus(rank: number, coverage: number): InsuranceStatus {
  if (rank < 0.65 * coverage) return "Covered";
  if (rank < coverage) return "Partially covered";
  return "Not covered";
}

/** What the patient pays out of pocket per month (spec §11). */
export function patientEffectivePrice(
  config: LaunchConfig,
  status: InsuranceStatus,
  income: IncomeSegment,
): number {
  return (
    config.price *
    (1 - INSURANCE_SUPPORT[status]) *
    (1 - config.discountRate) *
    (1 - AFFORDABILITY_SUPPORT[config.affordabilitySupport][income])
  );
}

/** What the company actually realises per active patient-month. */
export function companyNetPrice(
  config: LaunchConfig,
  status: InsuranceStatus,
  income: IncomeSegment,
): number {
  return (
    config.price *
    (1 - config.discountRate) *
    (1 - PAYER_REBATE[status]) *
    (1 - AFFORDABILITY_SUPPORT[config.affordabilitySupport][income])
  );
}

/** Spend is front-loaded around launch, then tapers. Weights sum to 1. */
export function marketingPhasing(months: number): number[] {
  const raw = Array.from({ length: months }, (_, i) => 1 + 0.9 * Math.exp(-i / 5));
  const total = raw.reduce((s, w) => s + w, 0);
  return raw.map((w) => w / total);
}

export interface MarketingSpend {
  consumer: number;
  physician: number;
  digital: number;
  other: number;
  total: number;
}

export function marketingSpendForMonth(config: LaunchConfig, month: number, weights?: number[]): MarketingSpend {
  const w = (weights ?? marketingPhasing(config.simulationMonths))[month - 1] ?? 0;
  const total = config.marketingBudget * w;
  return {
    consumer: total * config.consumerMarketingShare,
    physician: total * config.physicianMarketingShare,
    digital: total * config.digitalMarketingShare,
    other: total * otherMarketingShare(config),
    total,
  };
}

/** Field force (reps) plus educational events. */
export function salesforceCostForMonth(config: LaunchConfig): number {
  const reps = config.salesReps * config.repMonthlyCost * INTENSITY_COST_MULT[config.outreachIntensity];
  const events = (config.eventsPerQuarter / 3) * EVENT_COST;
  return reps + events;
}

/** One-off launch cost lands in month 1. */
export function fixedCostForMonth(config: LaunchConfig, month: number): number {
  return month === 1 ? config.fixedLaunchCost : 0;
}

/**
 * Fill cumulative fields in-place and compute marketing ROI.
 *
 * Marketing ROI is *incremental*: gross margin generated over a counterfactual launch
 * with zero marketing budget (same reps/events/price), less the marketing spend,
 * divided by the marketing spend. `counterfactualCumMargin[i]` is that baseline.
 */
export function finalizeFinancials(rows: MonthlyResult[], counterfactualCumMargin: number[]): void {
  let cumRev = 0;
  let cumCost = 0;
  let cumProfit = 0;
  let cumMkt = 0;
  let cumMargin = 0;
  rows.forEach((r, i) => {
    cumRev += r.grossRevenue;
    cumCost += r.monthlyCost;
    cumProfit += r.monthlyProfit;
    cumMkt += r.marketingSpend;
    cumMargin += r.netRevenue * (1 - COGS_RATE);
    r.cumulativeRevenue = cumRev;
    r.cumulativeCost = cumCost;
    r.cumulativeProfit = cumProfit;
    r.cumulativeMarketingSpend = cumMkt;
    const incremental = cumMargin - (counterfactualCumMargin[i] ?? 0);
    r.marketingROI = cumMkt > 0 ? clamp((incremental - cumMkt) / cumMkt, -1, 1000) : 0;
  });
}

export function monthlyProfit(netRevenue: number, cost: number): number {
  return netRevenue * (1 - COGS_RATE) - cost;
}

export function breakEvenMonth(rows: MonthlyResult[]): number | null {
  for (const r of rows) if (r.cumulativeProfit >= 0) return r.month;
  return null;
}
