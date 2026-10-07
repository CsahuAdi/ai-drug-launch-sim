import { DEFAULT_CONFIG, cloneConfig } from "@/lib/defaults";
import { runSimulation } from "@/lib/simulation";
import type { LaunchConfig, ScenarioResult } from "@/types/simulation";

export const run = (patch: Partial<LaunchConfig> = {}, base: LaunchConfig = DEFAULT_CONFIG): ScenarioResult =>
  runSimulation({ ...cloneConfig(base), ...patch });

export const metrics = (patch: Partial<LaunchConfig> = {}) => run(patch).summaryMetrics;

/** Walk any value and return the path of the first non-finite number, or null. */
export function findBadNumber(x: unknown, path = ""): string | null {
  if (typeof x === "number") return Number.isFinite(x) ? null : `${path}=${x}`;
  if (Array.isArray(x)) {
    for (let i = 0; i < x.length; i++) {
      const bad = findBadNumber(x[i], `${path}[${i}]`);
      if (bad) return bad;
    }
  } else if (x && typeof x === "object") {
    for (const [k, v] of Object.entries(x)) {
      if (k === "config") continue;
      const bad = findBadNumber(v, `${path}.${k}`);
      if (bad) return bad;
    }
  }
  return null;
}

export const eventsOnly = (type: string | null): LaunchConfig["competitorEvents"] =>
  DEFAULT_CONFIG.competitorEvents.map((e) => ({ ...e, enabled: e.type === type }));
