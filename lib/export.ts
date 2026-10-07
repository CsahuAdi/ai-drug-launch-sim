import type { SavedScenario, ScenarioResult } from "@/types/simulation";
import type { SensitivityPoint } from "./sensitivity";

type Cell = string | number | boolean | null | undefined;

/** RFC-4180 style CSV. Numbers are written raw (no currency symbols or separators) so they open cleanly in Excel/Sheets/pandas. */
export function toCsv(rows: Cell[][]): string {
  const esc = (c: Cell): string => {
    if (c === null || c === undefined) return "";
    const s = typeof c === "number" ? (Number.isFinite(c) ? String(c) : "") : String(c);
    // Neutralise spreadsheet formula injection for text cells that start with a formula character.
    const safe = typeof c === "string" && /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return rows.map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}

const r0 = (x: number) => Math.round(x);
const r4 = (x: number) => Math.round(x * 10_000) / 10_000;

export function monthlyResultsCsv(result: ScenarioResult): string {
  const comps = result.config.competitors;
  const hasGeneric = result.monthlyResults.some((m) => "generic" in m.competitorShares);
  const header: Cell[] = [
    "month",
    "physician_awareness",
    "physician_adoption",
    "patient_awareness",
    "new_patients",
    "churned_patients",
    "active_patients",
    "cumulative_acquired",
    "gluconova_market_share",
    ...comps.map((c) => `share_${c.name}`),
    ...(hasGeneric ? ["share_generic"] : []),
    "gross_revenue_inr",
    "net_revenue_inr",
    "marketing_spend_inr",
    "salesforce_spend_inr",
    "fixed_cost_inr",
    "total_cost_inr",
    "monthly_profit_inr",
    "cumulative_revenue_inr",
    "cumulative_cost_inr",
    "cumulative_profit_inr",
    "marketing_roi_x",
    "events",
  ];
  const rows = result.monthlyResults.map((m): Cell[] => [
    m.month,
    r4(m.physicianAwareness),
    r4(m.physicianAdoption),
    r4(m.patientAwareness),
    r0(m.newPatients),
    r0(m.churnedPatients),
    r0(m.activePatients),
    r0(m.cumulativeAcquired),
    r4(m.marketShare),
    ...comps.map((c) => r4(m.competitorShares[c.id] ?? 0)),
    ...(hasGeneric ? [r4(m.competitorShares.generic ?? 0)] : []),
    r0(m.grossRevenue),
    r0(m.netRevenue),
    r0(m.marketingSpend),
    r0(m.salesforceSpend),
    r0(m.fixedCost),
    r0(m.monthlyCost),
    r0(m.monthlyProfit),
    r0(m.cumulativeRevenue),
    r0(m.cumulativeCost),
    r0(m.cumulativeProfit),
    r4(m.marketingROI),
    m.events.join("; "),
  ]);
  return toCsv([header, ...rows]);
}

/** Metrics down the side, one column per scenario — mirrors the on-screen comparison table. */
export function scenarioComparisonCsv(scenarios: SavedScenario[]): string {
  const cfg: [string, (s: SavedScenario) => Cell][] = [
    ["price_inr", (s) => s.config.price],
    ["marketing_budget_inr", (s) => s.config.marketingBudget],
    ["consumer_marketing_share", (s) => r4(s.config.consumerMarketingShare)],
    ["physician_marketing_share", (s) => r4(s.config.physicianMarketingShare)],
    ["digital_marketing_share", (s) => r4(s.config.digitalMarketingShare)],
    ["insurance_coverage", (s) => r4(s.config.insuranceCoverage)],
    ["discount_rate", (s) => r4(s.config.discountRate)],
    ["sales_reps", (s) => s.config.salesReps],
    ["outreach_intensity", (s) => s.config.outreachIntensity],
    ["competitor_strength", (s) => s.config.competitorStrength],
    ["seed", (s) => s.config.seed],
  ];
  const m = (s: SavedScenario) => s.result.summaryMetrics;
  const out: [string, (s: SavedScenario) => Cell][] = [
    ["patient_adoption_rate", (s) => r4(m(s).patientAdoptionRate)],
    ["final_market_share", (s) => r4(m(s).finalMarketShare)],
    ["active_patients", (s) => r0(m(s).activePatients)],
    ["patients_acquired", (s) => r0(m(s).patientsAcquired)],
    ["months_to_half_of_final_base", (s) => m(s).monthsToHalfFinal],
    ["net_revenue_per_patient_month_inr", (s) => r0(m(s).netRevenuePerPatientMonth)],
    ["cumulative_revenue_inr", (s) => r0(m(s).cumulativeRevenue)],
    ["cumulative_profit_inr", (s) => r0(m(s).cumulativeProfit)],
    ["break_even_month", (s) => m(s).breakEvenMonth],
    ["marketing_roi_x", (s) => r4(m(s).marketingROI)],
    ["customer_acquisition_cost_inr", (s) => r0(m(s).customerAcquisitionCost)],
    ["marketing_cost_per_patient_inr", (s) => r0(m(s).marketingCostPerPatient)],
  ];
  return toCsv([["metric", ...scenarios.map((s) => s.name)], ...[...cfg, ...out].map(([k, f]) => [k, ...scenarios.map(f)])]);
}

export function sensitivityCsv(variableLabel: string, points: SensitivityPoint[]): string {
  return toCsv([
    [variableLabel, "x_value", "market_share", "patient_adoption", "active_patients", "cumulative_revenue_inr", "cumulative_profit_inr", "marketing_roi_x", "break_even_month"],
    ...points.map((p): Cell[] => [p.label, p.x, r4(p.share), r4(p.adoption), r0(p.activePatients), r0(p.revenue), r0(p.profit), r4(p.roi), p.breakEven]),
  ]);
}

export const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "export";
