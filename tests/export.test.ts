import { describe, expect, it } from "vitest";
import { monthlyResultsCsv, scenarioComparisonCsv, sensitivityCsv, slug, toCsv } from "@/lib/export";
import { runSensitivity } from "@/lib/sensitivity";
import { pdfSafe, buildComparisonReport, buildSimulationReport } from "@/lib/pdfReport";
import { generateInsights } from "@/lib/insights";
import { DEFAULT_CONFIG, PRESETS, presetConfig } from "@/lib/defaults";
import { runSimulation } from "@/lib/simulation";
import { eventsOnly, run } from "./helpers";
import type { SavedScenario } from "@/types/simulation";

/** Minimal RFC-4180 parser so the tests check what a spreadsheet would actually read back. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") (row.push(cell), (cell = ""));
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) (row.push(cell), rows.push(row));
  return rows;
}

describe("toCsv", () => {
  it("quotes commas, quotes and newlines, and round-trips", () => {
    const rows = [["a,b", 'say "hi"', "line1\nline2", 3.5, null, true]];
    expect(parseCsv(toCsv(rows))[0]).toEqual(["a,b", 'say "hi"', "line1\nline2", "3.5", "", "true"]);
  });

  it("neutralises spreadsheet formula injection in text cells but leaves numbers alone", () => {
    const out = toCsv([["=1+1", "+cmd", "@x", "-5", -5, "normal"]]);
    const cells = parseCsv(out)[0];
    expect(cells.slice(0, 3).every((c) => c.startsWith("'"))).toBe(true);
    expect(cells[3]).toBe("-5");
    expect(cells[4]).toBe("-5");
    expect(cells[5]).toBe("normal");
  });

  it("writes non-finite numbers as blanks", () => {
    expect(parseCsv(toCsv([[NaN, Infinity, 1]]))[0]).toEqual(["", "", "1"]);
  });

  it("slug is filename-safe", () => {
    expect(slug("Physician outreach (sales reps)")).toBe("physician-outreach-sales-reps");
    expect(slug("///")).toBe("export");
  });
});

describe("monthly results CSV", () => {
  const result = run({ competitorEvents: eventsOnly("generic_entry") });
  const rows = parseCsv(monthlyResultsCsv(result));

  it("has a header plus one row per month with a consistent column count", () => {
    expect(rows).toHaveLength(1 + result.monthlyResults.length);
    for (const r of rows) expect(r).toHaveLength(rows[0].length);
  });

  it("includes competitor and generic share columns", () => {
    for (const name of ["share_DiaCare", "share_GlucoEase", "share_MetraPlus", "share_generic"]) expect(rows[0]).toContain(name);
  });

  it("values match the result", () => {
    const col = (name: string) => rows[0].indexOf(name);
    const last = result.monthlyResults[result.monthlyResults.length - 1];
    const lastRow = rows[rows.length - 1];
    expect(Number(lastRow[col("month")])).toBe(last.month);
    expect(Number(lastRow[col("active_patients")])).toBe(Math.round(last.activePatients));
    expect(Number(lastRow[col("cumulative_profit_inr")])).toBe(Math.round(last.cumulativeProfit));
    expect(Number(lastRow[col("gluconova_market_share")])).toBeCloseTo(last.marketShare, 3);
  });

  it("has no NaN/undefined text and records event labels", () => {
    const text = monthlyResultsCsv(runSimulation({ ...DEFAULT_CONFIG }));
    expect(text).not.toMatch(/NaN|undefined|Infinity/);
    expect(monthlyResultsCsv(run())).toContain("DiaCare cut price 20%");
  });
});

const scenarios = (): SavedScenario[] =>
  PRESETS.map((p, i) => {
    const cfg = presetConfig(p);
    return { id: String(i), name: p.name, config: cfg, result: runSimulation(cfg), savedAt: 0 };
  });

describe("comparison + sensitivity CSV", () => {
  it("comparison has one column per scenario, named in the header", () => {
    const rows = parseCsv(scenarioComparisonCsv(scenarios()));
    expect(rows[0]).toEqual(["metric", "Premium Launch", "Balanced Launch", "Market Penetration"]);
    for (const r of rows) expect(r).toHaveLength(4);
    const price = rows.find((r) => r[0] === "price_inr")!;
    expect(price.slice(1).map(Number)).toEqual([2100, 1600, 1150]);
  });

  it("sensitivity CSV has one row per tested value", () => {
    const pts = runSensitivity(DEFAULT_CONFIG, "discountRate");
    const rows = parseCsv(sensitivityCsv("Discount rate", pts));
    expect(rows).toHaveLength(1 + pts.length);
    expect(rows[1][0]).toBe("0%");
  });
});

describe("PDF export", () => {
  it("pdfSafe swaps glyphs the built-in font cannot render", () => {
    expect(pdfSafe("₹1,600 and ₹ 85 L")).toBe("Rs 1,600 and Rs 85 L");
    expect(pdfSafe("a − b ≈ c ≥ d → e")).toBe("a - b ~ c >= d -> e");
    expect(pdfSafe("Rs 1 – 2 — ok ‘x’")).toContain("–");
    expect(pdfSafe("😀 emoji")).toBe(" emoji");
  });

  it("builds a multi-page simulation report that is a valid PDF", async () => {
    const result = run();
    const doc = await buildSimulationReport(result, generateInsights(result), "Test scenario");
    const bytes = new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(10_000);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
    expect(String.fromCharCode(...bytes.slice(-6))).toContain("%%EOF");
  });

  it("builds a comparison report", async () => {
    const doc = await buildComparisonReport(scenarios());
    const bytes = new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});
