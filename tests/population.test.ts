import { describe, expect, it } from "vitest";
import { clamp, hash01, mulberry32, sigmoid } from "@/lib/rng";
import { generatePatients, generatePhysicians, getPopulation, PHYSICIAN_SEGMENTS } from "@/lib/generatePopulation";
import { allocations, rebalance } from "@/lib/allocation";
import { DEFAULT_CONFIG } from "@/lib/defaults";

describe("rng", () => {
  it("mulberry32 is deterministic and within [0,1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("hash01 is stateless, bounded and roughly uniform", () => {
    expect(hash01(1, 2, 3)).toBe(hash01(1, 2, 3));
    expect(hash01(1, 2, 3)).not.toBe(hash01(1, 2, 4));
    let sum = 0;
    for (let i = 0; i < 5000; i++) {
      const v = hash01(7, i, 5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / 5000).toBeCloseTo(0.5, 1);
  });

  it("clamp and sigmoid behave at the edges", () => {
    expect(clamp(NaN)).toBe(0);
    expect(clamp(Infinity)).toBe(0);
    expect(clamp(5)).toBe(1);
    expect(clamp(-5)).toBe(0);
    expect(sigmoid(0)).toBe(0.5);
    expect(sigmoid(-1000)).toBe(0);
    expect(sigmoid(1000)).toBe(1);
  });
});

describe("synthetic physicians (§5)", () => {
  const phys = generatePhysicians(123, 2000, ["A", "B", "C"]);

  it("are deterministic per seed and differ across seeds", () => {
    expect(generatePhysicians(123, 50, ["A"])).toEqual(generatePhysicians(123, 50, ["A"]));
    expect(generatePhysicians(124, 50, ["A"])).not.toEqual(generatePhysicians(123, 50, ["A"]));
  });

  it("respect documented ranges", () => {
    for (const p of phys) {
      expect(p.patientVolume).toBeGreaterThanOrEqual(50);
      expect(p.patientVolume).toBeLessThanOrEqual(500);
      expect(p.launchAwareness).toBeGreaterThanOrEqual(0.05);
      expect(p.launchAwareness).toBeLessThanOrEqual(0.25);
      for (const k of ["innovationTendency", "priceSensitivity", "evidenceSensitivity", "peerInfluence", "marketingResponsiveness", "brandFamiliarity"] as const) {
        expect(p[k]).toBeGreaterThanOrEqual(0);
        expect(p[k]).toBeLessThanOrEqual(1);
      }
    }
  });

  it("match the segment mix and segment personalities", () => {
    const share = (s: string) => phys.filter((p) => p.segment === s).length / phys.length;
    expect(share("Mainstream")).toBeCloseTo(0.4, 1);
    expect(share("Innovators")).toBeCloseTo(0.08, 1);
    const mean = (seg: string, k: "innovationTendency" | "priceSensitivity") => {
      const xs = phys.filter((p) => p.segment === seg).map((p) => p[k]);
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    expect(mean("Innovators", "innovationTendency")).toBeGreaterThan(mean("Traditionalists", "innovationTendency") + 0.4);
    expect(mean("Price-sensitive", "priceSensitivity")).toBeGreaterThan(mean("Innovators", "priceSensitivity") + 0.3);
    expect(PHYSICIAN_SEGMENTS.every((s) => share(s) > 0)).toBe(true);
  });
});

describe("synthetic patients (§6)", () => {
  const physicians = generatePhysicians(9, 300, ["A"]);
  const patients = generatePatients(9, 5000, physicians);

  it("assign every patient to a valid physician and keep attributes in range", () => {
    for (const p of patients) {
      expect(p.physicianIndex).toBeGreaterThanOrEqual(0);
      expect(p.physicianIndex).toBeLessThan(physicians.length);
      expect(p.age).toBeGreaterThanOrEqual(25);
      expect(p.age).toBeLessThanOrEqual(85);
      expect(p.priceSensitivity).toBeGreaterThanOrEqual(0);
      expect(p.priceSensitivity).toBeLessThanOrEqual(1);
      expect(p.affordabilityBudget).toBeGreaterThan(0);
    }
  });

  it("insurance rank is a uniform percentile so coverage c => ~c of patients covered", () => {
    const mean = patients.reduce((s, p) => s + p.insuranceRank, 0) / patients.length;
    expect(mean).toBeCloseTo(0.5, 2);
    expect(patients.filter((p) => p.insuranceRank < 0.3).length / patients.length).toBeCloseTo(0.3, 2);
  });

  it("higher-income patients skew to lower (more-insured) ranks and lower price sensitivity", () => {
    const avg = (seg: string, f: (p: (typeof patients)[number]) => number) => {
      const xs = patients.filter((p) => p.incomeSegment === seg).map(f);
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    expect(avg("High", (p) => p.insuranceRank)).toBeLessThan(avg("Low", (p) => p.insuranceRank));
    expect(avg("High", (p) => p.priceSensitivity)).toBeLessThan(avg("Low", (p) => p.priceSensitivity));
  });

  it("population cache returns the same object for the same key", () => {
    expect(getPopulation(5, 100, 500)).toBe(getPopulation(5, 100, 500));
  });
});

describe("marketing allocation rebalancing (§4)", () => {
  const total = (c: ReturnType<typeof allocations>) => c.consumer + c.physician + c.digital + c.other;

  it("always totals 100% for any single edit", () => {
    for (const key of ["consumer", "physician", "digital", "other"] as const) {
      for (const v of [0, 1, 7, 33, 50, 64, 99, 100]) {
        const next = { ...DEFAULT_CONFIG, ...rebalance(DEFAULT_CONFIG, key, v) };
        const a = allocations(next);
        expect(total(a)).toBe(100);
        expect(a[key]).toBe(v);
        for (const k of Object.keys(a) as (keyof typeof a)[]) expect(a[k]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("stays at 100% across a long random sequence of edits", () => {
    let cfg = { ...DEFAULT_CONFIG };
    const rand = mulberry32(1);
    const keys = ["consumer", "physician", "digital", "other"] as const;
    for (let i = 0; i < 300; i++) {
      cfg = { ...cfg, ...rebalance(cfg, keys[Math.floor(rand() * 4)], Math.floor(rand() * 101)) };
      expect(total(allocations(cfg))).toBe(100);
    }
  });

  it("rescales the other buckets proportionally", () => {
    const a = allocations({ ...DEFAULT_CONFIG, ...rebalance(DEFAULT_CONFIG, "consumer", 60) });
    expect(a.physician).toBeGreaterThan(a.digital);
    expect(a.digital).toBeGreaterThan(a.other);
  });
});
