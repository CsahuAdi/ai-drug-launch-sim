import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, PRESETS, presetConfig } from "@/lib/defaults";
import { runSimulation } from "@/lib/simulation";
import { eventsOnly, findBadNumber, metrics, run } from "./helpers";

describe("output sanity (§31)", () => {
  const cases = [["default", DEFAULT_CONFIG] as const, ...PRESETS.map((p) => [p.key, presetConfig(p)] as const)];

  it.each(cases)("%s: no NaN/Infinity anywhere in the result", (_n, cfg) => {
    const r = runSimulation(cfg);
    expect(findBadNumber({ m: r.monthlyResults, s: r.summaryMetrics, g: r.segmentResults, p: r.physicianResults, f: r.funnel })).toBeNull();
  });

  it.each(cases)("%s: shares, adoption and awareness stay within [0,1]", (_n, cfg) => {
    const r = runSimulation(cfg);
    for (const m of r.monthlyResults) {
      expect(m.marketShare).toBeGreaterThanOrEqual(0);
      expect(m.marketShare).toBeLessThanOrEqual(1);
      expect(m.physicianAdoption).toBeLessThanOrEqual(1);
      expect(m.patientAwareness).toBeLessThanOrEqual(1);
      expect(m.physicianAwareness).toBeLessThanOrEqual(1);
      const total = Object.values(m.competitorShares).reduce((a, b) => a + b, 0) + m.marketShare;
      expect(total).toBeLessThanOrEqual(1.0001);
    }
    expect(r.summaryMetrics.patientAdoptionRate).toBeLessThanOrEqual(1);
  });

  it("returns one row per simulated month and honours every duration option", () => {
    for (const months of [12, 18, 24, 36]) expect(run({ simulationMonths: months }).monthlyResults).toHaveLength(months);
  });

  it("funnel is monotonically non-increasing", () => {
    const f = run().funnel.map((s) => s.value);
    for (let i = 1; i < f.length; i++) expect(f[i]).toBeLessThanOrEqual(f[i - 1] + 1e-9);
    expect(f[0]).toBe(DEFAULT_CONFIG.marketSize);
  });

  it("cumulative fields are consistent with monthly fields", () => {
    const r = run();
    let rev = 0;
    let profit = 0;
    for (const m of r.monthlyResults) {
      rev += m.grossRevenue;
      profit += m.monthlyProfit;
      expect(m.cumulativeRevenue).toBeCloseTo(rev, 3);
      expect(m.cumulativeProfit).toBeCloseTo(profit, 3);
    }
  });

  it("survives extreme inputs without producing invalid numbers", () => {
    const extremes = [
      { marketSize: 25_000, physicianCount: 100, salesReps: 5, marketingBudget: 10e5 },
      { marketSize: 500_000, physicianCount: 5000, salesReps: 150, marketingBudget: 5e7, price: 3000 },
      { price: 500, insuranceCoverage: 1, discountRate: 0.4, affordabilitySupport: "Strong" as const },
      { insuranceCoverage: 0, eventsPerQuarter: 0 },
    ];
    for (const patch of extremes) expect(findBadNumber(run(patch).monthlyResults)).toBeNull();
  });
});

describe("reproducibility (§28)", () => {
  it("same seed + config => identical output", () => {
    expect(JSON.stringify(run().monthlyResults)).toBe(JSON.stringify(run().monthlyResults));
  });

  it("a different seed produces a different synthetic market", () => {
    expect(metrics({ seed: DEFAULT_CONFIG.seed + 1 }).activePatients).not.toBe(metrics().activePatients);
  });
});

describe("directional behaviour (§31)", () => {
  it("higher price => fewer active patients", () => {
    expect(metrics({ price: 2400 }).activePatients).toBeLessThan(metrics({ price: 1200 }).activePatients);
  });

  it("higher insurance coverage => more active patients", () => {
    expect(metrics({ insuranceCoverage: 0.8 }).activePatients).toBeGreaterThan(metrics({ insuranceCoverage: 0.2 }).activePatients);
  });

  it("more reps => higher physician adoption and materially more patients", () => {
    expect(metrics({ salesReps: 80 }).physicianAdoptionRate).toBeGreaterThan(metrics({ salesReps: 8 }).physicianAdoptionRate);
    expect(metrics({ salesReps: 80 }).activePatients).toBeGreaterThan(metrics({ salesReps: 8 }).activePatients * 1.1);
  });

  it("higher outreach intensity => more physician awareness", () => {
    expect(metrics({ outreachIntensity: "High" }).physicianAwareness).toBeGreaterThan(metrics({ outreachIntensity: "Low" }).physicianAwareness);
  });

  it("more marketing => more patient awareness, with diminishing returns", () => {
    const a = metrics({ marketingBudget: 1e7 }).patientAwareness;
    const b = metrics({ marketingBudget: 2e7 }).patientAwareness;
    const c = metrics({ marketingBudget: 4e7 }).patientAwareness;
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(c - b).toBeLessThan(b - a);
  });

  it("10x marketing does not scale ROI", () => {
    expect(metrics({ marketingBudget: 5e8 }).marketingROI).toBeLessThan(metrics({ marketingBudget: 5e7 }).marketingROI);
  });

  it("stronger competitors => fewer active patients", () => {
    expect(metrics({ competitorStrength: "Strong" }).activePatients).toBeLessThan(metrics({ competitorStrength: "Weak" }).activePatients);
  });

  it("higher differentiation => higher physician adoption", () => {
    expect(metrics({ differentiation: "High" }).physicianAdoptionRate).toBeGreaterThan(metrics({ differentiation: "Low" }).physicianAdoptionRate);
  });

  it("an extreme price cut raises adoption but not revenue", () => {
    const cheap = metrics({ price: 500 });
    const mid = metrics({ price: 1600 });
    expect(cheap.activePatients).toBeGreaterThan(mid.activePatients);
    expect(cheap.cumulativeRevenue).toBeLessThan(mid.cumulativeRevenue);
  });

  it("revenue has an interior optimum across the price range", () => {
    const rev = [500, 1100, 1700, 2300, 3000].map((price) => metrics({ price }).cumulativeRevenue);
    const peak = rev.indexOf(Math.max(...rev));
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThan(rev.length - 1);
  });

  it("better adherence attractiveness => more retained patients", () => {
    expect(metrics({ adherenceAttractiveness: "High" }).activePatients).toBeGreaterThan(metrics({ adherenceAttractiveness: "Low" }).activePatients);
  });

  it("affordability support and discounts raise adoption", () => {
    expect(metrics({ affordabilitySupport: "Strong" }).patientAdoptionRate).toBeGreaterThan(metrics({ affordabilitySupport: "None" }).patientAdoptionRate);
    expect(metrics({ discountRate: 0.3 }).patientAdoptionRate).toBeGreaterThan(metrics({ discountRate: 0 }).patientAdoptionRate);
  });
});

describe("competitor events", () => {
  it("a price cut slows adoption and is flagged in its month", () => {
    const ev = run({ competitorEvents: eventsOnly("price_cut") });
    expect(ev.summaryMetrics.activePatients).toBeLessThan(run({ competitorEvents: eventsOnly(null) }).summaryMetrics.activePatients);
    expect(ev.monthlyResults[7].events.length).toBeGreaterThan(0);
    expect(ev.monthlyResults[6].events).toHaveLength(0);
  });

  it("a marketing increase slows adoption", () => {
    expect(metrics({ competitorEvents: eventsOnly("marketing_increase") }).activePatients).toBeLessThan(metrics({ competitorEvents: eventsOnly(null) }).activePatients);
  });

  it("a generic entrant appears in competitor shares only after entry", () => {
    const r = run({ competitorEvents: eventsOnly("generic_entry") });
    expect(r.monthlyResults[10].competitorShares).not.toHaveProperty("generic");
    expect(r.monthlyResults[20].competitorShares).toHaveProperty("generic");
  });

  it("events scheduled beyond the horizon have no effect", () => {
    const late = DEFAULT_CONFIG.competitorEvents.map((e) => ({ ...e, month: 30, enabled: e.type === "price_cut" }));
    expect(metrics({ competitorEvents: late }).activePatients).toBe(metrics({ competitorEvents: eventsOnly(null) }).activePatients);
  });
});

describe("presets and calibration guard rails", () => {
  it("Premium < Balanced < Penetration on market share", () => {
    const [premium, balanced, penetration] = PRESETS.map((p) => runSimulation(presetConfig(p)).summaryMetrics);
    expect(premium.finalMarketShare).toBeLessThan(balanced.finalMarketShare);
    expect(balanced.finalMarketShare).toBeLessThan(penetration.finalMarketShare);
    expect(premium.netRevenuePerPatientMonth).toBeGreaterThan(balanced.netRevenuePerPatientMonth);
  });

  it("the default launch stays in a plausible demo range", () => {
    const s = metrics();
    expect(s.finalMarketShare).toBeGreaterThan(0.05);
    expect(s.finalMarketShare).toBeLessThan(0.25);
    expect(s.breakEvenMonth).not.toBeNull();
    expect(s.breakEvenMonth!).toBeGreaterThan(6);
  });

  it("a single full run completes quickly", () => {
    run(); // warm the population cache
    const t0 = performance.now();
    run({ price: 1700 });
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});
