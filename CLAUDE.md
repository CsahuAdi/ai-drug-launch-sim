# PharmaLaunch AI — Drug Launch Strategy Simulator

Project memory + change log. **Read this first each session; update it after every phase.**
Spec: `plan.md` (source of truth for requirements, section numbers referenced below as §N).

## Ground rules
- Business decision-support sim only. NOT clinical. Everything (drug, patients, physicians, competitors, money) is **fictional/simulated** and must be labelled so. Disclaimer text from §2 must be prominent.
- Stack: Next.js (App Router) + React + TypeScript + Tailwind + Recharts. No backend. All sim runs client-side.
- Business logic lives in `lib/` and `types/`, never in components. Files per §26: `lib/simulation.ts`, `lib/generatePopulation.ts`, `lib/financialModel.ts`, `types/simulation.ts`.
- Deterministic: seeded PRNG (mulberry32) everywhere. Same seed + config => identical output. "Reseed" button changes the market.
- Model must stay directionally sane (§31) and never emit NaN/Infinity; shares/adoption clamped to [0,1]. Guarded by the Vitest suite in `tests/`.
- Coefficients labelled: "Simulation coefficients chosen for illustrative purposes."
- Avoid: medical claims, "best overall strategy" wording (§19, §21).

## Commands
- `npm run dev` — dev server
- `npm run build` — production build (type-checks)
- `npm test` (alias `npm run verify`) — Vitest suite in `tests/` (~104 tests, ~13s). `npm run test:watch` for TDD.
- `npm run calibrate` — prints preset/default/sweep tables (`scripts/calibration-report.ts`); use when retuning coefficients, then re-run `npm test`.
- `npm run typecheck` — `tsc --noEmit` (includes tests).

## Phased plan
Status legend: [ ] todo · [~] in progress · [x] done

- [x] **Phase 0 — Scaffold & memory**: Next.js/TS/Tailwind/Recharts project, this CLAUDE.md.
- [x] **Phase 1 — Types & synthetic data** (§5,6,27,28): `types/simulation.ts`, seeded RNG, physician (500) + patient (~10k) generators, physician segments, defaults + 3 demo presets (§30).
- [x] **Phase 2 — Simulation engine & finance** (§7–13,31): physician/patient logistic models, awareness dynamics w/ diminishing returns, competitor events, monthly loop, financial model, summary metrics, segment + physician results. `verify` script for directional checks.
- [x] **Phase 3 — App shell & configuration** (§3,4,24): sidebar nav (no reload), header w/ status/Run/Save/Reseed, Strategy Configuration form (allocations sum to 100%), global store.
- [x] **Phase 4 — Simulation dashboard** (§14,15): 12 KPI cards, adoption/share/revenue/physician charts, patient funnel, marketing efficiency, event markers on timeline.
- [x] **Phase 5 — Segment analytics** (§16,17): patient breakdowns (income, insurance, age, price sensitivity, digital) + physician segment adoption, simulation-derived callouts.
- [x] **Phase 6 — Scenarios & comparison** (§18,19,30): save up to 5 (localStorage), load presets, comparison table + 3 charts + trade-off text.
- [x] **Phase 7 — Sensitivity & optimizer** (§20,21): one-variable sweeps with 4 charts; grid-search "Find Efficient Strategy" with 4 archetype winners.
- [x] **Phase 8 — AI Strategy Analyst & Methodology** (§22,25): rule-based 3–5 data-driven insights, methodology page with required disclaimer.
- [x] **Phase 9 — Polish & verification** (§23,29,32): responsive, perf check (<few s), walk through §32 judge workflow, build passes.

## Architecture notes (fill in as built)
### Engine (`lib/`, `types/`) — Phases 1-2
- `types/simulation.ts` — all interfaces (LaunchConfig, Physician, Patient, MonthlyResult, SummaryMetrics, ScenarioResult, SavedScenario...). Shares/rates are fractions 0-1; money is INR.
- `lib/rng.ts` — mulberry32, `hash01(seed, a, b)` stateless draw (common random numbers => smooth sweeps), clamp, sigmoid.
- `lib/defaults.ts` — DEFAULT_CONFIG, 3 PRESETS (§30), DISCLAIMER/COEFFICIENT_NOTE strings, `cloneConfig`, `otherMarketingShare`. Default competitor price-cut event (month 8) is ENABLED; marketing-increase and generic-entry events exist but are disabled.
- `lib/generatePopulation.ts` — `getPopulation(seed, physicianCount, sample, competitorIds)` memoised. Physician segments assigned first (8/17/40/20/15%), attributes drawn from segment profiles. Patients assigned to physicians weighted by volume. `insuranceRank` = uniform percentile; coverage % is resolved to Covered/Partial/Not per run (`resolveInsuranceStatus`: rank<0.65c covered, <c partial).
- `lib/financialModel.ts` — prices (patient effective vs company net), payer rebates (15%/8%), affordability support, marketing phasing (front-loaded), salesforce cost (reps x ₹85k x intensity mult + events x ₹2L), fixed cost in month 1, COGS 20%, `finalizeFinancials`.
- `lib/simulation.ts` — `runSimulation(config, {patientSample?, population?, skipCounterfactual?})`. 13-step monthly loop. Exports PHYSICIAN_COEF / PATIENT_COEF for Methodology page.
  - Physician prescribing flag = fixed per-physician uniform < probability (deterministic, monotone). Patient adoption = hazard `0.14 * propensity * awareness^0.7` vs `hash01(seed, i, month)`.
  - Patient price sensitivity is convex (`priceLoad^1.5`) so revenue has an interior optimum (~₹1.7-2.0k at defaults).
  - Marketing ROI is INCREMENTAL: (margin vs zero-marketing counterfactual run - spend) / spend. Costs 2 passes per run (~50 ms at 10k patients).
  - Events take effect in their listed month; `MonthlyResult.events` carries labels for timeline markers.
- Calibrated defaults (seed 20240611): Balanced ≈12% share @24m, break-even ~m14, physician adoption ~35%, patient awareness ~67%. Premium ≈6%, Penetration ≈20%.
- Model guard rails live in `tests/model.test.ts` (NaN/bounds, reproducibility, directional checks, presets, perf). Re-run `npm test` after ANY model change; keep it green.

### UI (`components/`, `lib/store.tsx`) — Phase 3
- `app/page.tsx` -> `components/AppShell.tsx` (client). Single-page; views switched via store `view` (no routing/reload): overview, configure, simulation, segments, compare, sensitivity, methodology.
- `lib/store.tsx` — `StoreProvider`/`useStore()`: config, result, runId (bumps each run; drives playback), status (`not-run|running|stale|ready`, stale = config differs from result.config via JSON compare), scenarios (max 5, persisted in localStorage key `pharmalaunch.scenarios.v1`), toast, save dialog, `loadDemoScenarios`. `run()` navigates overview/configure -> simulation.
- `lib/format.ts` (₹ Lakh/Crore formatting, pct), `lib/metrics.ts` (`kpisAt(result, month)` for playback KPIs).
- `components/ui.tsx` — primitives (Panel, Button, SliderField, NumberBox, Segmented, Toggle, Kpi, Callout, EmptyState...). Slider CSS in `app/globals.css`.
- `components/views/ConfigView.tsx` — all §4 inputs; marketing allocation sliders auto-rebalance to 100%; competitor price editing + 3 events; sticky launch snapshot rail.
- Palette: teal-700 = brand/GlucoNova, amber = warnings/events, slate neutrals. Light sidebar + light bg.
- Views for phases 4-8 started as stubs in `components/views/*View.tsx`.

### Dashboard — Phase 4
- `components/views/SimulationView.tsx` — 12 KPI cards (via `kpisAt` at playhead month), playback (Play/Replay/Skip + month scrubber; module-level `playedRunId` prevents replay on tab switch; ref guard for StrictMode), charts: adoption, share (+competitors toggle), revenue vs recurring cost, cumulative profit (+break-even line), physician adoption/awareness, marketing efficiency; patient funnel; efficiency table; `AnalystPanel` slot (stub until Phase 8).
- `components/charts/common.tsx` — palette, axis/grid/tooltip props, `eventMarkers`/`eventLines` (E1.. amber dashed lines only once reached), `ChartCard`, `niceMax`. Reuse for all later charts.
- Visual QA harness: Playwright-core lives in the session scratchpad (NOT in repo); Chrome at /usr/bin/google-chrome; run `next start -p 3111` then screenshot script.

### Segments & scenarios — Phases 5-6
- `SegmentsView.tsx` — 5 patient-segment bar charts + physician prescribing-by-type + distribution table + 12-row physician sample. `segmentInsights()` builds descriptive callouts from results (highest/lowest adoption per dimension; commercial language only).
- `lib/tradeoffs.ts` — `leaderIndex(scenarios, key)` + `tradeoffStatements()`; lists per-scenario leading dimensions, NEVER names an overall best (spec §19).
- `CompareView.tsx` — chips (rename/load-into-config/delete), table per §19 rows (bold = per-row leader), 3 comparison charts, empty state + "Load demo scenarios" (runs the 3 presets on the current seed, replaces same-named saves).

### Sensitivity & optimizer — Phase 7
- `lib/sensitivity.ts` — `SENSITIVITY_VARS` (price, marketing, insurance, reps, consumer share [physician share absorbs change], discount, competitor strength) + `runSensitivity(config, key)` (full-quality runs, ~0.4s each sweep).
- `lib/optimizer.ts` — `findEfficientStrategies(base, onProgress)` async grid 5x5x4x3=300 runs on a 4,000-patient sample (~3.3s), yields to UI every 12 runs. Returns 4 archetype winners + top-4 diverse "trade-off candidates" by synthetic score (35% profit/25% share/20% ROI/20% adoption, min-max normalised). `SimOptions.counterfactualCache` shares the zero-marketing baseline across marketing levels.
- `SensitivityView.tsx` — variable selector, 4 charts (+current-value marker), plain-language takeaway, results table, optimizer panel with "Load into Configure" per strategy.
- **Recalibration during Phase 7** (keep verify green): PHYSICIAN marketing coef 0.8->1.6, intercept -3.0, K_PHYSICIAN_SPEND 0.0007; PATIENT doctor coef 1.3->2.6, intercept -3.9. Reason: sales reps had almost no effect. Now default (seed 20240611) ≈ 11.4% share, phys adoption ≈ 25%, BE m15; Premium 6.2% / Balanced 11.8% / Penetration 20.1%. Marketing profit peaks ~₹3Cr; reps: adoption +30% from 5->150 but profit falls (rep cost dominates at this market size) — this is intentional/known.

### Analyst & methodology — Phase 8
- `lib/insights.ts` — `generateInsights(result)` returns 3-5 insights ranked by priority: access gap (covered vs uncovered), affordability (income gap), price -10% vs marketing +20% probe, marketing diminishing returns (0.5x/1x/2x probes), competitor event vs no-event re-run, physician-segment spread, financial trajectory, adoption speed. Every claim is conditional on data thresholds. Probes use `skipCounterfactual` (~350ms total).
- `components/AnalystPanel.tsx` — rendered at the bottom of the Simulation dashboard; computes in a deferred tick with a spinner.
- `MethodologyView.tsx` — all §25 sections; coefficient tables read from exported PHYSICIAN_COEF/PATIENT_COEF (cannot drift); required limitations sentence verbatim.

### Polish & QA — Phase 9
- §32 judge workflow driven end-to-end in headless Chrome (load Balanced -> run -> price 2100 -> run -> save both -> compare -> sensitivity -> optimizer -> segments -> methodology -> reload persists scenarios): passes, zero console errors, no horizontal overflow at 390px.
- Compare leaders use a 1% tie tolerance (near-equal values are not "leaders"). Header is sticky only at `lg`. `app/icon.svg` favicon.
- Perf: single run ≈50ms (10k patients, 2 passes); sensitivity sweep ≈0.4s; optimizer 300 runs ≈3.3s.
- Known/accepted: optimizer winners cluster at grid edge (₹1.5Cr, 70% coverage) — grid is spec-fixed; UI says so. Reps reduce profit at this market size (cost-dominated). Scenario storage is localStorage only.

### Tests, export, worker — Phase 10 (post-MVP)
- **Tests** (Vitest, node env, `vitest.config.mts` aliases `@`): `model` (sanity, reproducibility, directional, events, presets), `financial`, `population` (rng, generators, allocation rebalancing), `export` (CSV round-trip parser, formula-injection guard, PDF validity), `analysis` (insights, trade-offs, sensitivity), `optimizer` (grid, cancel, worker client with fake Worker, worker protocol with stubbed `self`). Mutation-checked: inverting price sign / insurance resolution fails 7 / 2 tests. Helpers in `tests/helpers.ts`.
- **CSV** (`lib/export.ts`, pure): monthly results, scenario comparison, sensitivity sweep. Raw numbers (no ₹/commas), BOM added at download (`lib/download.ts`), text cells starting with = + - @ are prefixed with `'`.
- **PDF** (`lib/pdfReport.ts`, jsPDF + jspdf-autotable, dynamically imported so it is code-split): simulation report (assumptions, KPIs, 2 charts drawn with primitives, analyst insights, segments, monthly table) and comparison report. Built-in PDF fonts lack ₹/−/≈ so `pdfSafe()` maps ₹ -> "Rs". `components/ExportButtons.tsx` on Simulation, Comparison, Sensitivity.
- **Web worker**: `lib/optimizer.worker.ts` (entry; protocol `{config}` -> `progress|result|error`), `lib/optimizerClient.ts` `startOptimizer()` (worker, falls back to main thread if `Worker` missing; `cancel()` terminates the worker). UI has Cancel button; worker is terminated on unmount. Browser-verified: main-thread worst timer gap 25ms during a 4s search.
- `allocations`/`rebalance` moved from ConfigView to `lib/allocation.ts` for testability.
- Removed `scripts/verify-model.ts` (superseded by tests).

## Ideas / not done
- Per-patient/physician detail tables beyond the 12-row physician sample; multi-seed confidence bands; run sensitivity sweeps in the worker too; component/UI tests (jsdom/Playwright in repo); PDF charts are simple primitives (no axis titles beyond 'month').

## Change log
- 2026-09-19 — Phase 0: created CLAUDE.md with phased plan.
- 2026-09-19 — Phase 1: types, rng, defaults/presets, population generators.
- 2026-09-19 — Phase 2: financial model + simulation engine; calibrated to sane outputs (see Architecture); verify script passes (27 checks).
- 2026-09-19 — Phase 3: store, format/metrics helpers, UI primitives, AppShell (sidebar/header/status/save dialog/toast), ConfigView, OverviewView; view stubs for later phases. `next build` green.
- 2026-09-19 — Phase 4: Simulation dashboard with playback, KPIs, charts, funnel, efficiency table. Visually verified via headless Chrome screenshot.
- 2026-09-19 — Phases 5-6: SegmentsView, tradeoffs lib, CompareView.
- 2026-09-19 — Phase 7: sensitivity + optimizer libs and view; recalibrated physician/patient doctor-influence coefficients; added reps regression check to verify.
- 2026-09-19 — Phase 8: rule-based AI Strategy Analyst (with what-if probes) + Methodology page.
- 2026-09-19 — Phase 9: end-to-end browser QA, tie tolerance in comparison leaders, mobile header, favicon. All phases complete; `next build` and `npm run verify` green.
- 2026-09-19 — Phase 10: Vitest suite (104 tests) replacing verify script; CSV + PDF export on Simulation/Comparison/Sensitivity; optimizer moved to a Web Worker with Cancel and main-thread fallback. Browser-verified downloads and worker responsiveness.
