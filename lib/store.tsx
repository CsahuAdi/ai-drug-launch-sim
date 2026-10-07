"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { LaunchConfig, SavedScenario, ScenarioResult } from "@/types/simulation";
import { DEFAULT_CONFIG, PRESETS, cloneConfig, presetConfig, type Preset } from "./defaults";
import { runSimulation } from "./simulation";

export type ViewKey =
  | "overview"
  | "configure"
  | "simulation"
  | "segments"
  | "compare"
  | "sensitivity"
  | "methodology";

export const MAX_SCENARIOS = 5;
const STORAGE_KEY = "pharmalaunch.scenarios.v1";

export type SimStatus = "not-run" | "running" | "stale" | "ready";

interface Toast {
  id: number;
  message: string;
  tone: "info" | "error";
}

interface Store {
  view: ViewKey;
  setView: (v: ViewKey) => void;
  config: LaunchConfig;
  updateConfig: (patch: Partial<LaunchConfig>) => void;
  replaceConfig: (c: LaunchConfig) => void;
  loadPreset: (p: Preset) => void;
  resetConfig: () => void;
  result: ScenarioResult | null;
  /** Bumps every time a run completes; views use it to restart playback. */
  runId: number;
  status: SimStatus;
  run: () => void;
  reseed: () => void;
  scenarios: SavedScenario[];
  saveScenario: (name: string) => boolean;
  deleteScenario: (id: string) => void;
  renameScenario: (id: string, name: string) => void;
  loadDemoScenarios: () => void;
  toast: Toast | null;
  notify: (message: string, tone?: Toast["tone"]) => void;
  saveDialogOpen: boolean;
  setSaveDialogOpen: (open: boolean) => void;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside <StoreProvider>");
  return s;
}

const configKey = (c: LaunchConfig) => JSON.stringify(c);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<ViewKey>("overview");
  const [config, setConfig] = useState<LaunchConfig>(() => cloneConfig(DEFAULT_CONFIG));
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState(0);
  const [scenarios, setScenarios] = useState<SavedScenario[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const loaded = useRef(false);
  const configRef = useRef(config);
  configRef.current = config;

  /* Scenarios live in browser storage only (no backend, no auth). */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedScenario[];
        if (Array.isArray(parsed)) setScenarios(parsed.slice(0, MAX_SCENARIOS));
      }
    } catch {
      /* storage unavailable or corrupt — start empty */
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [scenarios]);

  const notify = useCallback((message: string, tone: Toast["tone"] = "info") => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const status: SimStatus = running
    ? "running"
    : !result
      ? "not-run"
      : configKey(result.config) === configKey(config)
        ? "ready"
        : "stale";

  const updateConfig = useCallback((patch: Partial<LaunchConfig>) => setConfig((c) => ({ ...c, ...patch })), []);
  const replaceConfig = useCallback((c: LaunchConfig) => setConfig(cloneConfig(c)), []);
  const loadPreset = useCallback(
    (p: Preset) => {
      setConfig((c) => presetConfig(p, c.seed));
      notify(`Loaded “${p.name}” — press Run Simulation`);
    },
    [notify],
  );
  const resetConfig = useCallback(() => setConfig(cloneConfig(DEFAULT_CONFIG)), []);

  const run = useCallback(() => {
    setRunning(true);
    // Yield one frame so the "running" state paints before the (synchronous) simulation.
    setTimeout(() => {
      try {
        setResult(runSimulation(cloneConfig(configRef.current)));
        setRunId((n) => n + 1);
        setView((v) => (v === "overview" || v === "configure" ? "simulation" : v));
      } finally {
        setRunning(false);
      }
    }, 40);
  }, []);

  const reseed = useCallback(() => {
    const seed = Math.floor(Math.random() * 2_000_000_000) + 1;
    setConfig((c) => ({ ...c, seed }));
    notify(`New synthetic market generated (seed ${seed}) — re-run to see it`);
  }, [notify]);

  const saveScenario = useCallback(
    (name: string) => {
      if (scenarios.length >= MAX_SCENARIOS) {
        notify(`You can keep at most ${MAX_SCENARIOS} scenarios — delete one first`, "error");
        return false;
      }
      const cfg = cloneConfig(configRef.current);
      const res = result && configKey(result.config) === configKey(cfg) ? result : runSimulation(cfg);
      if (res !== result) setResult(res);
      const saved: SavedScenario = {
        id: `sc-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
        name: name.trim() || `Scenario ${scenarios.length + 1}`,
        config: cfg,
        result: res,
        savedAt: Date.now(),
      };
      setScenarios((s) => [...s, saved]);
      notify(`Saved “${saved.name}”`);
      return true;
    },
    [notify, result, scenarios.length],
  );

  const deleteScenario = useCallback((id: string) => setScenarios((s) => s.filter((x) => x.id !== id)), []);
  const renameScenario = useCallback(
    (id: string, name: string) => setScenarios((s) => s.map((x) => (x.id === id ? { ...x, name } : x))),
    [],
  );

  const loadDemoScenarios = useCallback(() => {
    const seed = configRef.current.seed;
    const demo = PRESETS.map((p, i) => {
      const cfg = presetConfig(p, seed);
      return {
        id: `demo-${p.key}-${Date.now()}-${i}`,
        name: p.name,
        config: cfg,
        result: runSimulation(cfg),
        savedAt: Date.now(),
      } satisfies SavedScenario;
    });
    setScenarios((prev) => {
      const keep = prev.filter((s) => !PRESETS.some((p) => p.name === s.name));
      return [...demo, ...keep].slice(0, MAX_SCENARIOS);
    });
    notify("Loaded the three demo scenarios");
  }, [notify]);

  const value = useMemo<Store>(
    () => ({
      view,
      setView,
      config,
      updateConfig,
      replaceConfig,
      loadPreset,
      resetConfig,
      result,
      runId,
      status,
      run,
      reseed,
      scenarios,
      saveScenario,
      deleteScenario,
      renameScenario,
      loadDemoScenarios,
      toast,
      notify,
      saveDialogOpen,
      setSaveDialogOpen,
    }),
    [view, config, updateConfig, replaceConfig, loadPreset, resetConfig, result, runId, status, run, reseed, scenarios, saveScenario, deleteScenario, renameScenario, loadDemoScenarios, toast, notify, saveDialogOpen],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
