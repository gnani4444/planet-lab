# Planet Lab verification

Verified November 1, 2026, on Node 22.16.0 with pnpm 10.34.9. This is evidence for the local application, not a cloud release certificate.

## Latest assistant release — November 1, 16:56 London

This section supersedes the older cloud and assistant status recorded below. Ask now uses the server OpenAI key directly, with no sign-in, guest identity or Supabase dependency. Supabase is optional for saved recipes.

- Production build, ESLint and TypeScript passed; 47 unit tests and 22 production-browser journeys passed. The new browser check deliberately disables Supabase Auth and still completes chat, bounded follow-up history and readable expansion. Proposal application and clearing an in-flight response also pass.
- The latest live evaluation catalog contains 24 passing case IDs: 22 real OpenAI chat requests and two live database checks. A focused rerun verified the selected zero-restitution bounce prompt after the inaccurate decimal candidate was rejected. Scientific review corrected a free-fall comparison; raw evidence is linked in the assistant evaluation report.
- Supabase tables, validators, owner RLS and privileged quota functions were installed transactionally. Approved anonymous sign-in is enabled for cloud saves. Live owner isolation, public access denial, save/load and quota concurrency checks passed. These quota functions are retained in the schema but are not dependencies of public Ask.
- A real browser Mars/Earth run measured 1.91 s versus 0.77 s airtime and 13.82 m versus 5.56 m range. A genuine no-sign-in OpenAI answer displayed matching snapshot metrics. Actual screenshots are committed under docs/screenshots/.
- A narrated actual-product walkthrough is public/demo.mp4, 65.91 seconds, 2.4 MB. It combines real browser recording with held views of the working app, uses local system narration, and contains no slides or secret values.
- Production deployment dpl_GqYLdLTCbHbEV669Xgj9vpQVc1WG serves the updated public Ask route. A final media deployment follows.

## Earlier verification history

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

No Git remote is configured, so commits remain local; Vercel production was deployed directly through its authenticated CLI. Supabase and OpenAI environment values are configured locally and in Vercel production. Local SQL regression checks and public simulator checks passed, as detailed below. Live Supabase schema/authentication setup, two-user RLS attacks, concurrent durable quota reservations and real OpenAI structured output/usage remain unverified.

F01–F08 and local F10 are implemented and locally exercised. F09 and cloud F10 have code and mocked boundary coverage; they require live service setup. F11 public hosting is verified; full cloud release gates remain open. P1 features remain deferred.

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

## Local run and Vercel production — 2026-11-01

- Local production server: `http://localhost:3000`, rebuilt with `.env.local`; production build passed.
- Four simulator browser journeys passed against the new build. The credential-absent mobile test was excluded because credentials are now configured; a separate 390×844 mobile check passed layout, physics stepping and unauthenticated assistant rejection with no page errors.
- Production: [planet-lab-drab.vercel.app](https://planet-lab-drab.vercel.app). Deployment `dpl_5jqvKuv4ibjE7VxaARaf3RsCyhaj`, source commit `642c630`.
- Explicit `framework: nextjs` in `vercel.json` fixes the initial project's Other preset serving only `public/` and returning 404. Node is pinned to `22.x` to match local validation. `.vercelignore` excludes local credential files and development artifacts.
- All six environment names from `.env.example` are configured for production; the canonical app URL points to the production alias. OpenAI and Supabase secret values are sensitive environment variables, passed through stdin without printing them.
- Clean browser: `/` and `/lab` returned HTTP 200 without a Vercel login. A rover run measured Mars range of 13.82 m; Earth comparison rendered measured results. Desktop 1440×900 and mobile 390×844 checks passed, with no browser errors or failed script/style assets.
- `/api/assistant` GET returned HTTP 200; this checks configuration presence only. A POST without authentication returned HTTP 401. No paid provider request was sent.
- Both the local browser bundle and fetched production JavaScript were scanned for the configured OpenAI and Supabase secret values; no matches were found.
- Production screenshot: `planet-lab-production.png` in the chat's visualization artifacts. Cloud save and AI remain dependent on the Supabase setup described above. No preview deployment or live cloud release is claimed.

## Expanded worlds, activities and physics — 2026-11-01

- Six worlds: Earth, Moon, Mars, Mercury, Venus and Titan. The added reference states are sourced in `docs/world-reference-states.md`.
- Six activities: rover, projectile, pendulum, wind tunnel, free fall and first rebound. Strict recipes, controls, local recovery, Earth comparisons, summaries and assistant schemas include both new activities.
- Physics model `planet-lab-local-physics-1.1`: shared symmetric gravity/exact quadratic-drag motion avoids velocity reversal and stiff-launch displacement bias. Rapier retains collision detection; the requested bounce restitution uses Max combination against a zero-restitution floor. First/second contact phases and unresolved tiny rebounds terminate correctly. Timeouts omit completed-flight/impact metrics.
- Production build and ESLint passed. All 45 unit tests passed, including nine physics audit cases. An independent RK4 launch oracle converged when its step was halved; the model's time, range and impact speed were within 1% for that reference case.
- All 19 Playwright browser journeys passed in 56.6 s. Actual Rapier checks cover vacuum free fall on all six worlds (time within 0.025 s, speed within 3%); Mercury rebound coefficients 0, 0.01, 0.7 and 0.95 (height within 0.045 m and energy within 1.6 percentage points); a minimum-mass Venus drop (time/speed within 3.5%); a fast Venus launch against the independent RK4 reference with display-rounding allowances; Titan/Earth comparison; recovery; mobile controls; and the original simulator journeys.
- The mobile cloud-outage test now intercepts its service requests, so it is deterministic with configured local credentials and does not create a live cloud session.
- The third additive SQL migration and both rollback-only regression files passed in local PGlite with the Auth stub. Existing owner isolation and privileged quota permissions are preserved. No live database migration was applied in this feature update.
- The final local browser bundle was scanned for configured OpenAI and Supabase secret values: no matches.
- Approximation boundaries remain visible: fixed reference atmosphere and drag coefficients; no CFD, heat, buoyancy or material-survival model. Tiny rebounds below the solver's temporal resolution can measure zero retained height.

Expanded production deployment: [planet-lab-drab.vercel.app](https://planet-lab-drab.vercel.app), deployment `dpl_DPW4LYG4gZVDzTPJx1KThvDmAVYg`, source commit `8621094`. Vercel build passed and the production alias was verified without a login.

The live browser confirmed six world choices and six activities. Mercury's 2 m vacuum drop measured 1.04 s; Titan's default first rebound measured 1.48 m; the Venus launch reference measured 3.03 s, 0.24 m range and 0.76 m/s impact speed. All passed the same documented reference bounds. `/lab` returned 200 and an unauthenticated assistant POST returned 401. Mobile layout fit the viewport, no page errors or failed script/style requests occurred, and fetched JavaScript contained no configured secret values. Desktop and mobile captures were visually inspected.

A fresh read-only Supabase check still returned 404 for both app tables and reported anonymous sign-in disabled. All three migrations and Auth setup remain necessary for cloud saves and AI; this deployment does not claim those features are operational.

## Public release and official submission — November 1, 16:58 London

Public repository: https://github.com/gnani4444/planet-lab, source commit 03d3ffd. Final production deployment dpl_H4i8padBxJ1PAQm1svM86rpFh8Qw serves https://planet-lab-drab.vercel.app. Anonymous HTTP checks returned 200 for the repo and the demo video; the MP4 is 2,390,797 bytes with video/mp4 MIME type. A real production POST without any authentication returned a grounded OpenAI explanation and actual token counts. Configured server secrets were absent from tracked source and all 275 scanned history blobs.

The official portal linked from the current Notion Builders Guide confirmed “Submitted, waiting for judging” at 16:58 London, before the 17:00 deadline. The entry includes the public repository, README screenshots, live Vercel URL, and 65.91-second narrated product video. Presenter contact details and the private status URL are excluded from this repository. The submission receipt remains local.

## Guided feature tour — November 1, after submission

Added an eleven-step first-visit tour with native dialog semantics, a feature spotlight, Back/Next, Skip, Escape, arrow navigation and a replay action. It covers activities, world selection, setup, run controls, measurements, Earth comparison, OpenAI, saved experiments, camera controls and settings. Completing or dismissing it is remembered in local browser storage. The tour changes only which mobile panel is visible and restores the original panel, page position and keyboard focus when closed.

The production build and lint passed; all 47 unit tests passed. Four focused browser checks cover first visit/dismissal/replay, a complete tour preserving a non-default recipe and issuing no AI/cloud POST requests, 390×844 reduced-motion navigation with panel restoration, and the 800×768 activity menu remaining reachable. All 26 browser journeys passed, including existing physics, assistant and mobile flows. The real Chrome walkthrough was inspected on desktop, tablet and mobile; a crowded tablet header was corrected before release. The README includes the actual tour screenshot.

The 21st catalog search required an unavailable login, so the tour reuses existing native dialog behavior and workbench tokens without adding a dependency. Local design review completed with informational color-token notices; no deterministic behavior fixes were required. Existing unrelated source and event-document changes were preserved.
