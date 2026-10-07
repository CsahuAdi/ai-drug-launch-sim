import type { MonthlyResult, ScenarioResult } from "@/types/simulation";

/** KPI values as of a given month (1-based), so dashboards can play the launch forward in time. */
export interface KpiSnapshot {
  month: number;
  marketShare: number;
  activePatients: number;
  newPatients: number;
  physicianAdoption: number;
  patientAwareness: number;
  physicianAwareness: number;
  cumulativeRevenue: number;
  marketingROI: number;
  breakEvenMonth: number | null;
  customerAcquisitionCost: number;
  marketingCostPerPatient: number;
  avgMonthlyGrowthRate: number;
  cumulativeProfit: number;
}

export function kpisAt(result: ScenarioResult, month: number): KpiSnapshot {
  const rows = result.monthlyResults;
  const m = Math.min(Math.max(month, 1), rows.length);
  const r = rows[m - 1];
  const upTo = rows.slice(0, m);
  const salesforce = upTo.reduce((s, x) => s + x.salesforceSpend, 0);
  const acquired = r.cumulativeAcquired;
  const first = upTo.find((x) => x.activePatients > 0);
  const span = first ? r.month - first.month : 0;
  const growth =
    first && span > 0 ? Math.pow(r.activePatients / first.activePatients, 1 / span) - 1 : 0;
  const be = upTo.find((x) => x.cumulativeProfit >= 0);
  return {
    month: r.month,
    marketShare: r.marketShare,
    activePatients: r.activePatients,
    newPatients: r.newPatients,
    physicianAdoption: r.physicianAdoption,
    patientAwareness: r.patientAwareness,
    physicianAwareness: r.physicianAwareness,
    cumulativeRevenue: r.cumulativeRevenue,
    marketingROI: r.marketingROI,
    breakEvenMonth: be ? be.month : null,
    customerAcquisitionCost: acquired > 0 ? (r.cumulativeMarketingSpend + salesforce) / acquired : 0,
    marketingCostPerPatient: acquired > 0 ? r.cumulativeMarketingSpend / acquired : 0,
    avgMonthlyGrowthRate: growth,
    cumulativeProfit: r.cumulativeProfit,
  };
}

export const eventMonths = (rows: MonthlyResult[]) =>
  rows.filter((r) => r.events.length > 0).map((r) => ({ month: r.month, label: r.events.join("; ") }));
