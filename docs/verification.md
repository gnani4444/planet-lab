# Planet Lab verification

Verified November 1, 2026, on Node 22.16.0 with pnpm 10.34.9. This is evidence for the local application, not a cloud release certificate.

## Automated gates

| Check | Result |
| --- | --- |
| Frozen offline dependency install | Passed; lockfile unchanged |
| ESLint | Passed without warnings |
| TypeScript | Passed |
| Vitest | 35 tests passed in five files |
| Next.js production build | Passed; `/`, `/lab`, `/api/assistant` present |
| Playwright against a separate production server | Five journeys passed in 29.8 seconds |
| Impeccable mechanical detector | No findings |
| Responsive app inspection | Zero failures at 1440×900, 1024×768, 390×844; two documented warnings |

Browser journeys exercise the actual Rapier runtime. They verify default Mars rover airtime/range against an independent ballistic equation within 2%, matched Earth comparison, reset/stale-result handling, projectile flight, a 5° Earth pendulum period within 3%, zero Moon aerodynamic drag, local recovery after refresh, mobile controls, reduced motion, guest-save unavailability, zero-speed release clearance, invalid numeric input, rerunning a completed recipe, and genuine WebGL failure with a labelled reference fallback.

Unit tests cover strict recipes and commands, finite/ranged inputs, revision invalidation, comparison completion, bounded telemetry, growing 3D trajectory buffers, local draft recovery/backup, reference physics, assistant/auth/timeout/idempotency boundaries, and single-flight guest authentication. Additional browser checks passed for keyboard Run/Pause/Reset, the input hotkey guard, offline simulation after loading, and mobile arrow-key tab navigation. Server tests use mocks. They do not execute PostgreSQL policies or call OpenAI.

## Scientific model limits

- Local gravity is constant; atmospheric density is a versioned reference condition.
- Rover uses a cuboid chassis collision proxy. Its wheels, suspension and drivetrain do not supply contact or propulsion physics.
- Projectile geometry and drag coefficients are fixed approximations. Launch/peak heights refer to collision-proxy ground clearance; plotted positions are body centres.
- Pendulum is a rigid bob constrained to a fixed pivot with small damping. Automatic sleeping is disabled so small oscillations continue through measured crossings.
- Wind drag is calculated from `q = ½ρv²`, `F = qCdA`. Airflow streaks are illustrative.
- Comparison uses independent Rapier worlds and a shared fixed-tick clock in a shared visual backdrop. It is not a pair of independent planetary sky renderings.
- Flight runs stop at contact or 30 simulated seconds. A timeout does not invent an impact measurement.

## Visual review

Screenshots and machine report are in the ignored `.taste-skill/release/` folder. All fold and page sheets were inspected.

ROUND 1
Seen in one second: a scientific workbench with a distant rover.
Idea (one sentence): keep the experiment constant and change its world.
Live thing: a user-controlled rigid-body experiment with measured trajectories.
Layout words by section: header=toolbar / scene=canvas / setup=inspector / results=readout.
Scores: design 5.5 · usability 6 · creativity 7 · content 7 → overall 6.1.
Caps applied: crowded lower controls and overlapping labels.
Top three problems: tiny activity previews, excessive empty sky around the rig, and crowded bottom panels. These were corrected by changing the preview grid, camera/ground framing, and dock height.

ROUND 2
Seen in one second: a rover on Mars, with setup controls and Run available.
Idea (one sentence): the same experiment produces a measurable difference on another world.
Live thing: four working experiments and Earth comparison.
Layout words by section: header=toolbar / scene=canvas / setup=inspector / results=readout.
Scores: design 7 · usability 8 · creativity 7 · content 8 → overall 7.4.
Caps applied: none from the app-screen inspection.
Remaining visual limits: deliberately simple procedural terrain, dense secondary metadata, and internal scrolling for long control panels. These are not represented as award-level graphics.

The colour-sprawl warning is expected: natural Mars terrain occupies the dominant 3D scene, as DESIGN.md requires. Chrome remains neutral. The small-text warning reflects 12px units, assumptions and secondary labels; primary numeric inputs and data labels are 13–14px or larger. No visual inspection failure remains.

## External gates still open

No Git remote is configured, so commits remain local. Supabase and OpenAI environment variables are absent. No matching linked Vercel project exists. The migration has been statically reviewed but has not been applied to a database. Two-user RLS attacks, concurrent durable quota reservations, real OpenAI structured output/usage, and deployed asset loading remain unverified.

F01–F08 and local F10 are implemented and locally exercised. F09 and cloud F10 have code and mocked boundary coverage; they require live service configuration. F11 is pending. P1 features remain deferred.

An approximately 29-second silent local browser capture exists beside the chat artifacts as `planet-lab-demo.webm`. It shows working rover comparison, Moon wind drag, and pendulum measurements. It is not a narrated submission video, public deployment, or hackathon submission.

## Database follow-up

Reproduced a real `permission denied for function planet_lab_recipe_is_valid` error during an authenticated insert. Added a second, additive migration granting execution of the two pure validators to authenticated writers and the backend role. Ownership RLS and quota RPC permissions are unchanged.

Both migrations and `supabase/tests/recipe_permissions.sql` were executed in a temporary PGlite 0.5.14 PostgreSQL runtime with Supabase Auth stubbed. Valid owner saves, constraint rejection, owner isolation and privileged quota denial passed. The 17 server tests also passed. This improves the earlier static-only SQL check; it does not establish live Supabase Auth or multi-session concurrency verification.

## Live Supabase connection check — 2026-11-01

Read `.env.local` without printing credential values and performed read-only HTTPS checks against the configured Supabase project.

- Publishable key: Auth settings endpoint returned HTTP 200.
- Secret key: backend Auth admin endpoint and REST schema endpoint returned HTTP 200. The backend key is a secret key; the browser key is a distinct publishable key.
- Schema unavailable: both `experiments` and `ai_usage` returned HTTP 404 / `PGRST205` for backend and unauthenticated browser requests. Neither table nor the four expected validator/quota functions appeared in the backend API schema. This establishes API absence, not a direct PostgreSQL catalog inspection.
- Anonymous sign-in: Auth settings reported `external.anonymous_users = false`.
- Owner isolation and quota behavior could not be verified live because the expected schema was unavailable. OpenAI was not called, and no live records were changed.

Next: apply both SQL migrations in filename order, enable anonymous sign-in, then run the live save and isolation checks.
