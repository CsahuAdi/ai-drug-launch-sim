import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "@/lib/defaults";
import { GRID, OptimizerCancelled, applyCandidate, findEfficientStrategies, type OptimizerResult } from "@/lib/optimizer";
import { startOptimizer } from "@/lib/optimizerClient";

const TOTAL = GRID.price.length * GRID.marketing.length * GRID.insurance.length * GRID.outreach.length;
let shared: OptimizerResult;

describe("Find Efficient Strategy (§21)", () => {
  it("evaluates the whole grid and reports monotone progress", async () => {
    const seen: number[] = [];
    shared = await findEfficientStrategies(DEFAULT_CONFIG, (d, t) => {
      expect(t).toBe(TOTAL);
      seen.push(d);
    });
    expect(shared.evaluated).toBe(TOTAL);
    expect(seen.at(-1)).toBe(TOTAL);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThan(seen[i - 1]);
  });

  it("returns the four archetype strategies, each within the searched grid", () => {
    const picks = [shared.highestRevenue, shared.highestAdoption, shared.lowestAcquisitionCost, shared.fastestBreakEven!];
    for (const c of picks) {
      expect(GRID.price).toContain(c.price);
      expect(GRID.marketing).toContain(c.marketing);
      expect(GRID.insurance).toContain(c.insurance);
      expect(GRID.outreach).toContain(c.outreach);
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(1);
    }
  });

  it("archetypes really are extremes of their metric among the candidates", () => {
    const all = [shared.highestRevenue, shared.highestAdoption, shared.lowestAcquisitionCost, shared.fastestBreakEven!, ...shared.tradeoffs];
    expect(shared.highestRevenue.metrics.cumulativeRevenue).toBeGreaterThanOrEqual(Math.max(...all.map((c) => c.metrics.cumulativeRevenue)));
    expect(shared.highestAdoption.metrics.patientAdoptionRate).toBeGreaterThanOrEqual(Math.max(...all.map((c) => c.metrics.patientAdoptionRate)));
    expect(shared.lowestAcquisitionCost.metrics.customerAcquisitionCost).toBeLessThanOrEqual(Math.min(...all.map((c) => c.metrics.customerAcquisitionCost)));
    expect(shared.fastestBreakEven!.metrics.breakEvenMonth!).toBeLessThanOrEqual(Math.min(...all.map((c) => c.metrics.breakEvenMonth ?? 99)));
  });

  it("trade-off candidates are distinct and sorted by score", () => {
    expect(shared.tradeoffs.length).toBeGreaterThanOrEqual(2);
    const keys = shared.tradeoffs.map((c) => `${c.price}|${c.marketing}|${c.insurance}|${c.outreach}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (let i = 1; i < shared.tradeoffs.length; i++) expect(shared.tradeoffs[i].score).toBeLessThanOrEqual(shared.tradeoffs[i - 1].score);
  });

  it("applyCandidate changes only the four searched levers", () => {
    const c = shared.tradeoffs[0];
    const cfg = applyCandidate(DEFAULT_CONFIG, c);
    expect(cfg).toMatchObject({ price: c.price, marketingBudget: c.marketing, insuranceCoverage: c.insurance, outreachIntensity: c.outreach });
    expect({ ...cfg, price: 0, marketingBudget: 0, insuranceCoverage: 0, outreachIntensity: "Low" }).toEqual({ ...DEFAULT_CONFIG, price: 0, marketingBudget: 0, insuranceCoverage: 0, outreachIntensity: "Low" });
  });

  it("can be cancelled part-way", async () => {
    let n = 0;
    await expect(findEfficientStrategies(DEFAULT_CONFIG, undefined, { isCancelled: () => ++n > 5 })).rejects.toBeInstanceOf(OptimizerCancelled);
    expect(n).toBeLessThan(20);
  });
});

describe("optimizer client (worker wrapper)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("falls back to the main thread when Web Workers are unavailable (Node)", async () => {
    const job = startOptimizer(DEFAULT_CONFIG, () => {});
    expect(job.mode).toBe("main");
    job.cancel();
    await expect(job.promise).rejects.toBeInstanceOf(OptimizerCancelled);
  });

  it("uses a Worker when available, forwards progress and resolves with its result", async () => {
    const fakeResult = { evaluated: 1 } as unknown as OptimizerResult;
    let instance: FakeWorker;
    class FakeWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: ((e: ErrorEvent) => void) | null = null;
      terminated = false;
      constructor() {
        instance = this; // eslint-disable-line @typescript-eslint/no-this-alias
      }
      postMessage() {
        queueMicrotask(() => {
          this.onmessage?.({ data: { type: "progress", done: 30, total: 300 } } as MessageEvent);
          this.onmessage?.({ data: { type: "result", result: fakeResult } } as MessageEvent);
        });
      }
      terminate() {
        this.terminated = true;
      }
    }
    vi.stubGlobal("Worker", FakeWorker);
    const progress: number[] = [];
    const job = startOptimizer(DEFAULT_CONFIG, (p) => progress.push(p));
    expect(job.mode).toBe("worker");
    await expect(job.promise).resolves.toBe(fakeResult);
    expect(progress).toEqual([0.1]);
    expect(instance!.terminated).toBe(true);
  });

  it("cancelling terminates the worker and rejects", async () => {
    let instance: { terminated: boolean };
    class HangingWorker {
      onmessage = null;
      onerror = null;
      terminated = false;
      constructor() {
        instance = this; // eslint-disable-line @typescript-eslint/no-this-alias
      }
      postMessage() {}
      terminate() {
        this.terminated = true;
      }
    }
    vi.stubGlobal("Worker", HangingWorker);
    const job = startOptimizer(DEFAULT_CONFIG, () => {});
    job.cancel();
    await expect(job.promise).rejects.toBeInstanceOf(OptimizerCancelled);
    expect(instance!.terminated).toBe(true);
  });

  it("surfaces worker errors", async () => {
    class ErrWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror = null;
      postMessage() {
        queueMicrotask(() => this.onmessage?.({ data: { type: "error", message: "boom" } } as MessageEvent));
      }
      terminate() {}
    }
    vi.stubGlobal("Worker", ErrWorker);
    await expect(startOptimizer(DEFAULT_CONFIG, () => {}).promise).rejects.toThrow("boom");
  });
});

describe("worker entry point protocol", () => {
  it("answers a { config } message with progress events and a final result", async () => {
    const posted: { type: string; done?: number; result?: OptimizerResult }[] = [];
    const scope = { postMessage: (m: never) => posted.push(m), onmessage: null as null | ((e: { data: unknown }) => Promise<void>) };
    vi.stubGlobal("self", scope);
    vi.resetModules();
    await import("@/lib/optimizer.worker");
    expect(typeof scope.onmessage).toBe("function");
    await scope.onmessage!({ data: { config: DEFAULT_CONFIG } });
    vi.unstubAllGlobals();
    expect(posted.filter((m) => m.type === "progress").length).toBeGreaterThan(5);
    const last = posted.at(-1)!;
    expect(last.type).toBe("result");
    expect(last.result!.evaluated).toBe(TOTAL);
  });

  it("reports failures as an error message instead of throwing", async () => {
    const posted: { type: string; message?: string }[] = [];
    const scope = { postMessage: (m: never) => posted.push(m), onmessage: null as null | ((e: { data: unknown }) => Promise<void>) };
    vi.stubGlobal("self", scope);
    vi.resetModules();
    await import("@/lib/optimizer.worker");
    await scope.onmessage!({ data: { config: null } });
    vi.unstubAllGlobals();
    expect(posted.at(-1)?.type).toBe("error");
  });
});
