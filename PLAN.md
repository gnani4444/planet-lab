# Planet Lab — build plan

Status: local application implemented. Supabase/OpenAI are unconfigured; public deployment and external release gates remain open.
Style: caveman, per user request. Date: November 1, 2026.

## Product

Choose a world. Run an everyday experiment. Compare Earth. Ask why.

Primary audience: curious players, students, teachers, space enthusiasts.
Primary surface: desktop browser. Mobile gets the same experiments through simpler controls.
Signature: identical experiment, different world, measured difference.

## Read order

1. `AGENTS.md` — shared taskboard rules.
2. This file — decisions, scope, gates.
3. `docs/planet-lab-product.md` — feature IDs, physics scope, acceptance.
4. `DESIGN.md` — screens, visual direction, components, states.
5. `docs/planet-lab-contracts.md` — types, ownership, command/API rules.
6. `docs/planet-lab-hosting.md` — Supabase, Vercel, secrets, operations.
7. `docs/planet-lab-agents.md` — agent prompts, boundaries, sequence.

Background: `docs/planet-lab-research.md`. Research lists possibilities; this plan decides build order.
Conflict order: user instruction, `AGENTS.md`, contracts, this plan, detailed specs, research.

## Locked decisions

| Concern | Decision |
| --- | --- |
| App | Next.js App Router, React, TypeScript; stable compatible versions pinned during scaffold |
| Styling | Tailwind CSS; accessible primitives; Lucide icons |
| 3D | Three.js, React Three Fiber, Drei; WebGL2 first |
| Physics | Rapier through react-three-rapier; fixed 60 Hz step |
| State | Zustand; configuration separate from high-frequency physics state |
| Validation | Zod; one shared source for browser, API, persistence |
| Charts | Small SVG plots; numeric table alternative |
| AI | OpenAI Responses, `gpt-6-luna`, strict structured output |
| Hosting | Vercel; application root is this Git repository root |
| Data | Supabase Postgres, Auth; Storage only when screenshot uploads ship |
| Auth UX | Explore immediately; lazy anonymous session for cloud save and AI |
| Persistence | Local draft first; Supabase saved experiments |
| Packages | pnpm; one lockfile; foundation owner controls dependencies |
| Testing | Vitest for physics/contracts; Playwright for full journeys |

No native app, payment system, multiplayer, or specialist solver in launch scope.
No backend physics loop. No AI call per frame. No generated code executed as a simulation.
No new accounts, purchases, provisioning, deployments, or agents started by this planning turn.

## Launch scope

| ID | Feature | Release gate |
| --- | --- | --- |
| F01 | Earth, Moon, Mars presets | World switches change environment and scenery |
| F02 | Rover ramp | Controlled launch; measured airtime and range |
| F03 | Projectile | Sphere/brick; speed, angle, mass, release height |
| F04 | Pendulum | Length, bob mass, initial angle; measured period |
| F05 | Wind tunnel | Sphere/plate; speed, area; calculated drag |
| F06 | Experiment controls | Run, pause, reset, step; orbit/follow camera |
| F07 | Measurements | Live values, trajectory, chart, assumptions |
| F08 | Earth comparison | Same recipe parameters; world is the changed variable |
| F09 | AI commands and explanation | Validated setup; explanation uses measured summary |
| F10 | Local recovery and cloud save | Refresh restores draft; owner can reload saved recipe |
| F11 | Public deployment | Preview works; production passes release gates |

P1: share links, voice, Titan/Venus, screenshots, CSV export, challenge mode, balloons/parachutes.
P2: vehicle drivetrains, prepared engine cutaways, thermal/fluid models, workshop assemblies, custom worlds.
P3: CFD, detailed soil/tire mechanics, combustion, structural analysis, collaboration.

## Build sequence

1. Foundation owner scaffolds app, schemas, fixture, store, route placeholders, and package lock. (Completed; development fixtures removed from runtime.)
2. Freeze contract exports. Open parallel ownership lanes.
3. Scene owner builds one complete rover experiment before additional activities.
4. UI owner builds workbench against fixture/adapter; never invents physics numbers.
5. Backend owner builds Supabase persistence, quotas, AI routes, and deployment setup.
6. Integrator wires adapters. Verify core without network, then cloud, then AI.
7. Deploy preview early. Test preview credentials and asset loading.
8. Freeze scope. Record required video. Promote only after release gates pass.

Remaining event time is limited. Reserve final 45–60 minutes for checks, recording, and submission.
If behind: cut P1, visual effects, extra assets, and AI convenience. Preserve working core experiments.

## Definition of done

- Start experiment within two clicks from `/`.
- Four launch activities work on Earth, Moon, Mars.
- Physics matches independent reference cases within documented tolerance.
- Comparison preserves initial conditions and simulation time.
- Reset restores exact recipe; parameter edits invalidate stale results.
- Core runs without OpenAI or Supabase; unavailable cloud features explain their state.
- Cloud release separately proves save/reload and RLS isolation.
- AI release separately proves actual model calls, validation, timeout handling, and usage logging.
- No fabricated telemetry, fake success, broken enabled controls, or exposed secrets.
- Desktop, narrow layout, keyboard, reduced motion, loading, asset failure, and WebGL failure checked.
- Public repo has setup instructions, asset credits, today's work, and concrete Codex contribution.
- Required video ≤90 seconds; finalist walkthrough ≤2 minutes.

## Stop condition

Stop after release gates pass. Do not expand because spare time remains.
Report shipped feature IDs, deferred IDs, tests, deployment URL, and known model limits.


## Implementation handoff — November 1, 2026

Local build: F01–F08 and local F10 implemented. F09/cloud F10 adapters and migration implemented; external validation awaits credentials. F11 awaits project setup and deployment. P1 remains deferred.

Evidence, known model limits, responsive review, and remaining gates: [verification](docs/verification.md). Run/setup: [README](README.md).
