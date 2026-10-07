import type { Competitor, CompetitorEvent, LaunchConfig } from "@/types/simulation";

export const DISCLAIMER =
  "All market, patient, physician, competitor, and financial data shown in this application are simulated and for demonstration purposes only.";

export const COEFFICIENT_NOTE = "Simulation coefficients chosen for illustrative purposes.";

export const LAKH = 100_000;
export const CRORE = 10_000_000;

export const DEFAULT_SEED = 20240611;

export const DEFAULT_COMPETITORS: Competitor[] = [
  { id: "A", name: "DiaCare", price: 1300, baseShare: 0.4 },
  { id: "B", name: "GlucoEase", price: 1700, baseShare: 0.35 },
  { id: "C", name: "MetraPlus", price: 900, baseShare: 0.25 },
];

export const DEFAULT_EVENTS: CompetitorEvent[] = [
  { id: "ev-price", type: "price_cut", month: 8, magnitude: 0.2, competitorId: "A", enabled: true },
  { id: "ev-mkt", type: "marketing_increase", month: 12, magnitude: 0.3, competitorId: "all", enabled: false },
  { id: "ev-generic", type: "generic_entry", month: 16, magnitude: 0, competitorId: "all", enabled: false },
];

export const DEFAULT_CONFIG: LaunchConfig = {
  seed: DEFAULT_SEED,
  marketSize: 100_000,
  physicianCount: 500,
  simulationMonths: 24,

  price: 1600,
  differentiation: "Medium",
  convenienceAdvantage: "Medium",
  adherenceAttractiveness: "Medium",

  marketingBudget: 80 * LAKH,
  consumerMarketingShare: 0.3,
  physicianMarketingShare: 0.45,
  digitalMarketingShare: 0.15,

  salesReps: 25,
  outreachIntensity: "Medium",
  eventsPerQuarter: 5,

  insuranceCoverage: 0.55,
  discountRate: 0.05,
  affordabilitySupport: "Basic",

  competitorStrength: "Moderate",
  competitors: DEFAULT_COMPETITORS,
  competitorEvents: DEFAULT_EVENTS,

  fixedLaunchCost: 1.5 * CRORE,
  repMonthlyCost: 85_000,
};

export interface Preset {
  key: "premium" | "balanced" | "penetration";
  name: string;
  blurb: string;
  overrides: Partial<LaunchConfig>;
}

/** §30 demo scenarios. Physician share absorbs the remainder after consumer/digital/other. */
export const PRESETS: Preset[] = [
  {
    key: "premium",
    name: "Premium Launch",
    blurb: "Higher price, focused physician-led spend, lighter coverage.",
    overrides: {
      price: 2100,
      marketingBudget: 60 * LAKH,
      insuranceCoverage: 0.4,
      outreachIntensity: "High",
      consumerMarketingShare: 0.2,
      physicianMarketingShare: 0.55,
      digitalMarketingShare: 0.15,
    },
  },
  {
    key: "balanced",
    name: "Balanced Launch",
    blurb: "Mid-market price with even physician and consumer investment.",
    overrides: {
      price: 1600,
      marketingBudget: 85 * LAKH,
      insuranceCoverage: 0.55,
      outreachIntensity: "Medium",
      consumerMarketingShare: 0.3,
      physicianMarketingShare: 0.45,
      digitalMarketingShare: 0.15,
    },
  },
  {
    key: "penetration",
    name: "Market Penetration",
    blurb: "Lower price, broad coverage and heavy consumer marketing.",
    overrides: {
      price: 1150,
      marketingBudget: 1.2 * CRORE,
      insuranceCoverage: 0.65,
      outreachIntensity: "High",
      consumerMarketingShare: 0.4,
      physicianMarketingShare: 0.35,
      digitalMarketingShare: 0.15,
    },
  },
];

export function presetConfig(preset: Preset, seed: number = DEFAULT_SEED): LaunchConfig {
  return cloneConfig({ ...DEFAULT_CONFIG, ...preset.overrides, seed });
}

export function cloneConfig(c: LaunchConfig): LaunchConfig {
  return {
    ...c,
    competitors: c.competitors.map((x) => ({ ...x })),
    competitorEvents: c.competitorEvents.map((x) => ({ ...x })),
  };
}

export const otherMarketingShare = (c: LaunchConfig): number =>
  Math.max(0, 1 - c.consumerMarketingShare - c.physicianMarketingShare - c.digitalMarketingShare);
