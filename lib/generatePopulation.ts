import type {
  IncomeSegment,
  Patient,
  Physician,
  PhysicianSegment,
  Population,
  SpecialtyType,
} from "@/types/simulation";
import { clamp, mulberry32, normal, pickWeighted } from "./rng";

/** Representative virtual patients; results are scaled up to the market size. */
export const DEFAULT_PATIENT_SAMPLE = 10_000;

export const PHYSICIAN_SEGMENTS: PhysicianSegment[] = [
  "Innovators",
  "Early adopters",
  "Mainstream",
  "Price-sensitive",
  "Traditionalists",
];

const SEGMENT_WEIGHTS = [0.08, 0.17, 0.4, 0.2, 0.15];

interface SegmentProfile {
  innovation: number;
  priceSens: number;
  evidence: number;
  peer: number;
  responsiveness: number;
  familiarity: number;
}

const PROFILES: Record<PhysicianSegment, SegmentProfile> = {
  Innovators: { innovation: 0.88, priceSens: 0.35, evidence: 0.7, peer: 0.3, responsiveness: 0.7, familiarity: 0.35 },
  "Early adopters": { innovation: 0.7, priceSens: 0.45, evidence: 0.65, peer: 0.5, responsiveness: 0.65, familiarity: 0.28 },
  Mainstream: { innovation: 0.5, priceSens: 0.5, evidence: 0.5, peer: 0.62, responsiveness: 0.5, familiarity: 0.2 },
  "Price-sensitive": { innovation: 0.42, priceSens: 0.88, evidence: 0.45, peer: 0.5, responsiveness: 0.45, familiarity: 0.18 },
  Traditionalists: { innovation: 0.14, priceSens: 0.5, evidence: 0.4, peer: 0.35, responsiveness: 0.25, familiarity: 0.12 },
};

const SPECIALTIES: SpecialtyType[] = ["Endocrinologist", "Diabetologist", "General physician", "Internal medicine"];

export const INCOME_SEGMENTS: IncomeSegment[] = ["Low", "Lower-middle", "Upper-middle", "High"];
const INCOME_WEIGHTS = [0.3, 0.35, 0.23, 0.12];
const INCOME_PRICE_SENS: Record<IncomeSegment, number> = {
  Low: 0.75,
  "Lower-middle": 0.6,
  "Upper-middle": 0.4,
  High: 0.25,
};
/** Fictional monthly INR a patient can plausibly allocate to a chronic-care drug. */
const INCOME_BUDGET: Record<IncomeSegment, number> = {
  Low: 600,
  "Lower-middle": 1100,
  "Upper-middle": 2200,
  High: 4500,
};

export function generatePhysicians(seed: number, count: number, competitorIds: string[]): Physician[] {
  const rand = mulberry32(seed ^ 0x51ed270b);
  const out: Physician[] = [];
  const ids = competitorIds.length ? competitorIds : ["A"];
  for (let i = 0; i < count; i++) {
    const segment = pickWeighted(rand, PHYSICIAN_SEGMENTS, SEGMENT_WEIGHTS);
    const p = PROFILES[segment];
    const jitter = (mean: number, sd = 0.1) => clamp(normal(rand, mean, sd));
    // Right-skewed volume, 50-500 patients per month
    const volume = Math.round(clamp(50 + Math.pow(rand(), 1.6) * 450, 50, 500));
    const specialty = pickWeighted(rand, SPECIALTIES, [0.15, 0.3, 0.35, 0.2]);
    out.push({
      physicianId: i + 1,
      patientVolume: volume,
      innovationTendency: jitter(p.innovation),
      priceSensitivity: jitter(p.priceSens),
      evidenceSensitivity: jitter(p.evidence + (specialty === "Endocrinologist" ? 0.1 : 0)),
      brandFamiliarity: jitter(p.familiarity, 0.06),
      peerInfluence: jitter(p.peer),
      marketingResponsiveness: jitter(p.responsiveness),
      specialtyType: specialty,
      currentCompetitorPreference: ids[Math.floor(rand() * ids.length)],
      competitorPreferenceStrength: jitter(1 - p.innovation * 0.6, 0.15),
      launchAwareness: 0.05 + rand() * 0.2,
      prescriptionProbability: 0,
      segment,
    });
  }
  return out;
}

export function generatePatients(seed: number, count: number, physicians: Physician[]): Patient[] {
  const rand = mulberry32(seed ^ 0x9e3779b1);

  // Assign each patient to a physician, weighted by that physician's patient volume
  const cum: number[] = [];
  let run = 0;
  for (const ph of physicians) cum.push((run += ph.patientVolume));
  const pickPhysician = () => {
    const r = rand() * run;
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  const patients: Patient[] = [];
  const rawInsuranceScore: number[] = [];

  for (let i = 0; i < count; i++) {
    const income = pickWeighted(rand, INCOME_SEGMENTS, INCOME_WEIGHTS);
    const incomeIdx = INCOME_SEGMENTS.indexOf(income);
    const ageYears = Math.round(clamp(normal(rand, 54, 11), 25, 85));
    const digital = clamp(0.78 - (ageYears - 25) * 0.009 + incomeIdx * 0.06 + normal(rand, 0, 0.12));
    const priceSens = clamp(INCOME_PRICE_SENS[income] + normal(rand, 0, 0.14));
    const loyalty = clamp(0.4 + (ageYears - 25) * 0.005 + normal(rand, 0, 0.18), 0.05, 0.95);
    const budget = INCOME_BUDGET[income] * Math.exp(normal(rand, 0, 0.3));

    rawInsuranceScore.push(rand() + 0.28 * (1 - incomeIdx / 3));

    patients.push({
      patientId: i + 1,
      age: ageYears,
      incomeSegment: income,
      insuranceStatus: "Not covered",
      insuranceRank: 0,
      priceSensitivity: priceSens,
      brandAwareness: 0.02 + rand() * 0.08,
      treatmentWillingness: clamp(0.25 + rand() * 0.6 + normal(rand, 0, 0.05)),
      doctorInfluence: 0.3 + rand() * 0.7,
      digitalEngagement: digital,
      affordabilityBudget: budget,
      affordabilityScore: 0,
      competitorLoyalty: loyalty,
      adoptionProbability: 0,
      adoptionStatus: "Unaware",
      physicianIndex: pickPhysician(),
    });
  }

  // Convert the noisy insurance propensity into a uniform percentile rank, so that a
  // configured coverage of c% means ~c% of patients are eligible for some coverage.
  const order = rawInsuranceScore.map((s, idx) => [s, idx] as const).sort((a, b) => a[0] - b[0]);
  order.forEach(([, idx], rank) => {
    patients[idx].insuranceRank = (rank + 0.5) / count;
  });

  return patients;
}

const cache = new Map<string, Population>();

/** Memoised — population depends only on seed, physician count and sample size. */
export function getPopulation(
  seed: number,
  physicianCount: number,
  patientSample: number = DEFAULT_PATIENT_SAMPLE,
  competitorIds: string[] = ["A", "B", "C"],
): Population {
  const key = `${seed}|${physicianCount}|${patientSample}|${competitorIds.join(",")}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const physicians = generatePhysicians(seed, physicianCount, competitorIds);
  const patients = generatePatients(seed, patientSample, physicians);
  const pop: Population = { seed, physicians, patients };
  cache.set(key, pop);
  if (cache.size > 6) cache.delete(cache.keys().next().value as string);
  return pop;
}
