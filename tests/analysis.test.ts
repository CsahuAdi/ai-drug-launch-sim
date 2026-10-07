import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, PRESETS, presetConfig } from "@/lib/defaults";
import { generateInsights } from "@/lib/insights";
import { runSimulation } from "@/lib/simulation";
import { leaderIndex, tradeoffStatements } from "@/lib/tradeoffs";
import { SENSITIVITY_VARS, runSensitivity } from "@/lib/sensitivity";
import { otherMarketingShare } from "@/lib/defaults";
import { eventsOnly, run } from "./helpers";
import type { SavedScenario } from "@/types/simulation";

const saved = (name: string, patch = {}): SavedScenario => {
  const config = { ...DEFAULT_CONFIG, ...patch };
  return { id: name, name, config, result: runSimulation(config), savedAt: 0 };
};

describe("AI Strategy Analyst (§22)", () => {
  const cases = [["default", DEFAULT_CONFIG] as const, ...PRESETS.map((p) => [p.key, presetConfig(p)] as const)];

  it.each(cases)("%s: returns 3-5 non-empty insights with unique ids", (_n, cfg) => {
    const ins = generateInsights(runSimulation(cfg));
    expect(ins.length).toBeGreaterThanOrEqual(3);
    expect(ins.length).toBeLessThanOrEqual(5);
    expect(new Set(ins.map((i) => i.id)).size).toBe(ins.length);
    for (const i of ins) {
      expect(i.text.length).toBeGreaterThan(30);
      expect(i.text).not.toMatch(/NaN|undefined|Infinity|null/);
    }
  });

  it("is deterministic", () => {
    const r = run();
    expect(generateInsights(r)).toEqual(generateInsights(r));
  });

  it("only mentions a competitor event when one is enabled", () => {
    const withEv = generateInsights(run({ competitorEvents: eventsOnly("price_cut") }));
    const without = generateInsights(run({ competitorEvents: eventsOnly(null) }));
    expect(withEv.some((i) => i.id === "events")).toBe(true);
    expect(without.some((i) => i.id === "events")).toBe(false);
  });

  it("reports a missed break-even honestly", () => {
    const bad = run({ price: 500, marketingBudget: 5e7, salesReps: 150, competitorEvents: eventsOnly(null) });
    expect(bad.summaryMetrics.breakEvenMonth).toBeNull();
    const fin = generateInsights(bad).find((i) => i.id === "finance");
    expect(fin?.text).toMatch(/does not reach break-even/);
  });

  it("never gives medical advice", () => {
    for (const [, cfg] of cases) for (const i of generateInsights(runSimulation(cfg))) expect(i.text).not.toMatch(/\b(cure|treat(s|ment) works|recommend(ed)? for patients|clinically proven)\b/i);
  });
});

describe("scenario trade-offs (§19)", () => {
  const trio = PRESETS.map((p) => saved(p.name, presetConfig(p)));

  it("never declares an overall best scenario", () => {
    for (const t of tradeoffStatements(trio)) expect(t).not.toMatch(/\b(best|optimal|winner|universally)\b/i);
  });

  it("needs at least two scenarios", () => {
    expect(tradeoffStatements([trio[0]])).toEqual([]);
    expect(leaderIndex([trio[0]], "profit")).toBeNull();
  });

  it("identifies genuine leaders per metric", () => {
    expect(leaderIndex(trio, "share")).toBe(2); // Market Penetration
    expect(leaderIndex(trio, "margin")).toBe(0); // Premium
  });

  it("treats near-identical values as a tie, not a lead", () => {
    const a = saved("A");
    const b = saved("B");
    expect(leaderIndex([a, b], "revenue")).toBeNull();
    expect(leaderIndex([a, b], "share")).toBeNull();
  });
});

describe("sensitivity analysis (§20)", () => {
  it("offers all seven variables from the spec", () => {
    expect(SENSITIVITY_VARS.map((v) => v.key).sort()).toEqual(["competitorStrength", "consumerShare", "discountRate", "insuranceCoverage", "marketingBudget", "price", "salesReps"]);
  });

  it("price sweep uses the spec's example grid and monotone adoption", () => {
    const pts = runSensitivity(DEFAULT_CONFIG, "price");
    expect(pts.map((p) => p.x)).toEqual([800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400]);
    for (let i = 1; i < pts.length; i++) expect(pts[i].adoption).toBeLessThan(pts[i - 1].adoption);
  });

  it("the point at the current setting equals a normal run (only one variable is varied)", () => {
    const at = runSensitivity(DEFAULT_CONFIG, "price").find((p) => p.x === 1600)!;
    const direct = run({ price: 1600 }).summaryMetrics;
    expect(at.share).toBe(direct.finalMarketShare);
    expect(at.profit).toBe(direct.cumulativeProfit);
  });

  it("every variable yields finite, ordered points", () => {
    for (const v of SENSITIVITY_VARS) {
      const pts = runSensitivity(DEFAULT_CONFIG, v.key);
      expect(pts).toHaveLength(v.values.length);
      for (const p of pts) for (const n of [p.share, p.revenue, p.profit, p.adoption, p.roi]) expect(Number.isFinite(n)).toBe(true);
    }
  });

  it("consumer-share sweep keeps the four marketing buckets at 100%", () => {
    const def = SENSITIVITY_VARS.find((v) => v.key === "consumerShare")!;
    for (const v of def.values) {
      const c = def.apply(DEFAULT_CONFIG, v);
      expect(c.consumerMarketingShare + c.physicianMarketingShare + c.digitalMarketingShare + otherMarketingShare(c)).toBeCloseTo(1, 9);
      expect(c.physicianMarketingShare).toBeGreaterThanOrEqual(0);
    }
  });

  it("does not mutate the config it is given", () => {
    const before = JSON.stringify(DEFAULT_CONFIG);
    runSensitivity(DEFAULT_CONFIG, "insuranceCoverage");
    expect(JSON.stringify(DEFAULT_CONFIG)).toBe(before);
  });
});
