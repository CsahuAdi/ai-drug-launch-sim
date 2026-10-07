/**
 * Shared types for the PharmaLaunch AI simulator.
 * All entities are FICTIONAL / SIMULATED.
 */

export type Level = "Low" | "Medium" | "High";
export type CompetitorStrength = "Weak" | "Moderate" | "Strong";
export type AffordabilitySupport = "None" | "Basic" | "Strong";

export type IncomeSegment = "Low" | "Lower-middle" | "Upper-middle" | "High";
export type InsuranceStatus = "Covered" | "Partially covered" | "Not covered";
export type PatientAdoptionStatus = "Unaware" | "Aware" | "Considering" | "Adopted" | "Lapsed";

export type PhysicianSegment =
  | "Innovators"
  | "Early adopters"
  | "Mainstream"
  | "Price-sensitive"
  | "Traditionalists";

export type SpecialtyType =
  | "Endocrinologist"
  | "Diabetologist"
  | "General physician"
  | "Internal medicine";

export type CompetitorEventType = "price_cut" | "marketing_increase" | "generic_entry";

/* ------------------------------ configuration ----------------------------- */

export interface Competitor {
  id: string;
  name: string;
  /** Monthly price, INR */
  price: number;
  /** Baseline share of the competitor market (0-1, sums to 1 across competitors) */
  baseShare: number;
}

export interface CompetitorEvent {
  id: string;
  type: CompetitorEventType;
  /** Month (1-based) in which the event takes effect */
  month: number;
  /** Fractional magnitude, e.g. 0.2 = 20% price cut. Ignored for generic_entry. */
  magnitude: number;
  /** Competitor id the event applies to, or "all" */
  competitorId: string | "all";
  enabled: boolean;
}

export interface LaunchConfig {
  /** PRNG seed — different seed => different synthetic market */
  seed: number;

  // Market assumptions
  marketSize: number;
  physicianCount: number;
  simulationMonths: number;

  // Drug strategy
  price: number;
  differentiation: Level;
  convenienceAdvantage: Level;
  adherenceAttractiveness: Level;

  // Marketing strategy (shares are fractions; "other" = 1 - the three below)
  marketingBudget: number;
  consumerMarketingShare: number;
  physicianMarketingShare: number;
  digitalMarketingShare: number;

  // Physician outreach
  salesReps: number;
  outreachIntensity: Level;
  eventsPerQuarter: number;

  // Patient accessibility
  insuranceCoverage: number;
  discountRate: number;
  affordabilitySupport: AffordabilitySupport;

  // Competition
  competitorStrength: CompetitorStrength;
  competitors: Competitor[];
  competitorEvents: CompetitorEvent[];

  // Fictional cost assumptions
  fixedLaunchCost: number;
  repMonthlyCost: number;
}

/* ------------------------------ synthetic data ---------------------------- */

export interface Physician {
  physicianId: number;
  patientVolume: number;
  innovationTendency: number;
  priceSensitivity: number;
  evidenceSensitivity: number;
  brandFamiliarity: number;
  peerInfluence: number;
  marketingResponsiveness: number;
  specialtyType: SpecialtyType;
  currentCompetitorPreference: string;
  /** How strongly this physician prefers the incumbent (0-1) */
  competitorPreferenceStrength: number;
  launchAwareness: number;
  prescriptionProbability: number;
  segment: PhysicianSegment;
}

export interface Patient {
  patientId: number;
  age: number;
  incomeSegment: IncomeSegment;
  /** Resolved per-run from insuranceRank and the configured coverage */
  insuranceStatus: InsuranceStatus;
  /** Percentile 0-1: lower rank => more likely to be covered */
  insuranceRank: number;
  priceSensitivity: number;
  brandAwareness: number;
  treatmentWillingness: number;
  doctorInfluence: number;
  digitalEngagement: number;
  /** Monthly INR the patient can plausibly allocate to this therapy */
  affordabilityBudget: number;
  affordabilityScore: number;
  competitorLoyalty: number;
  adoptionProbability: number;
  adoptionStatus: PatientAdoptionStatus;
  /** Index into the physician array */
  physicianIndex: number;
}

export interface Population {
  seed: number;
  physicians: Physician[];
  patients: Patient[];
}

/* -------------------------------- results --------------------------------- */

export interface MonthlyResult {
  month: number;
  physicianAwareness: number;
  /** Share of simulated physicians prescribing (0-1) */
  physicianAdoption: number;
  /** Mean prescription probability across physicians (0-1) */
  prescriptionProbability: number;
  patientAwareness: number;
  newPatients: number;
  churnedPatients: number;
  activePatients: number;
  cumulativeAcquired: number;
  /** GlucoNova share of the eligible treated market (0-1) */
  marketShare: number;
  /** Competitor shares (0-1), keyed by competitor id, plus "generic" when active */
  competitorShares: Record<string, number>;

  grossRevenue: number;
  /** Net revenue after patient discount, payer rebates and affordability support */
  netRevenue: number;
  /** Alias of grossRevenue per spec §27 (monthlyRevenue) */
  monthlyRevenue: number;
  cumulativeRevenue: number;

  marketingSpend: number;
  salesforceSpend: number;
  fixedCost: number;
  monthlyCost: number;
  cumulativeCost: number;
  monthlyProfit: number;
  cumulativeProfit: number;
  cumulativeMarketingSpend: number;
  marketingROI: number;

  /** Human-readable competitor events that took effect this month */
  events: string[];
}

export interface SummaryMetrics {
  finalMarketShare: number;
  peakMarketShare: number;
  activePatients: number;
  newPatientsLastMonth: number;
  patientsAcquired: number;
  /** Ever-adopted patients / eligible patients (0-1) */
  patientAdoptionRate: number;
  physicianAdoptionRate: number;
  patientAwareness: number;
  physicianAwareness: number;
  cumulativeRevenue: number;
  cumulativeNetRevenue: number;
  cumulativeProfit: number;
  totalMarketingSpend: number;
  totalSalesforceSpend: number;
  totalLaunchCost: number;
  marketingROI: number;
  /** First month in which cumulative profit >= 0, or null */
  breakEvenMonth: number | null;
  /** (marketing + salesforce) / patients acquired */
  customerAcquisitionCost: number;
  /** marketing / patients acquired */
  marketingCostPerPatient: number;
  /** Geometric average month-on-month growth in active patients */
  avgMonthlyGrowthRate: number;
  /** Month in which active patients first reach 50% of the final level */
  monthsToHalfFinal: number;
  /** Net revenue per active patient-month, INR */
  netRevenuePerPatientMonth: number;
}

export interface SegmentRow {
  label: string;
  /** Scaled patient count in the segment */
  patients: number;
  /** Ever adopted / segment size (0-1) */
  adoptionRate: number;
  /** Active at end / segment size (0-1) */
  activeRate: number;
}

export interface SegmentResults {
  income: SegmentRow[];
  insurance: SegmentRow[];
  age: SegmentRow[];
  priceSensitivity: SegmentRow[];
  digitalEngagement: SegmentRow[];
}

export interface FunnelStage {
  label: string;
  value: number;
}

export interface PhysicianSegmentRow {
  segment: PhysicianSegment;
  count: number;
  prescribingRate: number;
  avgAwareness: number;
  avgProbability: number;
}

export interface PhysicianSnapshot {
  physicianId: number;
  segment: PhysicianSegment;
  specialtyType: SpecialtyType;
  patientVolume: number;
  awareness: number;
  prescriptionProbability: number;
  prescribing: boolean;
}

export interface PhysicianResults {
  segments: PhysicianSegmentRow[];
  sample: PhysicianSnapshot[];
}

export interface ScenarioResult {
  config: LaunchConfig;
  monthlyResults: MonthlyResult[];
  summaryMetrics: SummaryMetrics;
  segmentResults: SegmentResults;
  physicianResults: PhysicianResults;
  funnel: FunnelStage[];
  /** Fixed simulated-run sample size that was scaled up to marketSize */
  patientSample: number;
}

export interface SavedScenario {
  id: string;
  name: string;
  config: LaunchConfig;
  result: ScenarioResult;
  savedAt: number;
}
