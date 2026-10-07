"use client";

import { COEFFICIENT_NOTE, DISCLAIMER } from "@/lib/defaults";
import { COGS_RATE, EVENT_COST, INSURANCE_SUPPORT, PAYER_REBATE } from "@/lib/financialModel";
import { PATIENT_COEF, PHYSICIAN_COEF } from "@/lib/simulation";
import { Callout, PageHeader, Panel } from "../ui";

const REQUIRED =
  "This simulator is an educational proof of concept. The model coefficients and generated outcomes are illustrative and are not validated for real pharmaceutical forecasting, investment decisions, clinical decisions, or medical use.";

function Formula({ children }: { children: React.ReactNode }) {
  return <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 px-4 py-3 text-xs leading-relaxed text-slate-100">{children}</pre>;
}

function CoefTable({ rows }: { rows: [string, number][] }) {
  return (
    <div className="mt-3 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between border-b border-slate-100 py-1">
          <span className="text-slate-600">{k}</span>
          <span className="font-mono tabular-nums text-slate-900">{v > 0 ? `+${v}` : v}</span>
        </div>
      ))}
    </div>
  );
}

const sign = (n: number) => n;

export function MethodologyView() {
  const P = PHYSICIAN_COEF;
  const C = PATIENT_COEF;
  return (
    <div className="max-w-4xl">
      <PageHeader title="Methodology" subtitle="How the simulator works, what it assumes, and where it should not be trusted." />

      <div className="space-y-6">
        <Callout tone="amber" title="Limitations — please read">
          {REQUIRED}
        </Callout>

        <Panel title="What the simulator does">
          <p className="text-sm leading-relaxed text-slate-700">
            PharmaLaunch AI is a decision-support sandbox for a <strong>fictional</strong> drug, GlucoNova, entering a fictional Indian urban Type-2 diabetes market. It generates a synthetic population of physicians and patients, applies your launch decisions (price, marketing, field force, coverage, discounts), and steps the market forward month by month. Each month it updates awareness, physician prescribing, patient adoption, market share and finances, and stores the results. All of it runs in your browser; nothing is sent anywhere.
          </p>
          <p className="mt-3 text-sm text-slate-600">{DISCLAIMER}</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            <strong>Reproducibility.</strong> Every random quantity is derived from a fixed seed. The same seed and configuration always give identical output; <em>Reseed</em> creates a different synthetic market. Within one seed, each patient and physician keeps its own stable random draw, so comparing two strategies isolates the effect of your levers rather than noise.
          </p>
        </Panel>

        <Panel title="Synthetic physician generation">
          <p className="text-sm leading-relaxed text-slate-700">
            500 physicians by default (100–5,000). Each is first assigned to a segment — Innovators 8%, Early adopters 17%, Mainstream 40%, Price-sensitive 20%, Traditionalists 15% — and attributes (innovation tendency, price sensitivity, evidence sensitivity, peer influence, marketing responsiveness, brand familiarity) are drawn around segment profiles with noise. Patient volume (50–500 per month, right-skewed), specialty, preferred incumbent and initial launch awareness (5–25%) complete the record.
          </p>
        </Panel>

        <Panel title="Synthetic patient generation">
          <p className="text-sm leading-relaxed text-slate-700">
            About 10,000 representative virtual patients are simulated and scaled to the eligible population (default 100,000), which keeps a full run under a second. Patients get an age, income segment (Low 30%, Lower-middle 35%, Upper-middle 23%, High 12%), price sensitivity (higher at lower income), digital engagement (higher when younger and higher-income), competitor loyalty, treatment willingness, doctor influence and an assigned physician (weighted by that physician’s patient volume). Insurance status is resolved per run from your coverage setting: at coverage <em>c</em>, up to 65%·c of patients are Covered and the remainder of the first c are Partially covered, with higher-income patients slightly more likely to be covered.
          </p>
        </Panel>

        <Panel title="Adoption model">
          <p className="text-sm leading-relaxed text-slate-700">Both sides use a logistic (sigmoid) score over inputs normalised to roughly 0–1.</p>
          <div className="mt-4 text-sm font-medium text-slate-900">Physician prescribing probability</div>
          <Formula>{`score = ${P.differentiation}·differentiation×(0.6+0.8·evidence_sensitivity)
      + ${P.awareness}·awareness + ${P.marketing}·marketing_exposure + ${P.peer}·peer_influence×peer_adoption
      + ${P.convenience}·convenience + ${P.innovation}·innovation_tendency
      ${P.priceConcern}·price_concern ${P.competitor}·competitor_pressure
p = sigmoid(score ${sign(P.intercept)})   → physician prescribes if p exceeds a fixed personal threshold`}</Formula>
          <CoefTable
            rows={[
              ["Differentiation", P.differentiation],
              ["Physician awareness", P.awareness],
              ["Marketing exposure", P.marketing],
              ["Peer influence", P.peer],
              ["Convenience advantage", P.convenience],
              ["Innovation tendency", P.innovation],
              ["Price concern", P.priceConcern],
              ["Competitor pressure", P.competitor],
              ["Intercept", P.intercept],
            ]}
          />
          <div className="mt-6 text-sm font-medium text-slate-900">Patient adoption propensity</div>
          <Formula>{`score = ${C.doctor}·doctor_recommendation + ${C.insurance}·insurance_factor + ${C.awareness}·awareness
      + ${C.affordability}·affordability + ${C.willingness}·treatment_willingness + ${C.marketing}·marketing_exposure
      + ${C.convenience}·convenience ${C.priceSensitivity}·effective_price_sensitivity ${C.loyalty}·competitor_loyalty×pressure
propensity = sigmoid(score ${sign(C.intercept)})
monthly start probability = 0.14 × propensity × awareness^0.7   (compared with a seeded random draw)`}</Formula>
          <CoefTable
            rows={[
              ["Doctor recommendation", C.doctor],
              ["Insurance factor", C.insurance],
              ["Awareness", C.awareness],
              ["Affordability", C.affordability],
              ["Treatment willingness", C.willingness],
              ["Marketing exposure", C.marketing],
              ["Convenience", C.convenience],
              ["Effective price sensitivity", C.priceSensitivity],
              ["Competitor loyalty", C.loyalty],
              ["Intercept", C.intercept],
            ]}
          />
          <p className="mt-4 text-sm leading-relaxed text-slate-700">
            <strong>Price and affordability.</strong> Out-of-pocket price = list price × (1 − insurance support) × (1 − discount) × (1 − affordability support). Insurance support is fictional: Covered {INSURANCE_SUPPORT.Covered * 100}%, Partially covered {INSURANCE_SUPPORT["Partially covered"] * 100}%, Not covered 0%. Affordability compares that price with an income-based monthly budget; price sensitivity grows faster than linearly with price. Adopted patients drop off each month with a rate that falls when adherence attractiveness is high and affordability is good.
          </p>
          <p className="mt-3 text-xs font-medium text-amber-800">{COEFFICIENT_NOTE}</p>
        </Panel>

        <Panel title="Marketing response">
          <p className="text-sm leading-relaxed text-slate-700">
            Budget is phased across months (front-loaded around launch) and split into consumer, physician, digital and other buckets. Each channel’s effect follows diminishing returns, <code className="rounded bg-slate-100 px-1">effect = 1 − exp(−k × spend per target)</code>, so doubling the budget does not double adoption. Physician exposure combines marketing spend, sales-rep reach (scaled by outreach intensity and physician count) and educational events. Awareness then evolves as <code className="rounded bg-slate-100 px-1">a ← a + (1−a)(marketing + peer/doctor effects) − decay·a</code>, clamped to 0–1.
          </p>
        </Panel>

        <Panel title="Competitor model">
          <p className="text-sm leading-relaxed text-slate-700">
            Three fictional competitors (DiaCare, GlucoEase, MetraPlus) create pressure weighted by baseline share, price advantage, marketing intensity and a Weak/Moderate/Strong setting. Scheduled events change the world from a chosen month: a price cut, a marketing increase, or a generic entrant. Events appear as amber markers on the dashboard timeline. When GlucoNova gains patients, the rest of the market is divided among competitors according to their relative attractiveness.
          </p>
        </Panel>

        <Panel title="Financial model">
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
            <li><strong>Gross revenue</strong> = active patients × list price. <strong>Net revenue</strong> also removes patient discounts, payer rebates (Covered {PAYER_REBATE.Covered * 100}%, Partial {PAYER_REBATE["Partially covered"] * 100}%) and affordability support.</li>
            <li><strong>Costs</strong>: marketing budget phased over months; salesforce = reps × ₹85,000 per month (× an intensity factor); educational events at {EVENT_COST.toLocaleString("en-IN")} each; a one-off fixed launch cost (default ₹1.5 Cr) in month 1.</li>
            <li><strong>Profit</strong> (operating contribution) = net revenue × (1 − {COGS_RATE * 100}% cost of goods) − costs. <strong>Break-even</strong> = first month cumulative profit ≥ 0.</li>
            <li><strong>Marketing ROI</strong> is incremental: margin generated versus a counterfactual launch with zero marketing budget, minus marketing spend, divided by marketing spend.</li>
            <li><strong>CAC</strong> = (marketing + salesforce spend) ÷ patients acquired; marketing cost per patient uses marketing only.</li>
          </ul>
        </Panel>

        <Panel title="Analysis tools">
          <p className="text-sm leading-relaxed text-slate-700">
            <strong>Sensitivity</strong> re-runs the full simulation while changing one lever, everything else fixed. <strong>Find Efficient Strategy</strong> grid-searches 300 combinations on a smaller patient sample and ranks them with a synthetic objective (profit, share, ROI, adoption); it reports trade-offs and never a single universal winner. The <strong>AI Strategy Analyst</strong> is rule-based — every sentence is computed from the current run or from what-if re-runs of the same configuration.
          </p>
        </Panel>

        <Panel title="Limitations">
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
            <li>Everything is synthetic. There is no calibration to real prescribing, claims, epidemiology or pricing data.</li>
            <li>Coefficients and rate constants were chosen so that the model behaves directionally sensibly (price up → adoption down, coverage up → adoption up, diminishing marketing returns), not fitted to evidence.</li>
            <li>Scaling ~10,000 virtual patients to the market adds sampling noise; a single seed is one possible market, not a distribution.</li>
            <li>Regulatory, clinical, supply, reimbursement-negotiation and competitor-response dynamics are heavily simplified. Competitors do not react strategically.</li>
            <li>Nothing here is medical advice or a recommendation for any patient or treatment.</li>
          </ul>
          <div className="mt-4">
            <Callout tone="amber">{REQUIRED}</Callout>
          </div>
        </Panel>
      </div>
    </div>
  );
}
