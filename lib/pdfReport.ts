import type { jsPDF as JsPDF } from "jspdf";
import type { SavedScenario, ScenarioResult } from "@/types/simulation";
import { DISCLAIMER } from "./defaults";
import { formatINR, formatNumber, formatPct } from "./format";
import type { Insight } from "./insights";
import { tradeoffStatements } from "./tradeoffs";

/**
 * jsPDF's built-in fonts are WinAnsi only: no ₹, no U+2212 minus, no ≈/≥. Map them to safe
 * equivalents rather than silently dropping glyphs.
 */
export function pdfSafe(s: string): string {
  return s
    .replace(/₹\s?/g, "Rs ")
    .replace(/−/g, "-")
    .replace(/≈/g, "~")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/→/g, "->")
    .replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff–—‘’“”•…]/g, "");
}

const BRAND: [number, number, number] = [15, 118, 110];
const INK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const M = 14; // page margin, mm

const money = (n: number, compact = true) => pdfSafe(formatINR(n, { compact }));

type Doc = JsPDF & { lastAutoTable?: { finalY: number } };

async function newDoc(): Promise<{ doc: Doc; autoTable: typeof import("jspdf-autotable").autoTable }> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  return { doc: new jsPDF({ unit: "mm", format: "a4" }) as Doc, autoTable };
}

function title(doc: Doc, text: string, sub: string): number {
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(...INK);
  doc.text(pdfSafe(text), M, 20);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
  doc.text(pdfSafe(sub), M, 26);
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(M, 30, 210 - 2 * M, 10, 1.5, 1.5, "F");
  doc.setFontSize(8).setTextColor(120, 53, 15);
  doc.text(doc.splitTextToSize(pdfSafe(DISCLAIMER), 210 - 2 * M - 6), M + 3, 35);
  return 46;
}

function heading(doc: Doc, text: string, y: number): number {
  if (y > 262) {
    doc.addPage();
    y = 20;
  }
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...BRAND);
  doc.text(pdfSafe(text), M, y);
  return y + 3;
}

function paragraph(doc: Doc, text: string, y: number, opts: { bullet?: boolean } = {}): number {
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...INK);
  const lines = doc.splitTextToSize(pdfSafe(text), 210 - 2 * M - (opts.bullet ? 5 : 0));
  if (y + lines.length * 4.2 > 280) {
    doc.addPage();
    y = 20;
  }
  if (opts.bullet) doc.text("•", M, y + 3);
  doc.text(lines, M + (opts.bullet ? 5 : 0), y + 3);
  return y + lines.length * 4.2 + 1.5;
}

function footers(doc: Doc): void {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...MUTED);
    doc.text(pdfSafe("PharmaLaunch AI - fictional drug, simulated data. Educational proof of concept; not validated for forecasting, investment, clinical or medical use."), M, 289);
    doc.text(`Page ${i} of ${n}`, 210 - M, 289, { align: "right" });
  }
}

interface Series {
  name: string;
  color: [number, number, number];
  values: number[];
}

/** Minimal line chart drawn with PDF primitives (no canvas needed). */
function lineChart(doc: Doc, x: number, y: number, w: number, h: number, heading: string, series: Series[], fmt: (v: number) => string): void {
  const all = series.flatMap((s) => s.values);
  const lo = Math.min(0, ...all);
  let hi = Math.max(...all);
  if (hi <= lo) hi = lo + 1;
  const px = x + 16;
  const pw = w - 18;
  const py = y + 7;
  const ph = h - 16;
  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...INK);
  doc.text(pdfSafe(heading), x, y + 3);
  doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...MUTED);
  doc.setDrawColor(226, 232, 240).setLineWidth(0.15);
  for (let i = 0; i <= 4; i++) {
    const v = lo + ((hi - lo) * i) / 4;
    const gy = py + ph - (ph * i) / 4;
    doc.line(px, gy, px + pw, gy);
    doc.text(pdfSafe(fmt(v)), px - 1.5, gy + 0.8, { align: "right" });
  }
  const n = Math.max(...series.map((s) => s.values.length));
  doc.text("1", px, py + ph + 4);
  doc.text(String(n), px + pw, py + ph + 4, { align: "right" });
  doc.text("month", px + pw / 2, py + ph + 4, { align: "center" });
  series.forEach((s, k) => {
    doc.setDrawColor(...s.color).setLineWidth(0.6);
    s.values.forEach((v, i) => {
      if (i === 0) return;
      const x1 = px + (pw * (i - 1)) / Math.max(1, n - 1);
      const x2 = px + (pw * i) / Math.max(1, n - 1);
      const y1 = py + ph - (ph * (s.values[i - 1] - lo)) / (hi - lo);
      const y2 = py + ph - (ph * (v - lo)) / (hi - lo);
      doc.line(x1, y1, x2, y2);
    });
    doc.setTextColor(...s.color);
    // Split the plot width evenly between legend entries and truncate names to fit.
    const slot = pw / series.length;
    const maxChars = Math.max(4, Math.floor(slot / 1.55));
    const label = s.name.length > maxChars ? `${s.name.slice(0, maxChars - 1)}...` : s.name;
    doc.text(pdfSafe(label), px + k * slot, py + ph + 8);
  });
}

/** Full single-scenario report. `insights` are the AI Strategy Analyst lines for this run. */
export async function buildSimulationReport(result: ScenarioResult, insights: Insight[], name = "Current configuration"): Promise<Doc> {
  const { doc, autoTable } = await newDoc();
  const c = result.config;
  const s = result.summaryMetrics;
  const rows = result.monthlyResults;
  let y = title(doc, "GlucoNova Launch Simulation Report", `${name} | ${c.simulationMonths}-month horizon | seed ${c.seed} | generated ${new Date().toISOString().slice(0, 10)}`);

  const tbl = (head: string[], body: string[][], startY: number, extra: object = {}) => {
    autoTable(doc, {
      startY,
      head: [head],
      body: body.map((r) => r.map(pdfSafe)),
      theme: "striped",
      headStyles: { fillColor: BRAND, fontSize: 8.5 },
      styles: { fontSize: 8.5, cellPadding: 1.6 },
      margin: { left: M, right: M },
      ...extra,
    });
    return (doc.lastAutoTable?.finalY ?? startY) + 6;
  };

  y = heading(doc, "Launch assumptions (simulated)", y);
  y = tbl(
    ["Assumption", "Value", "Assumption", "Value"],
    [
      ["Eligible patients", formatNumber(c.marketSize), "Marketing budget", money(c.marketingBudget)],
      ["Physicians", formatNumber(c.physicianCount), "Consumer / physician / digital", `${Math.round(c.consumerMarketingShare * 100)}% / ${Math.round(c.physicianMarketingShare * 100)}% / ${Math.round(c.digitalMarketingShare * 100)}%`],
      ["Monthly price", money(c.price, false), "Sales reps / intensity", `${c.salesReps} / ${c.outreachIntensity}`],
      ["Differentiation", c.differentiation, "Events per quarter", String(c.eventsPerQuarter)],
      ["Convenience advantage", c.convenienceAdvantage, "Insurance coverage", formatPct(c.insuranceCoverage, 0)],
      ["Adherence attractiveness", c.adherenceAttractiveness, "Discount / affordability support", `${formatPct(c.discountRate, 0)} / ${c.affordabilitySupport}`],
      ["Competitor strength", c.competitorStrength, "Fixed launch cost", money(c.fixedLaunchCost)],
    ],
    y,
  );

  const events = c.competitorEvents.filter((e) => e.enabled);
  if (events.length) {
    y = paragraph(
      doc,
      "Competitor events: " +
        events
          .map((e) => (e.type === "price_cut" ? `price cut ${Math.round(e.magnitude * 100)}%` : e.type === "marketing_increase" ? `marketing +${Math.round(e.magnitude * 100)}%` : "generic entry") + ` in month ${e.month}`)
          .join("; ") +
        ".",
      y - 3,
    );
    y += 5;
  }

  y = heading(doc, "Headline results (simulated commercial projections)", y);
  y = tbl(
    ["Metric", "Value", "Metric", "Value"],
    [
      ["Final market share", formatPct(s.finalMarketShare), "Cumulative revenue", money(s.cumulativeRevenue)],
      ["Active patients", formatNumber(s.activePatients), "Cumulative profit", money(s.cumulativeProfit)],
      ["Patients acquired", formatNumber(s.patientsAcquired), "Break-even", s.breakEvenMonth ? `Month ${s.breakEvenMonth}` : "Not reached"],
      ["Physician adoption", formatPct(s.physicianAdoptionRate), "Marketing ROI (incremental)", `${s.marketingROI.toFixed(1)}x`],
      ["Physician awareness", formatPct(s.physicianAwareness), "Customer acquisition cost", money(s.customerAcquisitionCost, false)],
      ["Patient awareness", formatPct(s.patientAwareness), "Marketing cost / patient", money(s.marketingCostPerPatient, false)],
      ["Avg monthly growth", formatPct(s.avgMonthlyGrowthRate), "Net revenue / patient-month", money(s.netRevenuePerPatientMonth, false)],
    ],
    y,
  );

  if (y > 200) {
    doc.addPage();
    y = 20;
  }
  const cw = (210 - 2 * M - 6) / 2;
  lineChart(doc, M, y, cw, 52, "Active patients", [{ name: "GlucoNova", color: BRAND, values: rows.map((r) => r.activePatients) }], (v) => formatNumber(v));
  lineChart(
    doc,
    M + cw + 6,
    y,
    cw,
    52,
    "Cumulative profit",
    [{ name: "Cumulative profit", color: [79, 70, 229], values: rows.map((r) => r.cumulativeProfit) }],
    (v) => formatINR(v),
  );
  y += 58;

  y = heading(doc, "AI Strategy Analyst observations", y);
  y += 1;
  for (const i of insights) y = paragraph(doc, i.text, y, { bullet: true });
  y += 2;

  y = heading(doc, "Adoption by segment (simulated)", y);
  const seg = result.segmentResults;
  const segRows: string[][] = [
    ...seg.income.map((r) => ["Income", r.label, formatPct(r.adoptionRate), formatPct(r.activeRate)]),
    ...seg.insurance.map((r) => ["Insurance", r.label, formatPct(r.adoptionRate), formatPct(r.activeRate)]),
    ...seg.age.map((r) => ["Age", r.label, formatPct(r.adoptionRate), formatPct(r.activeRate)]),
    ...result.physicianResults.segments.map((r) => ["Physician", r.segment, formatPct(r.prescribingRate), "-"]),
  ];
  y = tbl(["Dimension", "Segment", "Adopted / prescribing", "Active"], segRows, y);

  y = heading(doc, "Month-by-month results", y);
  tbl(
    ["Month", "Active pts", "Share", "New pts", "Revenue", "Cost", "Profit", "Cum. profit"],
    rows.map((r) => [String(r.month), formatNumber(r.activePatients), formatPct(r.marketShare), formatNumber(r.newPatients), money(r.grossRevenue), money(r.monthlyCost), money(r.monthlyProfit), money(r.cumulativeProfit)]),
    y,
    { styles: { fontSize: 8, cellPadding: 1.2 }, columnStyles: { 0: { halign: "left" } } },
  );

  footers(doc);
  return doc;
}

/** Side-by-side scenario comparison report. */
export async function buildComparisonReport(scenarios: SavedScenario[]): Promise<Doc> {
  const { doc, autoTable } = await newDoc();
  let y = title(doc, "GlucoNova Scenario Comparison", `${scenarios.length} saved scenarios | generated ${new Date().toISOString().slice(0, 10)}`);
  const m = (sc: SavedScenario) => sc.result.summaryMetrics;
  const line = (label: string, f: (sc: SavedScenario) => string) => [label, ...scenarios.map(f)];

  y = heading(doc, "Decisions and simulated outcomes", y);
  autoTable(doc, {
    startY: y,
    head: [["Metric", ...scenarios.map((sc) => pdfSafe(sc.name))]],
    body: [
      line("Price (monthly)", (sc) => money(sc.config.price, false)),
      line("Marketing spend", (sc) => money(sc.config.marketingBudget)),
      line("Insurance coverage", (sc) => formatPct(sc.config.insuranceCoverage, 0)),
      line("Physician outreach", (sc) => `${sc.config.outreachIntensity}, ${sc.config.salesReps} reps`),
      line("Consumer marketing share", (sc) => formatPct(sc.config.consumerMarketingShare, 0)),
      line("Patient adoption (ever adopted)", (sc) => formatPct(m(sc).patientAdoptionRate)),
      line("Market share (final)", (sc) => formatPct(m(sc).finalMarketShare)),
      line("Active patients", (sc) => formatNumber(m(sc).activePatients)),
      line("Months to half of final base", (sc) => `Month ${m(sc).monthsToHalfFinal}`),
      line("Net revenue / patient-month", (sc) => money(m(sc).netRevenuePerPatientMonth, false)),
      line("Revenue (cumulative)", (sc) => money(m(sc).cumulativeRevenue)),
      line("Profit (cumulative)", (sc) => money(m(sc).cumulativeProfit)),
      line("Break-even month", (sc) => (m(sc).breakEvenMonth ? `Month ${m(sc).breakEvenMonth}` : "Not reached")),
      line("Marketing ROI (incremental)", (sc) => `${m(sc).marketingROI.toFixed(1)}x`),
      line("Cost per acquisition", (sc) => money(m(sc).customerAcquisitionCost, false)),
    ].map((r) => r.map(pdfSafe)),
    theme: "striped",
    headStyles: { fillColor: BRAND, fontSize: 8.5 },
    styles: { fontSize: 8.5, cellPadding: 1.6 },
    margin: { left: M, right: M },
  });
  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  const palette: [number, number, number][] = [[15, 118, 110], [79, 70, 229], [219, 39, 119], [2, 132, 199], [101, 163, 13]];
  const months = Math.max(...scenarios.map((sc) => sc.result.monthlyResults.length));
  const pad = (sc: SavedScenario, pick: (r: ScenarioResult["monthlyResults"][number]) => number) =>
    sc.result.monthlyResults.map(pick).concat(Array(months - sc.result.monthlyResults.length).fill(NaN)).filter((v) => !Number.isNaN(v));
  if (y > 200) {
    doc.addPage();
    y = 20;
  }
  const cw = (210 - 2 * M - 6) / 2;
  lineChart(doc, M, y, cw, 56, "Market share over time", scenarios.map((sc, i) => ({ name: sc.name, color: palette[i % 5], values: pad(sc, (r) => r.marketShare * 100) })), (v) => `${v.toFixed(0)}%`);
  lineChart(doc, M + cw + 6, y, cw, 56, "Active patients over time", scenarios.map((sc, i) => ({ name: sc.name, color: palette[i % 5], values: pad(sc, (r) => r.activePatients) })), (v) => formatNumber(v));
  y += 64;

  y = heading(doc, "Trade-offs", y);
  y += 1;
  for (const t of tradeoffStatements(scenarios)) y = paragraph(doc, t, y, { bullet: true });

  footers(doc);
  return doc;
}
