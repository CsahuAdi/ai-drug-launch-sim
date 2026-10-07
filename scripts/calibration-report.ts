/* Prints calibration tables (presets, default trajectory, price sweep). Assertions live in tests/. Run: npm run calibrate */
import { DEFAULT_CONFIG, PRESETS, presetConfig } from "../lib/defaults";
import { runSimulation } from "../lib/simulation";
import { runSensitivity } from "../lib/sensitivity";
import type { ScenarioResult, SegmentRow } from "../types/simulation";

const cr = (x: number) => (x / 1e7).toFixed(2) + " Cr";
const pct = (x: number) => (x * 100).toFixed(1) + "%";

function line(name: string, r: ScenarioResult) {
  const s = r.summaryMetrics;
  console.log(
    `${name.padEnd(12)} share ${pct(s.finalMarketShare).padStart(6)}  active ${Math.round(s.activePatients).toString().padStart(6)}  physAdopt ${pct(s.physicianAdoptionRate).padStart(6)}  ` +
      `pAware ${pct(s.patientAwareness).padStart(6)}  rev ${cr(s.cumulativeRevenue).padStart(9)}  profit ${cr(s.cumulativeProfit).padStart(9)}  BE ${String(s.breakEvenMonth).padStart(4)}  ROI ${s.marketingROI.toFixed(1).padStart(5)}  CAC ₹${Math.round(s.customerAcquisitionCost)}`,
  );
}

console.log("\n== Presets ==");
for (const p of PRESETS) line(p.key, runSimulation(presetConfig(p)));

const base = runSimulation(DEFAULT_CONFIG);
console.log("\n== Default ==");
line("default", base);
base.monthlyResults
  .filter((r) => r.month === 1 || r.month % 4 === 0)
  .forEach((r) => console.log(`  m${String(r.month).padStart(2)} share ${pct(r.marketShare).padStart(6)} active ${Math.round(r.activePatients).toString().padStart(6)} phys ${pct(r.physicianAdoption).padStart(6)} cumProfit ${cr(r.cumulativeProfit).padStart(8)} ${r.events.join("; ")}`));
console.log("  physician segments:", base.physicianResults.segments.map((s) => `${s.segment} ${pct(s.prescribingRate)}`).join(" | "));
for (const [k, rows] of Object.entries(base.segmentResults) as [string, SegmentRow[]][]) console.log(`  ${k}:`, rows.map((r) => `${r.label} ${pct(r.adoptionRate)}`).join(" | "));

for (const v of ["price", "marketingBudget", "salesReps"] as const) {
  console.log(`\n== ${v} sweep ==`);
  for (const p of runSensitivity(DEFAULT_CONFIG, v)) console.log(`  ${p.label.padEnd(10)} share ${pct(p.share).padStart(6)} rev ${cr(p.revenue).padStart(9)} profit ${cr(p.profit).padStart(9)} ROI ${p.roi.toFixed(1)}`);
}
