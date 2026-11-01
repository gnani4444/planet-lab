# Gate 0 build handoff

Coordinator owns taskboard task 20261101T142518Z-codex-build-planet-lab-application-from-approved-plan-14680.
Agents do not start/take over taskboard records or commit shared work. Send coordinator checkpoints.

## Frozen exports
- `@/domain`: all schemas/types/defaults/METRICS in experiment.ts, assistant.ts, persistence.ts.
- `@/state/lab-store`: useLabStore, restoreDraft, persistDraft, DRAFT_KEY. Inspect source for full actions/state.
- `@/features/simulation`: SimulationView, SimulationHandle, SimulationViewProps, exact planning interface.
- B creates `@/data`: WORLDS as Record<WorldId,WorldDefinition>, ACTIVITIES as Record<ActivityId,ActivityDefinition>.
- C exports `LabShell` from `src/components/lab/lab-shell.tsx`, receives `{children: ReactNode; onResetCamera?: () => void}`.
- D exports `saveExperiment({title,recipe})`, `listExperiments()`, `loadExperiment(id)`, `deleteExperiment(id)` from `@/lib/persistence/experiments`.
  All asynchronous, return Result<T>. T respectively SavedExperiment, SavedExperiment[], SavedExperiment, null.
- D exports `cloudConfigured(): boolean`, `getAccessToken(): Promise<Result<string>>` from `@/lib/supabase/browser`.
- D supplies GET /api/assistant returning `{available:boolean, reason?:string}` without auth, no secrets.
- D supplies POST /api/assistant using shared schemas, bearer auth, typed errors `{error: string}`.

## Transport integration
Coordinator mounts SimulationView keyed by recipe revision. Calls handle when store.transport.sequence changes.
A run or step may arrive during asynchronous WASM loading: B queues desired action until engine ready.
Pause cancels pending run. Reset clears engine state. Resume after pause retains current simulation tick.
Store handles new-run/reset revisions, summary acceptance, bounded samples, and comparison completion.
Simulation should not send completed status before both summaries. onStatus ready must not cancel pending run.
Coordinator binds callbacks to revision/generation and ignores obsolete callbacks.
B publishes telemetry at most 10Hz but must publish step result immediately. Engine refs own frame state.

## Environment
Node 22.16.0. pnpm global shim is broken: use `npx --yes pnpm@10.34.9 <command>` or local npm scripts.
Root owns dependencies and lockfile. Do not modify.
All code is persisted normal English. Agent reports terse caveman; paths, checks, limitations explicit.
