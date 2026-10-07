import type { LaunchConfig, ScenarioResult } from "@/types/simulation";
import { formatINR, formatNumber, formatPct } from "./format";
import { runSimulation } from "./simulation";

export interface Insight {
  id: string;
  text: string;
  /** "run" = read directly off this run; "probe" = from a what-if re-simulation of this configuration */
  basis: "run" | "probe";
}

const quick = (c: LaunchConfig) => runSimulation(c, { skipCounterfactual: true }).summaryMetrics;
const pctChange = (a: number, b: number) => (a > 0 ? (b - a) / a : 0);
const signed = (x: number) => (Math.abs(x) < 0.005 ? "≈0%" : `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(0)}%`);

/**
 * Rule-based analyst. Every statement is computed from the supplied run (or a what-if re-run of the
 * same configuration and seed); nothing is templated without a data check. Returns 3-5 insights.
 */
export function generateInsights(result: ScenarioResult): Insight[] {
  const cfg = result.config;
  const rows = result.monthlyResults;
  const s = result.summaryMetrics;
  const seg = result.segmentResults;
  const cands: (Insight & { priority: number })[] = [];
  const add = (id: string, priority: number, basis: Insight["basis"], text: string) => cands.push({ id, priority, basis, text });

  /* 1. Physician awareness vs patient affordability / access */
  {
    const early = rows[Math.min(5, rows.length - 1)];
    const notCovered = seg.insurance.find((r) => r.label === "Not covered");
    const covered = seg.insurance.find((r) => r.label === "Covered");
    const low = seg.income.find((r) => r.label === "Low");
    const high = seg.income.find((r) => r.label === "High");
    if (notCovered && covered && covered.adoptionRate > 0 && notCovered.patients > 0 && covered.patients > 0) {
      const ratio = covered.adoptionRate / Math.max(notCovered.adoptionRate, 1e-6);
      if (ratio >= 1.4) {
        add(
          "access",
          5,
          "run",
          `Physician awareness reached ${formatPct(early.physicianAwareness, 0)} by month ${early.month}, yet simulated adoption among covered patients (${formatPct(covered.adoptionRate)}) is ${ratio.toFixed(1)}× that of uncovered patients (${formatPct(notCovered.adoptionRate)}) — market access looks like a major driver of launch performance in this scenario.`,
        );
      }
    }
    if (low && high && high.adoptionRate > 0 && high.adoptionRate / Math.max(low.adoptionRate, 1e-6) >= 1.8) {
      add("afford", 3, "run", `Affordability is a constraint: high-income patients adopt at ${formatPct(high.adoptionRate)} versus ${formatPct(low.adoptionRate)} for low-income patients, at a ${formatINR(cfg.price, { compact: false })} monthly price.`);
    }
  }

  /* 2. Price vs marketing what-if */
  {
    const priceDown = quick({ ...cfg, price: Math.round((cfg.price * 0.9) / 10) * 10 });
    const mktUp = quick({ ...cfg, marketingBudget: cfg.marketingBudget * 1.2 });
    const dPrice = pctChange(s.activePatients, priceDown.activePatients);
    const dMkt = pctChange(s.activePatients, mktUp.activePatients);
    const revPrice = pctChange(s.cumulativeRevenue, priceDown.cumulativeRevenue);
    const winner = dPrice > dMkt ? "Reducing price by 10%" : "Increasing marketing spend by 20%";
    const loser = dPrice > dMkt ? "increasing marketing spend by 20%" : "reducing price by 10%";
    const gain = Math.max(dPrice, dMkt);
    const revNote =
      dPrice > dMkt && revPrice < dPrice - 0.02
        ? ` A 10% price cut moves cumulative revenue ${signed(revPrice)} — less than the adoption gain, because every patient pays less — so higher adoption does not automatically mean higher revenue.`
        : ` The 10% price cut moves cumulative revenue ${signed(revPrice)}.`;
    add(
      "price-vs-mkt",
      6,
      "probe",
      `${winner} produced a larger simulated increase in active patients (${signed(gain)}) than ${loser} (${signed(Math.min(dPrice, dMkt))}).${revNote}`,
    );
  }

  /* 3. Marketing diminishing returns */
  if (cfg.marketingBudget > 0) {
    const half = quick({ ...cfg, marketingBudget: cfg.marketingBudget * 0.5 });
    const dbl = quick({ ...cfg, marketingBudget: cfg.marketingBudget * 2 });
    const gain1 = s.patientsAcquired - half.patientsAcquired;
    const gain2 = dbl.patientsAcquired - s.patientsAcquired;
    if (gain1 > 0 && gain2 >= 0) {
      const cost1 = (cfg.marketingBudget * 0.5) / gain1;
      const cost2 = cfg.marketingBudget / Math.max(gain2, 1);
      if (cost2 > cost1 * 1.15) {
        add(
          "diminishing",
          4,
          "probe",
          `Marketing shows diminishing returns: raising the budget from ${formatINR(cfg.marketingBudget * 0.5)} to ${formatINR(cfg.marketingBudget)} adds ~${formatNumber(gain1)} patients (${formatINR(cost1, { compact: false })} each), but doubling again to ${formatINR(cfg.marketingBudget * 2)} adds ~${formatNumber(gain2)} (${formatINR(cost2, { compact: false })} each).`,
        );
      }
    }
  }

  /* 4. Competitor events, compared with the same launch without events */
  {
    const active = cfg.competitorEvents.filter((e) => e.enabled && e.month <= rows.length);
    if (active.length) {
      const noEvents = runSimulation({ ...cfg, competitorEvents: cfg.competitorEvents.map((e) => ({ ...e, enabled: false })) }, { skipCounterfactual: true });
      const ev = [...active].sort((a, b) => a.month - b.month)[0];
      const from = ev.month - 1;
      const to = Math.min(rows.length, ev.month + 3);
      const avg = (rs: typeof rows) => rs.slice(from, to).reduce((t, r) => t + r.newPatients, 0) / Math.max(1, to - from);
      const withEv = avg(rows);
      const without = avg(noEvents.monthlyResults);
      const d = pctChange(without, withEv);
      const label = ev.type === "price_cut" ? "price reduction" : ev.type === "marketing_increase" ? "marketing increase" : "generic entry";
      if (Math.abs(d) >= 0.02) {
        add(
          "events",
          6,
          "probe",
          `The Month ${ev.month} competitor ${label} ${d < 0 ? "slows" : "barely dents"} new-patient acquisition: monthly new patients over months ${ev.month}–${to} average ${formatNumber(withEv)} versus ${formatNumber(without)} without the event (${signed(d)}); active patients at month ${rows.length} are ${signed(pctChange(noEvents.summaryMetrics.activePatients, s.activePatients))} versus a no-event launch.`,
        );
      }
    }
  }

  /* 5. Physician segments */
  {
    const segs = [...result.physicianResults.segments].sort((a, b) => b.prescribingRate - a.prescribingRate);
    const hi = segs[0];
    const lo = segs[segs.length - 1];
    if (hi.prescribingRate - lo.prescribingRate >= 0.1) {
      add("phys", 2, "run", `Physician uptake is uneven: ${hi.segment.toLowerCase()} prescribe at ${formatPct(hi.prescribingRate, 0)} versus ${formatPct(lo.prescribingRate, 0)} for ${lo.segment.toLowerCase()}, so physician outreach effort is best judged by segment, not the overall ${formatPct(s.physicianAdoptionRate, 0)} average.`);
    }
  }

  /* 6. Financial trajectory (always available) */
  {
    const margin = s.netRevenuePerPatientMonth;
    add(
      "finance",
      s.breakEvenMonth ? 3 : 7,
      "run",
      s.breakEvenMonth
        ? `Simulated cumulative profit turns positive in month ${s.breakEvenMonth} and reaches ${formatINR(s.cumulativeProfit)} by month ${rows.length}, with ${formatINR(margin, { compact: false })} net revenue per active patient-month after discounts and rebates.`
        : `The launch does not reach break-even within ${rows.length} months (cumulative profit ${formatINR(s.cumulativeProfit)}); fixed launch cost and field-force spend outrun simulated revenue at ${formatPct(s.finalMarketShare)} market share.`,
    );
  }

  /* 7. Adoption speed (always available) */
  add("speed", 1, "run", `Adoption reaches half of its final base by month ${s.monthsToHalfFinal}; monthly new patients peak at ${formatNumber(Math.max(...rows.map((r) => r.newPatients)))} and end at ${formatNumber(s.newPatientsLastMonth)}, with patient awareness at ${formatPct(s.patientAwareness, 0)}.`);

  return cands
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5)
    .map(({ id, text, basis }) => ({ id, text, basis }));
}
