"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  BookOpen,
  FlaskConical,
  GitCompareArrows,
  LayoutDashboard,
  LineChart,
  Loader2,
  Play,
  Save,
  Shuffle,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { StoreProvider, useStore, type ViewKey } from "@/lib/store";
import { DISCLAIMER, PRESETS } from "@/lib/defaults";
import { Badge, Button, cx } from "./ui";
import { OverviewView } from "./views/OverviewView";
import { ConfigView } from "./views/ConfigView";
import { SimulationView } from "./views/SimulationView";
import { SegmentsView } from "./views/SegmentsView";
import { CompareView } from "./views/CompareView";
import { SensitivityView } from "./views/SensitivityView";
import { MethodologyView } from "./views/MethodologyView";

const NAV: { key: ViewKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "configure", label: "Configure Launch", icon: SlidersHorizontal },
  { key: "simulation", label: "Simulation", icon: LineChart },
  { key: "segments", label: "Segments", icon: Users },
  { key: "compare", label: "Scenario Comparison", icon: GitCompareArrows },
  { key: "sensitivity", label: "Sensitivity", icon: Activity },
  { key: "methodology", label: "Methodology", icon: BookOpen },
];

function StatusPill() {
  const { status, config } = useStore();
  const map = {
    "not-run": { tone: "slate", text: "Not run yet" },
    running: { tone: "amber", text: "Simulating…" },
    stale: { tone: "amber", text: "Assumptions changed — re-run" },
    ready: { tone: "teal", text: "Simulation up to date" },
  } as const;
  const s = map[status];
  return (
    <span className="flex items-center gap-2" aria-live="polite">
      <Badge tone={s.tone}>
        {status === "running" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
        {s.text}
      </Badge>
      <span className="hidden text-xs tabular-nums text-slate-400 xl:inline">seed {config.seed}</span>
    </span>
  );
}

function Sidebar() {
  const { view, setView } = useStore();
  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:block">
      <div className="sticky top-0 flex h-screen flex-col px-3 py-5">
        <div className="mb-6 flex items-center gap-2 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-white">
            <FlaskConical className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-900">PharmaLaunch AI</div>
            <div className="text-[11px] text-slate-500">Launch strategy sandbox</div>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5" aria-label="Sections">
          {NAV.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              aria-current={view === key ? "page" : undefined}
              className={cx(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600",
                view === key ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto rounded-lg bg-amber-50 px-3 py-2.5 text-[11px] leading-snug text-amber-900">
          Fictional drug, simulated data. Not for clinical, investment or forecasting use.
        </div>
      </div>
    </aside>
  );
}

function MobileNav() {
  const { view, setView } = useStore();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 lg:hidden" aria-label="Sections">
      {NAV.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => setView(key)}
          className={cx(
            "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium",
            view === key ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-700",
          )}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

function SaveDialog() {
  const { saveDialogOpen, setSaveDialogOpen, saveScenario, config, scenarios } = useStore();
  const [name, setName] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!saveDialogOpen) return;
    const match = PRESETS.find((p) => p.overrides.price === config.price && p.overrides.marketingBudget === config.marketingBudget);
    setName(match?.name ?? `Scenario ${scenarios.length + 1}`);
    setTimeout(() => ref.current?.select(), 30);
  }, [saveDialogOpen, config.price, config.marketingBudget, scenarios.length]);

  if (!saveDialogOpen) return null;
  const close = () => setSaveDialogOpen(false);
  const submit = () => {
    if (saveScenario(name)) close();
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Save scenario"
      onKeyDown={(e) => e.key === "Escape" && close()}
    >
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-slate-900">Save scenario</h3>
        <p className="mt-1 text-xs text-slate-500">
          Saved in this browser only. {scenarios.length}/5 slots used.
        </p>
        <input
          ref={ref}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          maxLength={40}
          aria-label="Scenario name"
          className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function Toast() {
  const { toast } = useStore();
  if (!toast) return null;
  return (
    <div
      role="status"
      className={cx(
        "fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg",
        toast.tone === "error" ? "bg-rose-700" : "bg-slate-900",
      )}
    >
      {toast.message}
    </div>
  );
}

function Header() {
  const { run, status, reseed, setSaveDialogOpen } = useStore();
  return (
    <header className="z-30 lg:sticky lg:top-0 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-8">
        <div>
          <h1 className="text-lg font-semibold leading-tight tracking-tight text-slate-900">GlucoNova Launch Simulator</h1>
          <p className="text-xs text-slate-500">AI-assisted pharmaceutical launch strategy simulation</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill />
          <Button variant="ghost" onClick={reseed} title="Generate a different synthetic market (new seed)">
            <Shuffle className="h-4 w-4" />
            <span className="hidden sm:inline">Reseed</span>
          </Button>
          <Button onClick={() => setSaveDialogOpen(true)} title="Save the current configuration as a scenario">
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">Save Scenario</span>
          </Button>
          <Button variant="primary" onClick={run} disabled={status === "running"}>
            {status === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run Simulation
          </Button>
        </div>
      </div>
      <div className="border-t border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-[11px] text-amber-900 lg:px-8">
        {DISCLAIMER}
      </div>
    </header>
  );
}

function Views() {
  const { view } = useStore();
  switch (view) {
    case "overview":
      return <OverviewView />;
    case "configure":
      return <ConfigView />;
    case "simulation":
      return <SimulationView />;
    case "segments":
      return <SegmentsView />;
    case "compare":
      return <CompareView />;
    case "sensitivity":
      return <SensitivityView />;
    case "methodology":
      return <MethodologyView />;
  }
}

export function AppShell() {
  return (
    <StoreProvider>
      <div className="min-h-screen lg:flex">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <Header />
          <MobileNav />
          <main className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8 lg:py-8">
            <Views />
          </main>
        </div>
      </div>
      <SaveDialog />
      <Toast />
    </StoreProvider>
  );
}
