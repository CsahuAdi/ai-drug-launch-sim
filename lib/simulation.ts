import type {
  CompetitorStrength,
  FunnelStage,
  IncomeSegment,
  InsuranceStatus,
  LaunchConfig,
  Level,
  MonthlyResult,
  PhysicianResults,
  Population,
  ScenarioResult,
  SegmentResults,
  SegmentRow,
  SummaryMetrics,
} from "@/types/simulation";
import { DEFAULT_PATIENT_SAMPLE, INCOME_SEGMENTS, PHYSICIAN_SEGMENTS, getPopulation } from "./generatePopulation";
import {
  COGS_RATE,
  INSURANCE_SUPPORT,
  breakEvenMonth,
  companyNetPrice,
  finalizeFinancials,
  fixedCostForMonth,
  marketingPhasing,
  marketingSpendForMonth,
  monthlyProfit,
  patientEffectivePrice,
  resolveInsuranceStatus,
  salesforceCostForMonth,
} from "./financialModel";
import { clamp, hash01, sigmoid } from "./rng";

/* ------------------------------------------------------------------------- *
 * Model coefficients. Simulation coefficients chosen for illustrative purposes.
 * Exported so the Methodology page can show them.
 * ------------------------------------------------------------------------- */

export const PHYSICIAN_COEF = {
  differentiation: 1.1,
  awareness: 0.9,
  marketing: 1.6,
  peer: 0.7,
  convenience: 0.6,
  innovation: 0.5,
  priceConcern: -0.8,
  competitor: -0.7,
  intercept: -3.0,
} as const;

export const PATIENT_COEF = {
  doctor: 2.6,
  insurance: 0.9,
  awareness: 0.7,
  affordability: 0.6,
  willingness: 0.5,
  marketing: 0.4,
  convenience: 0.3,
  priceSensitivity: -2.8,
  loyalty: -0.6,
  intercept: -3.9,
} as const;

/** Share of the "propensity" that converts into a start in any one month. */
const MONTHLY_CONVERSION = 0.14;
const BASE_CHURN = 0.03;
const PHYS_AWARENESS_DECAY = 0.03;
const PATIENT_AWARENESS_DECAY = 0.045;

/** Diminishing-returns rate constants: effect = 1 - exp(-k * spend). */
const K_PHYSICIAN_SPEND = 0.0007; // per INR per physician per month
const K_CONSUMER_SPEND = 0.55; // per INR per eligible patient per month
const K_DIGITAL_SPEND = 0.8;
const EVENT_ATTENDEES_PER_MONTH = 70;

const LEVEL_VALUE: Record<Level, number> = { Low: 0.2, Medium: 0.5, High: 0.85 };
const REACH_MULT: Record<Level, number> = { Low: 0.6, Medium: 1, High: 1.5 };
const CHURN_MULT: Record<Level, number> = { Low: 1.5, Medium: 1, High: 0.6 };
const STRENGTH_BASE: Record<CompetitorStrength, number> = { Weak: 0.3, Moderate: 0.55, Strong: 0.8 };

export interface SimOptions {
  /** Virtual patients simulated (scaled to marketSize). Lower = faster (sweeps). */
  patientSample?: number;
  population?: Population;
  /** Skip the zero-marketing counterfactual (marketing ROI will be 0). */
  skipCounterfactual?: boolean;
  /**
   * Optional memo for the zero-marketing baseline. The baseline ignores the marketing budget
   * and its allocation, so grid searches over marketing can share it. Only reuse a cache
   * between runs that use the same population.
   */
  counterfactualCache?: Map<string, number[]>;
}

/* ------------------------------ competitor state --------------------------- */

interface CompetitorState {
  pressure: number;
  refPrice: number;
  mktAvg: number;
  shares: Record<string, number>;
  events: string[];
}

function competitorStateAt(config: LaunchConfig, month: number, glucoShare: number): CompetitorState {
  const comps = config.competitors;
  const totalBase = comps.reduce((s, c) => s + c.baseShare, 0) || 1;
  const prices = comps.map((c) => c.price);
  const mkt = comps.map(() => 1);
  let genericAge = -1;
  const events: string[] = [];

  for (const ev of config.competitorEvents) {
    if (!ev.enabled || ev.month > month) continue;
    const targets = comps.map((c, i) => (ev.competitorId === "all" || ev.competitorId === c.id ? i : -1)).filter((i) => i >= 0);
    const label = ev.competitorId === "all" ? "Competitors" : (comps.find((c) => c.id === ev.competitorId)?.name ?? "Competitor");
    if (ev.type === "price_cut") {
      for (const i of targets) prices[i] *= 1 - ev.magnitude;
      if (ev.month === month) events.push(`${label} cut price ${Math.round(ev.magnitude * 100)}%`);
    } else if (ev.type === "marketing_increase") {
      for (const i of targets) mkt[i] *= 1 + ev.magnitude;
      if (ev.month === month) events.push(`${label} raised marketing ${Math.round(ev.magnitude * 100)}%`);
    } else {
      genericAge = month - ev.month;
      if (ev.month === month) events.push("Generic competitor entered the market");
    }
  }

  const strength = STRENGTH_BASE[config.competitorStrength];
  let pressure = 0;
  let refPrice = 0;
  let mktAvg = 0;
  const weights: number[] = [];
  comps.forEach((c, i) => {
    const w = c.baseShare / totalBase;
    const priceEdge = Math.min(1.6, c.price / prices[i]);
    pressure += w * strength * mkt[i] * (0.75 + 0.25 * priceEdge);
    refPrice += w * prices[i];
    mktAvg += w * mkt[i];
    weights.push(w * Math.pow(mkt[i], 0.6) * Math.pow(priceEdge, 0.6));
  });

  const ramp = genericAge >= 0 ? Math.min(1, 0.35 + 0.15 * genericAge) : 0;
  const baseRef = comps.reduce((s, c) => s + (c.baseShare / totalBase) * c.price, 0);
  if (ramp > 0) {
    pressure += 0.1 * ramp;
    refPrice = refPrice * (1 - 0.25 * ramp) + 0.25 * ramp * 0.45 * baseRef;
  }

  const remaining = Math.max(0, 1 - glucoShare);
  const genericShare = 0.12 * ramp;
  const wSum = weights.reduce((s, w) => s + w, 0) || 1;
  const shares: Record<string, number> = {};
  comps.forEach((c, i) => {
    shares[c.id] = remaining * (1 - genericShare) * (weights[i] / wSum);
  });
  if (ramp > 0) shares.generic = remaining * genericShare;

  return { pressure: clamp(pressure), refPrice: Math.max(refPrice, 1), mktAvg, shares, events };
}

/* --------------------------------- core run -------------------------------- */

interface CoreOutput {
  rows: MonthlyResult[];
  segments: SegmentResults;
  physicians: PhysicianResults;
  funnel: FunnelStage[];
  patientsEverAdopted: number;
  activeFinal: number;
  sampleSize: number;
}

const AGE_GROUPS = ["25-39", "40-54", "55-69", "70+"];
const ageGroupIndex = (age: number) => (age < 40 ? 0 : age < 55 ? 1 : age < 70 ? 2 : 3);
const band = (v: number) => (v < 0.35 ? 0 : v < 0.6 ? 1 : 2);
const BAND_LABELS = ["Low", "Medium", "High"];
const INSURANCE_LABELS: InsuranceStatus[] = ["Covered", "Partially covered", "Not covered"];

function runCore(config: LaunchConfig, pop: Population): CoreOutput {
  const { physicians: P, patients: N } = pop;
  const nP = P.length;
  const nN = N.length;
  const scale = config.marketSize / nN;
  const months = config.simulationMonths;
  const seed = config.seed;

  const diff = LEVEL_VALUE[config.differentiation];
  const conv = LEVEL_VALUE[config.convenienceAdvantage];
  const churnMult = CHURN_MULT[config.adherenceAttractiveness];

  /* ---- static per-patient quantities (price/coverage are constant over time) ---- */
  const statusCode = new Uint8Array(nN);
  const incomeIdx = new Uint8Array(nN);
  const insFactor = new Float64Array(nN);
  const effPrice = new Float64Array(nN);
  const netPrice = new Float64Array(nN);
  const afford = new Float64Array(nN);
  const physIdx = new Int32Array(nN);
  for (let i = 0; i < nN; i++) {
    const pt = N[i];
    const status = resolveInsuranceStatus(pt.insuranceRank, config.insuranceCoverage);
    statusCode[i] = INSURANCE_LABELS.indexOf(status);
    incomeIdx[i] = INCOME_SEGMENTS.indexOf(pt.incomeSegment);
    insFactor[i] = INSURANCE_SUPPORT[status] / 0.7; // covered=1, partial=0.5, none=0
    effPrice[i] = patientEffectivePrice(config, status, pt.incomeSegment);
    netPrice[i] = companyNetPrice(config, status, pt.incomeSegment);
    afford[i] = 1 / (1 + Math.pow(effPrice[i] / pt.affordabilityBudget, 2.2));
    physIdx[i] = pt.physicianIndex;
  }

  /* ---- dynamic state ---- */
  const physAw = new Float64Array(nP);
  const physProb = new Float64Array(nP);
  const physU = new Float64Array(nP);
  const physPresc = new Uint8Array(nP);
  for (let j = 0; j < nP; j++) {
    physAw[j] = P[j].launchAwareness;
    physU[j] = hash01(seed, j, 90_001);
  }
  const patAw = new Float64Array(nN);
  const patProp = new Float64Array(nN);
  const state = new Uint8Array(nN); // 0 none, 1 active, 2 lapsed
  const everAdopted = new Uint8Array(nN);
  for (let i = 0; i < nN; i++) patAw[i] = N[i].brandAwareness;

  const weights = marketingPhasing(months);
  const salesforce = salesforceCostForMonth(config);
  const eventsMonthly = config.eventsPerQuarter / 3;
  const repReach = (config.salesReps * REACH_MULT[config.outreachIntensity] * 20) / nP;
  const repEff = 1 - Math.exp(-0.9 * repReach);
  const eventEff = 1 - Math.exp((-eventsMonthly * EVENT_ATTENDEES_PER_MONTH) / nP);

  const rows: MonthlyResult[] = [];
  let prevPhysAdoption = 0;
  let activeCount = 0;
  let acquiredCount = 0;

  for (let m = 1; m <= months; m++) {
    /* 1. marketing exposure */
    const spend = marketingSpendForMonth(config, m, weights);
    const spendPerDoc = spend.physician / nP;
    const physSpendEff = 1 - Math.exp(-K_PHYSICIAN_SPEND * spendPerDoc);
    const physEffect = 1 - (1 - physSpendEff) * (1 - 0.7 * repEff) * (1 - 0.5 * eventEff);
    const consEff = 1 - Math.exp((-K_CONSUMER_SPEND * (spend.consumer + 0.5 * spend.other)) / config.marketSize);
    const digEff = 1 - Math.exp((-K_DIGITAL_SPEND * (spend.digital + 0.25 * spend.other)) / config.marketSize);

    /* competitor state (events take effect from their month) */
    const glucoShareNow = activeCount / nN; // previous month's share drives competitor split
    const comp = competitorStateAt(config, m, glucoShareNow);
    const priceRel = config.price / comp.refPrice;
    const priceConcernBase = clamp((priceRel - 0.4) / 1.6);
    const compMktDamp = 1 / Math.sqrt(comp.mktAvg);

    /* 2-3. physician awareness + prescribing probability */
    let awSum = 0;
    let probSum = 0;
    let prescCount = 0;
    const peerLevel = clamp(prevPhysAdoption * 2);
    for (let j = 0; j < nP; j++) {
      const ph = P[j];
      const gain =
        0.22 * physEffect * (0.4 + 0.6 * ph.marketingResponsiveness) * (0.8 + 0.4 * ph.brandFamiliarity) * compMktDamp;
      const peerEffect = 0.12 * ph.peerInfluence * prevPhysAdoption;
      const aw = clamp(physAw[j] + (1 - physAw[j]) * (gain + peerEffect) - PHYS_AWARENESS_DECAY * physAw[j]);
      physAw[j] = aw;

      const mktExposure = physEffect * (0.4 + 0.6 * ph.marketingResponsiveness);
      const score =
        PHYSICIAN_COEF.differentiation * diff * (0.6 + 0.8 * ph.evidenceSensitivity) +
        PHYSICIAN_COEF.awareness * aw +
        PHYSICIAN_COEF.marketing * mktExposure +
        PHYSICIAN_COEF.peer * ph.peerInfluence * peerLevel +
        PHYSICIAN_COEF.convenience * conv +
        PHYSICIAN_COEF.innovation * ph.innovationTendency +
        PHYSICIAN_COEF.priceConcern * ph.priceSensitivity * priceConcernBase +
        PHYSICIAN_COEF.competitor * comp.pressure * (0.6 + 0.4 * ph.competitorPreferenceStrength);
      const prob = sigmoid(score + PHYSICIAN_COEF.intercept);
      physProb[j] = prob;
      const prescribing = physU[j] < prob ? 1 : 0;
      physPresc[j] = prescribing;
      awSum += aw;
      probSum += prob;
      prescCount += prescribing;
    }
    const physAdoption = prescCount / nP;
    prevPhysAdoption = physAdoption;

    /* 4-6. patient awareness, adoption probability, new/churned patients */
    let newCount = 0;
    let churnCount = 0;
    let patAwSum = 0;
    let netRevenueSample = 0;
    for (let i = 0; i < nN; i++) {
      const pt = N[i];
      const docP = physProb[physIdx[i]];

      const awGain = Math.min(
        0.8,
        0.12 * consEff + 0.12 * digEff * pt.digitalEngagement + 0.1 * docP * pt.doctorInfluence,
      );
      const aw = clamp(patAw[i] + (1 - patAw[i]) * awGain - PATIENT_AWARENESS_DECAY * patAw[i]);
      patAw[i] = aw;
      patAwSum += aw;

      const docRec = docP * (0.4 + 0.6 * pt.doctorInfluence);
      const mktExposure = clamp(0.6 * consEff + 0.6 * digEff * pt.digitalEngagement);
      // Convex: sticker shock grows faster than linearly with the price a patient faces
      const priceLoad = clamp(0.6 * (effPrice[i] / 2000) + 0.4 * (priceRel / 1.6), 0, 1.5);
      const sens = pt.priceSensitivity * Math.pow(priceLoad, 1.5);
      const score =
        PATIENT_COEF.doctor * docRec +
        PATIENT_COEF.insurance * insFactor[i] +
        PATIENT_COEF.awareness * aw +
        PATIENT_COEF.affordability * afford[i] +
        PATIENT_COEF.willingness * pt.treatmentWillingness +
        PATIENT_COEF.marketing * mktExposure +
        PATIENT_COEF.convenience * conv +
        PATIENT_COEF.priceSensitivity * sens +
        PATIENT_COEF.loyalty * pt.competitorLoyalty * (0.6 + 0.8 * comp.pressure);
      const prop = sigmoid(score + PATIENT_COEF.intercept);
      patProp[i] = prop;

      if (state[i] === 0) {
        const hazard = MONTHLY_CONVERSION * prop * Math.pow(aw, 0.7);
        if (hash01(seed, i, m) < hazard) {
          state[i] = 1;
          everAdopted[i] = 1;
          newCount++;
        }
      } else if (state[i] === 1) {
        const churn = BASE_CHURN * churnMult * (1 + 0.6 * (1 - afford[i]));
        if (hash01(seed, i, 10_000 + m) < churn) {
          state[i] = 2;
          churnCount++;
        }
      }
      if (state[i] === 1) netRevenueSample += netPrice[i];
    }

    /* 7-9. active patients, market share, revenue */
    activeCount += newCount - churnCount;
    acquiredCount += newCount;
    const activeScaled = activeCount * scale;
    const share = clamp(activeCount / nN);
    const grossRevenue = activeScaled * config.price;
    const netRevenue = netRevenueSample * scale;
    const compAfter = competitorStateAt(config, m, share);

    /* 10-11. costs and operating contribution */
    const fixed = fixedCostForMonth(config, m);
    const cost = spend.total + salesforce + fixed;

    rows.push({
      month: m,
      physicianAwareness: awSum / nP,
      physicianAdoption: physAdoption,
      prescriptionProbability: probSum / nP,
      patientAwareness: patAwSum / nN,
      newPatients: newCount * scale,
      churnedPatients: churnCount * scale,
      activePatients: activeScaled,
      cumulativeAcquired: acquiredCount * scale,
      marketShare: share,
      competitorShares: compAfter.shares,
      grossRevenue,
      netRevenue,
      monthlyRevenue: grossRevenue,
      cumulativeRevenue: 0,
      marketingSpend: spend.total,
      salesforceSpend: salesforce,
      fixedCost: fixed,
      monthlyCost: cost,
      cumulativeCost: 0,
      monthlyProfit: monthlyProfit(netRevenue, cost),
      cumulativeProfit: 0,
      cumulativeMarketingSpend: 0,
      marketingROI: 0,
      /* 12. competitor events */
      events: comp.events,
    });
  }

  /* ---- end-state aggregates ---- */
  const segments = buildSegments(N, statusCode, everAdopted, state, scale);
  const physicians = buildPhysicianResults(P, physAw, physProb, physPresc);
  const funnel = buildFunnel(config, N, patAw, patProp, physPresc, physIdx, everAdopted, state, scale, seed);

  let ever = 0;
  for (let i = 0; i < nN; i++) ever += everAdopted[i];

  return {
    rows,
    segments,
    physicians,
    funnel,
    patientsEverAdopted: ever * scale,
    activeFinal: activeCount * scale,
    sampleSize: nN,
  };
}

/* ------------------------------ aggregates -------------------------------- */

function buildSegments(
  N: Population["patients"],
  statusCode: Uint8Array,
  ever: Uint8Array,
  state: Uint8Array,
  scale: number,
): SegmentResults {
  const make = (labels: string[], key: (i: number) => number): SegmentRow[] => {
    const cnt = new Array(labels.length).fill(0);
    const adopted = new Array(labels.length).fill(0);
    const active = new Array(labels.length).fill(0);
    for (let i = 0; i < N.length; i++) {
      const k = key(i);
      cnt[k]++;
      adopted[k] += ever[i];
      active[k] += state[i] === 1 ? 1 : 0;
    }
    return labels.map((label, k) => ({
      label,
      patients: cnt[k] * scale,
      adoptionRate: cnt[k] ? adopted[k] / cnt[k] : 0,
      activeRate: cnt[k] ? active[k] / cnt[k] : 0,
    }));
  };
  return {
    income: make(INCOME_SEGMENTS, (i) => INCOME_SEGMENTS.indexOf(N[i].incomeSegment as IncomeSegment)),
    insurance: make(INSURANCE_LABELS, (i) => statusCode[i]),
    age: make(AGE_GROUPS, (i) => ageGroupIndex(N[i].age)),
    priceSensitivity: make(BAND_LABELS, (i) => band(N[i].priceSensitivity)),
    digitalEngagement: make(BAND_LABELS, (i) => band(N[i].digitalEngagement)),
  };
}

function buildPhysicianResults(
  P: Population["physicians"],
  aw: Float64Array,
  prob: Float64Array,
  presc: Uint8Array,
): PhysicianResults {
  const segments = PHYSICIAN_SEGMENTS.map((segment) => {
    let count = 0;
    let pr = 0;
    let a = 0;
    let p = 0;
    for (let j = 0; j < P.length; j++) {
      if (P[j].segment !== segment) continue;
      count++;
      pr += presc[j];
      a += aw[j];
      p += prob[j];
    }
    return {
      segment,
      count,
      prescribingRate: count ? pr / count : 0,
      avgAwareness: count ? a / count : 0,
      avgProbability: count ? p / count : 0,
    };
  });
  const sample = P.slice(0, 12).map((ph, j) => ({
    physicianId: ph.physicianId,
    segment: ph.segment,
    specialtyType: ph.specialtyType,
    patientVolume: ph.patientVolume,
    awareness: aw[j],
    prescriptionProbability: prob[j],
    prescribing: presc[j] === 1,
  }));
  return { segments, sample };
}

function buildFunnel(
  config: LaunchConfig,
  N: Population["patients"],
  aw: Float64Array,
  prop: Float64Array,
  physPresc: Uint8Array,
  physIdx: Int32Array,
  ever: Uint8Array,
  state: Uint8Array,
  scale: number,
  seed: number,
): FunnelStage[] {
  let aware = 0;
  let prescribed = 0;
  let considering = 0;
  let adopted = 0;
  let active = 0;
  for (let i = 0; i < N.length; i++) {
    const e = ever[i] === 1;
    const isAware = hash01(seed, i, 777_777) < aw[i] || e;
    const docRx = (isAware && physPresc[physIdx[i]] === 1) || e;
    const consider = (docRx && prop[i] >= 0.2) || e;
    if (isAware) aware++;
    if (docRx) prescribed++;
    if (consider) considering++;
    if (e) adopted++;
    if (state[i] === 1) active++;
  }
  return [
    { label: "Eligible patients", value: config.marketSize },
    { label: "Aware patients", value: aware * scale },
    { label: "Doctor prescribes", value: prescribed * scale },
    { label: "Considering treatment", value: considering * scale },
    { label: "Adopted patients", value: adopted * scale },
    { label: "Retained active", value: active * scale },
  ];
}

/* -------------------------------- summary --------------------------------- */

function summarize(config: LaunchConfig, core: CoreOutput): SummaryMetrics {
  const rows = core.rows;
  const last = rows[rows.length - 1];
  const acquired = core.patientsEverAdopted;
  const marketing = last.cumulativeMarketingSpend;
  const salesforceTotal = rows.reduce((s, r) => s + r.salesforceSpend, 0);
  const netRevenue = rows.reduce((s, r) => s + r.netRevenue, 0);
  const activeMonths = rows.reduce((s, r) => s + r.activePatients, 0);

  const first = rows.find((r) => r.activePatients > 0);
  const growthMonths = first ? last.month - first.month : 0;
  const growth =
    first && growthMonths > 0 && first.activePatients > 0
      ? Math.pow(last.activePatients / first.activePatients, 1 / growthMonths) - 1
      : 0;

  const half = rows.find((r) => r.activePatients >= 0.5 * last.activePatients);

  return {
    finalMarketShare: last.marketShare,
    peakMarketShare: Math.max(...rows.map((r) => r.marketShare)),
    activePatients: last.activePatients,
    newPatientsLastMonth: last.newPatients,
    patientsAcquired: acquired,
    patientAdoptionRate: clamp(acquired / config.marketSize),
    physicianAdoptionRate: last.physicianAdoption,
    patientAwareness: last.patientAwareness,
    physicianAwareness: last.physicianAwareness,
    cumulativeRevenue: last.cumulativeRevenue,
    cumulativeNetRevenue: netRevenue,
    cumulativeProfit: last.cumulativeProfit,
    totalMarketingSpend: marketing,
    totalSalesforceSpend: salesforceTotal,
    totalLaunchCost: last.cumulativeCost,
    marketingROI: last.marketingROI,
    breakEvenMonth: breakEvenMonth(rows),
    customerAcquisitionCost: acquired > 0 ? (marketing + salesforceTotal) / acquired : 0,
    marketingCostPerPatient: acquired > 0 ? marketing / acquired : 0,
    avgMonthlyGrowthRate: growth,
    monthsToHalfFinal: half?.month ?? config.simulationMonths,
    netRevenuePerPatientMonth: activeMonths > 0 ? netRevenue / activeMonths : 0,
  };
}

/* ---------------------------------- API ----------------------------------- */

export function runSimulation(config: LaunchConfig, options: SimOptions = {}): ScenarioResult {
  const sample = options.patientSample ?? DEFAULT_PATIENT_SAMPLE;
  const pop =
    options.population ??
    getPopulation(config.seed, config.physicianCount, sample, config.competitors.map((c) => c.id));

  const core = runCore(config, pop);

  // Counterfactual with zero marketing budget -> incremental marketing ROI
  let cf: number[] = [];
  if (!options.skipCounterfactual && config.marketingBudget > 0) {
    const baseCfg = { ...config, marketingBudget: 0 };
    const cache = options.counterfactualCache;
    const key = cache ? JSON.stringify({ ...baseCfg, consumerMarketingShare: 0, physicianMarketingShare: 0, digitalMarketingShare: 0 }) : "";
    const hit = cache?.get(key);
    if (hit) {
      cf = hit;
    } else {
      const base = runCore(baseCfg, pop);
      let cum = 0;
      cf = base.rows.map((r) => (cum += r.netRevenue * (1 - COGS_RATE)));
      cache?.set(key, cf);
    }
  }
  finalizeFinancials(core.rows, cf);

  return {
    config,
    monthlyResults: core.rows,
    summaryMetrics: summarize(config, core),
    segmentResults: core.segments,
    physicianResults: core.physicians,
    funnel: core.funnel,
    patientSample: core.sampleSize,
  };
}
