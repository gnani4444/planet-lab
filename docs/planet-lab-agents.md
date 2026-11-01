# Planet Lab — agent handoffs

User starts agents later. This document starts none.
One foundation gate, then four ownership lanes. One integration owner. One production deploy owner.

## Before any lane

- Read `../AGENTS.md`. Run taskboard context using your actual executor name.
- Take over matching unfinished work. Otherwise register your scoped task.
- Fill task plan. Checkpoint working state and next action.
- Read `../PLAN.md`, `../DESIGN.md`, product, contracts, hosting.
- Respect existing work. No taskboard hand edits, secret commits, force pushes, or unowned lockfile changes.
- Roles below are ownership labels, not permission to break the host's prescribed taskboard identity.
- Multiple agents sharing one executor identity need coordinator-managed task ownership; never overwrite each other's active record.

## Gate 0 — foundation before parallel edits

Integrator does this first:

1. Inspect current tree; plan assumes no existing application. Reuse compatible code if another agent already scaffolded.
2. Scaffold Next.js/TypeScript/Tailwind and pnpm scripts. Install agreed compatible dependencies once; commit lockfile.
3. Create domain schemas, typed fixture, metric registry, store, dispatcher, and simulation adapter boundary.
4. Create route/page placeholders; empty public module exports for simulation and persistence.
5. Add `.env.example`; ignore secrets and build output.
6. Render workbench frame with fixture values clearly labelled development fixtures.
7. Prove `pnpm typecheck` and `pnpm build` pass. Record actual runtime/package versions.
8. Announce frozen exports and working commit. Only then open B/C/D lanes.

Fixture is a development seam. Remove fixture telemetry from production paths before release.
Coordinate shared-file changes explicitly after freeze.

## Ownership

| Lane | Owns | Does not edit |
| --- | --- | --- |
| A — foundation/integration | root package/config/lockfile; `src/domain/**`; `src/state/**`; `src/app` pages/layout; `tests/e2e/**`; final README | B simulation internals, C component internals, D API/migrations without handoff |
| B — 3D/physics | `src/features/simulation/**`; `src/data/**`; `public/assets/**`; `tests/physics/**` | root dependencies, domain schemas, UI panels, API |
| C — UI | `src/components/lab/**`; `src/components/ui/**`; `src/app/globals.css` after foundation handoff; `tests/ui/**` | simulation internals, domain schemas, API, migrations |
| D — backend/hosting | `src/app/api/**`; `src/lib/server/**`; `src/lib/supabase/**`; `src/lib/persistence/**`; `supabase/**`; `tests/server/**`; deployment config | UI, physics, root dependency lock without coordinator approval |

A owns shared planning docs. C may propose DESIGN.md changes through A.
No two agents edit package.json, lockfile, schemas, or globals.css concurrently.
Same checkout: follow scopes. Separate worktrees: merge through A. Do not create worktrees merely because this document mentions them.

## Prompt A — foundation and integration

> Build Planet Lab foundation, then integrate other lanes. Read PLAN.md and linked specs first. Follow AGENTS.md taskboard rules. Complete Gate 0 before parallel work. Own root configs, dependencies, schemas, state, page composition, and end-to-end tests. Freeze contract exports and checkpoint the working commit. Wire components through documented adapters; do not rewrite another lane's internals without handoff. Keep app buildable. Prove local journey, cloud journey, AI journey, and release checks separately. Finish README, demo script, and Codex contribution. No P1 work before F01–F11 pass. Report shipped IDs, tests, known limits, and deployment status.

Deliverables: runnable scaffold; frozen schemas; integrated app; meaningful journey tests; README; ≤90-second demo script.

## Prompt B — 3D and physics

> Build Planet Lab's 3D and physics lane after Gate 0. Read PLAN.md, DESIGN.md, product, and contracts. Own simulation, world/activity data, assets, and physics tests. Implement rover controlled launch first, then projectile, pendulum, wind tunnel. Use fixed-step Rapier and independent reference equations. Export SimulationView and its handle exactly as contracted. Provide honest measured metrics, aligned Earth comparison, reset/step, asset fallback, and bounded telemetry. Curate planetary constants with sources and reference conditions. Render attractive world-specific terrain and lighting. Record asset licenses. Keep wheel motion and illustrative airflow clearly distinguished from solved physics. Never edit UI panels, frozen schemas, or lockfile without coordination.

Deliverables: all four rigs; world presets; fallback rover; data/asset manifest; reference checks; performance observations.

## Prompt C — workbench UI

> Build Planet Lab's scene-first workbench after Gate 0. Read DESIGN.md, PLAN.md, product, and contracts. Own lab/UI components and globals.css after foundation handoff. Use frozen schemas/store/adapters. Implement activity/world choice, parameter inspector, Run/Pause/Step/Reset, measurement strip, charts, comparison layout, assistant dock, saved drawer, and assumptions. Values come from registries or measured telemetry. Design loading, empty, stale, error, offline/cloud-unavailable, and mobile states. Keep the 3D scene dominant. Use keyboard-accessible controls, visible units, focus states, and reduced motion. Inspect real browser at specified widths. Never substitute fake scientific data or edit physics/API internals.

Deliverables: complete responsive controls; actual-data rendering; accessible states; screenshots; UI checks.

## Prompt D — Supabase, AI, and hosting

> Build Planet Lab backend/hosting after Gate 0. Read hosting and contracts plus PLAN.md. Own API routes, server helpers, Supabase clients/migrations, persistence adapter, and server tests. Implement guest-owned experiment saves with RLS, verified Bearer auth, durable quota/idempotency reservation, and bounded OpenAI structured outputs. Keep secret keys server-only. Use new Supabase publishable/secret formats. Provide setup instructions when project credentials are absent; continue credential-free work. Create a Vercel preview only when a configured authorized project is available. Verify deployed asset loading and API env. Production promotion waits for integrator release gates. No paid plan, account change, destructive migration, or P1 share/voice work by default.

Deliverables: migrations and grants/RLS; persistence adapter; assistant route; isolation/quota tests; env/setup/deployment notes.

## Integration gates

| Gate | Evidence | Owner |
| --- | --- | --- |
| G0 | Frozen schema/adapter; app builds | A |
| G1 | Rover works with real physics; UI controls through dispatcher | A+B+C |
| G2 | Four activities; sourced worlds; comparison; reference checks | B+A |
| G3 | Cloud save/reload; two-user isolation; AI auth/quota/timeout checks | D+A |
| G4 | Preview complete journey; responsive/browser QA; no secret leak | A+C+D |
| G5 | Public production URL; README; credits; demo video; submission | A, with D deploying |

No gate inferred from agent confidence. Require working evidence.
Migrations tested before production. A reviews dependency changes; D alone changes deployment settings.

## Verification commands — scaffold must supply

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Run focused tests during development. Full gates once integrated, then repeat only after material changes/failures.
Supabase-dependent checks require local/test project; mark unavailable checks unverified, never passed.
Release checks include direct RLS attacks, concurrent quota requests, reset/revision races, and invalid AI commands.

## Demo script

1. Show rover ready on Mars. Run at fixed launch conditions.
2. Compare Earth. Point to measured airtime/range and matched inputs.
3. Switch to wind tunnel. Compare same object in Earth air and Moon vacuum approximation.
4. Ask AI why results differ. Show explanation linked to measured values.
5. Save recipe; reload. State today's build and concrete Codex contribution.

Record only working features. Keep local backup. Explain any recorded segment during live failure.

## Handoff format

```text
Owned paths:
Feature IDs shipped:
Exports/contracts changed:
Checks run and results:
External setup still required:
Known limits:
Working commit:
Next integration action:
```
