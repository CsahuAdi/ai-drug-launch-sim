import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "@/lib/defaults";
import {
  COGS_RATE,
  breakEvenMonth,
  companyNetPrice,
  finalizeFinancials,
  fixedCostForMonth,
  marketingPhasing,
  marketingSpendForMonth,
  monthlyProfit,
  patientEffectivePrice,
  resolveInsuranceStatus,
  salesforceCostForMonth,
} from "@/lib/financialModel";
import { run } from "./helpers";
import type { MonthlyResult } from "@/types/simulation";

const c = DEFAULT_CONFIG;

describe("price maths (§11)", () => {
  it("effective price = list × (1 − insurance) × (1 − discount)", () => {
    const cfg = { ...c, affordabilitySupport: "None" as const };
    expect(patientEffectivePrice(cfg, "Covered", "High")).toBeCloseTo(1600 * 0.3 * 0.95, 6);
    expect(patientEffectivePrice(cfg, "Partially covered", "High")).toBeCloseTo(1600 * 0.65 * 0.95, 6);
    expect(patientEffectivePrice(cfg, "Not covered", "High")).toBeCloseTo(1600 * 0.95, 6);
  });

  it("affordability support only helps lower-income patients", () => {
    const strong = { ...c, affordabilitySupport: "Strong" as const };
    expect(patientEffectivePrice(strong, "Not covered", "Low")).toBeLessThan(patientEffectivePrice(strong, "Not covered", "High"));
  });

  it("the company keeps payer-covered volume at a rebate, never above list", () => {
    expect(companyNetPrice(c, "Covered", "High")).toBeLessThan(companyNetPrice(c, "Not covered", "High"));
    expect(companyNetPrice(c, "Not covered", "High")).toBeLessThanOrEqual(c.price);
  });
});

describe("insurance resolution", () => {
  it("coverage 0 => nobody covered; coverage 1 => nobody uncovered", () => {
    expect(resolveInsuranceStatus(0.01, 0)).toBe("Not covered");
    expect(resolveInsuranceStatus(0.99, 1)).toBe("Partially covered");
    expect(resolveInsuranceStatus(0.5, 1)).toBe("Covered");
  });

  it("the covered fraction grows monotonically with coverage", () => {
    const share = (cov: number) => Array.from({ length: 1000 }, (_, i) => resolveInsuranceStatus((i + 0.5) / 1000, cov)).filter((s) => s !== "Not covered").length / 1000;
    expect(share(0.3)).toBeCloseTo(0.3, 2);
    expect(share(0.3)).toBeLessThan(share(0.6));
  });
});

describe("costs", () => {
  it("marketing phasing sums to 1 and tapers", () => {
    for (const months of [12, 24, 36]) {
      const w = marketingPhasing(months);
      expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
      expect(w[0]).toBeGreaterThan(w[months - 1]);
    }
  });

  it("monthly marketing spend across the horizon equals the budget and channels sum to the total", () => {
    let total = 0;
    for (let m = 1; m <= c.simulationMonths; m++) {
      const s = marketingSpendForMonth(c, m);
      expect(s.consumer + s.physician + s.digital + s.other).toBeCloseTo(s.total, 4);
      total += s.total;
    }
    expect(total).toBeCloseTo(c.marketingBudget, 2);
  });

  it("salesforce cost scales with reps and intensity", () => {
    const base = salesforceCostForMonth(c);
    expect(salesforceCostForMonth({ ...c, salesReps: 50 })).toBeGreaterThan(base);
    expect(salesforceCostForMonth({ ...c, outreachIntensity: "High" })).toBeGreaterThan(base);
    expect(salesforceCostForMonth({ ...c, salesReps: 25, eventsPerQuarter: 0, outreachIntensity: "Medium" })).toBeCloseTo(25 * 85_000, 6);
  });

  it("the fixed launch cost lands in month 1 only", () => {
    expect(fixedCostForMonth(c, 1)).toBe(c.fixedLaunchCost);
    expect(fixedCostForMonth(c, 2)).toBe(0);
  });

  it("profit = net revenue × (1 − COGS) − cost", () => {
    expect(monthlyProfit(1000, 300)).toBeCloseTo(1000 * (1 - COGS_RATE) - 300, 9);
  });
});

describe("summary financials", () => {
  const mk = (profits: number[]): MonthlyResult[] =>
    profits.map((p, i) => ({ month: i + 1, monthlyProfit: p, grossRevenue: 0, monthlyCost: 0, netRevenue: 0, marketingSpend: 0, cumulativeProfit: 0 }) as unknown as MonthlyResult);

  it("break-even is the first month cumulative profit reaches zero", () => {
    const rows = mk([-100, -50, 80, 100]);
    finalizeFinancials(rows, []);
    expect(breakEvenMonth(rows)).toBe(4);
  });

  it("break-even is null when the launch never recovers", () => {
    const rows = mk([-100, -10, -5]);
    finalizeFinancials(rows, []);
    expect(breakEvenMonth(rows)).toBeNull();
  });

  it("zero marketing budget gives zero ROI rather than NaN", () => {
    expect(run({ marketingBudget: 0 }).summaryMetrics.marketingROI).toBe(0);
  });

  it("net revenue never exceeds gross revenue", () => {
    for (const m of run().monthlyResults) expect(m.netRevenue).toBeLessThanOrEqual(m.grossRevenue + 1e-6);
  });

  it("total launch cost = marketing + salesforce + fixed", () => {
    const s = run().summaryMetrics;
    expect(s.totalLaunchCost).toBeCloseTo(s.totalMarketingSpend + s.totalSalesforceSpend + c.fixedLaunchCost, 2);
  });
});
