# Planet Lab — contracts and architecture

Contract version: 1. Foundation owner translates these types into Zod schemas and TypeScript exports before parallel work.
Freeze exports after Gate 0. Other agents request changes; never fork competing schemas.

## Runtime ownership

| Layer | Owns | Never owns |
| --- | --- | --- |
| Browser UI | Controls, layout, accessible input, local draft | Secret keys, authoritative AI billing |
| Simulation | Forces, body transforms, fixed steps, measurements | Network calls, database writes |
| Domain | IDs, schemas, ranges, metric definitions | React, Three.js, Supabase clients |
| Vercel API | Auth validation, quotas, OpenAI calls, share lookup | Persistent physics loop |
| Supabase | User identity, saved recipes, quotas, usage | Frame-by-frame scene state |

Flow: user input → validated command → store → simulation → measured summary → UI/AI explanation.
World data and physical parameters come from registries, not model-generated constants.

## Domain exports

```ts
export type WorldId = 'earth' | 'moon' | 'mars';
export type ActivityId = 'rover-ramp' | 'projectile' | 'pendulum' | 'wind-tunnel';
export type Vec3 = readonly [number, number, number];

export type ParamsByActivity = {
  'rover-ramp': { launchSpeedMps: number; launchAngleDeg: number };
  projectile: {
    objectId: 'sphere' | 'brick';
    massKg: number;
    speedMps: number;
    angleDeg: number;
    releaseHeightM: number;
    dragEnabled: boolean;
  };
  pendulum: { lengthM: number; bobMassKg: number; initialAngleDeg: number };
  'wind-tunnel': {
    objectId: 'sphere' | 'plate';
    windSpeedMps: number;
    areaM2: number;
  };
};

export type ExperimentRecipe = {
  [K in ActivityId]: {
    schemaVersion: 1;
    activityId: K;
    worldId: WorldId;
    seed: number;
    params: ParamsByActivity[K];
  }
}[ActivityId];

export type LabCommand =
  | { type: 'configure'; recipe: ExperimentRecipe; run: boolean }
  | { type: 'control'; action: 'run' | 'pause' | 'reset' | 'compare' };

export type RunStatus = 'loading' | 'ready' | 'running' | 'paused' | 'completed' | 'error';
export type MetricId =
  | 'flightTimeS' | 'rangeM' | 'peakHeightM' | 'impactSpeedMps'
  | 'periodS' | 'dragN' | 'dynamicPressurePa';

export type TelemetrySample = {
  timeS: number;
  positionM: Vec3;
  velocityMps: Vec3;
  dragN: number | null;
  angleRad: number | null;
};

export type RunSummary = {
  runId: string;
  revision: number;
  recipe: ExperimentRecipe;
  modelVersion: string;
  elapsedS: number;
  termination: 'contact' | 'cycles' | 'timeout' | 'manual';
  metrics: Partial<Record<MetricId, number>>;
  assumptions: string[];
};
```

All physical values use SI units. World up: +Y. Launch direction: +X. No degrees inside force calculations.
Schemas reject unknown fields, NaN, Infinity, invalid IDs, and out-of-range numbers.
Ranges: product spec. Seed: integer 0–2³²−1. UUIDs: validated where IDs are required.
Metric units/display precision live in one registry. Missing metric remains absent.

`WorldDefinition`: id, name, gravityMps2, gasDensityKgM3, referenceTemperatureK, referencePressurePa, sourceUrls, conditions, visualPreset.
`ActivityDefinition`: id, name, parameter descriptors, defaults, metric IDs, duration limit, assumptions, asset IDs.
`AssetDefinition`: id, URL, license, author/source, dimensions, collision proxy, fallback.
Client never supplies custom asset URLs to AI/server in launch scope.

## Simulation interface

`src/features/simulation/index.ts` exports:

```ts
export type SimulationViewProps = {
  recipe: ExperimentRecipe;
  revision: number;
  comparison: boolean;
  quality: 'low' | 'high';
  onStatus: (status: RunStatus) => void;
  onSample: (sample: TelemetrySample, worldId: WorldId) => void;
  onComplete: (summary: RunSummary) => void;
  onError: (message: string) => void;
};

export type SimulationHandle = {
  run(): void;
  pause(): void;
  reset(): void;
  step(): void;
  resetCamera(): void;
};
```

Export `SimulationView` through a ref-compatible React component exposing `SimulationHandle`.
Integrate inside a client component; lazy-load Canvas/WASM. Do not run Three.js during server rendering.
Callbacks include revision/run identity through summary and active adapter context; discard obsolete callbacks after remount.
Physics step: 1/60 second. Cap catch-up work; tab hidden pauses rather than advancing minutes on return.
Physics state stays in engine refs. UI publishes telemetry ≤10 Hz; store bounded samples, not every rendered frame.
Comparison advances both worlds with equal tick counts. Render quality never changes physical constants.
Store immutable completed summaries. Pure reference functions stay independent from rendering.

## Store contract

`src/state/lab-store.ts` owns recipe, revision, run status, selected result, comparison state, panel state, errors.
Comparison results/samples are keyed by world ID. Complete comparison only after both world runs finish.
Bind callbacks to the current adapter generation/revision. Late callbacks from an old scene must be ignored.
Actions: configure, selectWorld, selectActivity, run, pause, reset, step, setComparison, acceptSummary.
All commands pass one dispatcher. Buttons and AI use the same dispatcher.
Recipe changes, reset, and new run increment revision. Physics frames do not.
Parameter edits keep last valid value until validation succeeds. Stale results never become current.
Persist only validated recipe/preferences locally. No API keys or raw audio.

## AI API

`POST /api/assistant`, Node runtime. HTTP JSON for launch scope.

Request:

```ts
type AssistantRequest = {
  requestId: string; // UUID; idempotency key
  revision: number;
  operation: 'command' | 'explain';
  input: string;
  recipe: ExperimentRecipe;
  summary?: RunSummary;
  referenceSummary?: RunSummary; // Earth baseline for comparison explanations
};

type AssistantResult =
  | { kind: 'command'; command: LabCommand }
  | { kind: 'clarify'; text: string }
  | { kind: 'unsupported'; text: string }
  | { kind: 'explanation'; text: string; metricRefs: MetricId[] };

type AssistantResponse = {
  requestId: string;
  basedOnRevision: number;
  result: AssistantResult;
};
```

Strict schema lives in `src/domain/assistant.ts`. Generate compatible JSON schema; keep union inside an object envelope.
Use Responses Structured Outputs for this bounded planner. Full agent/tool loop is unnecessary for launch.
Server validates input, rebuilds trusted world/model context, calls model, validates result, returns command proposal.
Client checks revision, validates again, dispatches once. Response receipt does not imply execution succeeded.
`explain` cannot return commands. Render authoritative numbers from metricRefs, not invented text values.
Completed summary is client-computed; treat as untrusted explanatory input, never proof for rewards or billing.
For comparison explanation, validate matching activity/parameters and an Earth reference; missing baseline cannot support numeric comparison.

Limits: request ≤32 KB; input ≤500 characters; no telemetry arrays; ≤8k input-token budget; max 800 billed output tokens.
Server enforces model output cap and input budget; time out provider call after 15 seconds.
Authenticate Bearer token through Supabase Auth. Derive user ID from verified token, never request body.
Reserve durable quota before provider call. Same requestId cannot trigger duplicate provider requests during retry.
No process-memory-only limiter. No cross-request state assumed in Vercel Functions.
Return typed errors: 400 invalid request, 401 invalid session, 409 duplicate/in-progress, 429 quota, 503 unavailable, 504 timeout.
Never expose stack traces, provider secrets, or raw private prompts in responses.

## Persistence interface

`src/lib/persistence/experiments.ts` exports saveExperiment, listExperiments, loadExperiment, deleteExperiment.
Inputs/outputs use shared schemas. Return explicit success/error; never swallow failed writes.
Supabase clients live under `src/lib/supabase/`. Secret client is server-only and never imported by UI.
Browser saves with authenticated user session and RLS. No privileged write needed for ordinary saved recipes.

P1: createShare, revokeShare, resolveShare. Snapshot is immutable; token handling follows hosting spec.

## File map

```text
src/app/                       routes; global styles; API entry points
src/components/lab/            workbench controls and panels
src/components/ui/             accessible primitives
src/domain/                    frozen schemas/types; metric definitions
src/state/                     UI/configuration store; dispatcher
src/data/                      worlds; activities; assets; reference conditions
src/features/simulation/       Canvas; rigs; physics; telemetry; pure equations
src/lib/persistence/            cloud save adapter
src/lib/supabase/               browser/user/server-only clients
src/lib/server/                 auth; quotas; OpenAI; server helpers
public/assets/                 licensed GLB/textures; credits manifest
supabase/migrations/           reviewed schema, grants, RLS, quota functions
tests/physics/                 independent reference checks
tests/ui/                      control/state checks
tests/server/                  auth, quotas, API/schema checks
tests/e2e/                     integration journeys
```

No implementation files exist yet. File map specifies future ownership, not current repository contents.

Reference: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Next.js client-only loading](https://nextjs.org/docs/app/guides/lazy-loading).

## November 1 amendment — public Ask

The implemented assistant now requires only the server OpenAI key, per the user's no-sign-in requirement. It accepts no required bearer identity and has no Supabase quota dependency. Earlier authenticated-assistant requirements above are superseded for Ask; owner authentication and RLS still apply to optional cloud saves. Requests optionally carry up to six user/assistant history messages of at most 1,000 characters each. Command results include rationale text and require an explicit Apply action. Responses optionally include actual input/output token counts. HTTP errors are 400 for invalid requests/input budgets, 503 for unavailable/invalid provider output, and 504 for timeouts.
