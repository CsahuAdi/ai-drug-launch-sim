import type { LaunchConfig } from "@/types/simulation";

export type AllocKey = "consumer" | "physician" | "digital" | "other";

/** Integer percentages of the four marketing buckets; always sums to 100. */
export function allocations(c: LaunchConfig): Record<AllocKey, number> {
  const consumer = Math.round(c.consumerMarketingShare * 100);
  const physician = Math.round(c.physicianMarketingShare * 100);
  const digital = Math.round(c.digitalMarketingShare * 100);
  return { consumer, physician, digital, other: Math.max(0, 100 - consumer - physician - digital) };
}

/** Set one allocation; the other three are rescaled proportionally so the total stays 100%. */
export function rebalance(c: LaunchConfig, key: AllocKey, raw: number): Partial<LaunchConfig> {
  const cur = allocations(c);
  const value = Math.min(100, Math.max(0, Math.round(raw)));
  const others = (Object.keys(cur) as AllocKey[]).filter((k) => k !== key);
  const rest = 100 - value;
  const sumOthers = others.reduce((s, k) => s + cur[k], 0);
  const next: Record<AllocKey, number> = { ...cur, [key]: value };
  let assigned = 0;
  for (const k of others) {
    next[k] = sumOthers > 0 ? Math.floor((cur[k] / sumOthers) * rest) : Math.floor(rest / others.length);
    assigned += next[k];
  }
  // hand the rounding remainder to the largest of the other buckets
  const largest = others.reduce((a, b) => (next[b] > next[a] ? b : a), others[0]);
  next[largest] += rest - assigned;
  return {
    consumerMarketingShare: next.consumer / 100,
    physicianMarketingShare: next.physician / 100,
    digitalMarketingShare: next.digital / 100,
  };
}
