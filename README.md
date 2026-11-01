# Planet Lab

Same experiment. Different world. A browser physics workbench for Earth, the Moon, and Mars.

Run a controlled rover launch, throw a projectile, measure a pendulum, or calculate reference drag in a wind tunnel. Compare Earth with identical inputs. Measurements come from the simulation; world constants and model assumptions stay visible.

Production: [Planet Lab on Vercel](https://planet-lab-drab.vercel.app). Cloud saves and the assistant still require the Supabase migrations and anonymous sign-in setup.

## Run locally

Node 22.x; pnpm 10.34.9. No cloud keys are needed for the local lab.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3000. If the global pnpm shim fails, use `npx --yes pnpm@10.34.9` in place of `pnpm`.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Install the browser once with `pnpm exec playwright install chromium`. End-to-end tests use the production server. Stop an existing development server first.

## Stack and ownership

Next.js App Router, React, TypeScript, Tailwind, Three.js/React Three Fiber, Rapier, Zustand, Zod. Server adapters use Supabase and OpenAI Responses. Dependencies are locked in `pnpm-lock.yaml`.

Browser owns rendering and fixed-step physics. Domain schemas validate all recipes and assistant commands. Parameter changes invalidate old results. Only recipes persist locally; frame state and credentials do not.

Three GPT-6 Luna agents built simulation, UI, and backend lanes. Codex scaffolded shared contracts, integrated the lanes, reviewed lifecycle/security boundaries, and verified the local application.

## Cloud and AI setup

Copy `.env.example` to `.env.local` and set credentials. See [backend setup](docs/backend-setup.md) and [hosting plan](docs/planet-lab-hosting.md) for migrations, anonymous authentication, quotas, RLS, and deployment. Public environment variables require rebuilding after changes.

Without credentials, AI and cloud saves display unavailable states. Your local lab remains usable. Cloud migrations, two-user RLS isolation and live OpenAI calls require separate verification; mocked tests do not establish those gates. Vercel production uses the explicit Next.js preset in `vercel.json`; `.vercelignore` excludes local credential files from deployment uploads.

## Model limits

Gravity is a constant local reference. Atmosphere is one reference state per world. Rover is a controlled rigid-body launch; suspension, tire grip, and drivetrain are not solved. Projectile uses fixed dimensions and optional reference drag. Pendulum has a fixed pivot and slight damping. Wind tunnel uses the drag equation and fixed coefficients; flow streaks are illustrative. This is an educational model, not an engineering certification tool.

Assets are authored procedural meshes; see [credits](public/assets/credits.json). No remote model download is required during a run.

## Project documents

- [Build plan](PLAN.md), [UI specification](DESIGN.md), [feature and physics scope](docs/planet-lab-product.md)
- [Contracts](docs/planet-lab-contracts.md), [implementation handoff](docs/build-contract.md), [agent lanes](docs/planet-lab-agents.md)
- [Verification evidence](docs/verification.md), [90-second demo script](docs/demo-script.md)
- [Hackathon brief](HACKATHON.md), [shared agent instructions](AGENTS.md), [taskboard](agent-coordination/taskboard.md)

Hackathon project bootstrapped with `hackathon-init`. After cloning, enable the repository's taskboard and push hooks with `./scripts/agent-taskboard.sh setup`.
