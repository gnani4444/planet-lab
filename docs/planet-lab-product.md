# Planet Lab — features and physics

Launch scope: F01–F11 from `../PLAN.md`. Broad research is roadmap, not a launch checklist.

## User journey

Open app. Choose activity. Choose world. Adjust a few inputs. Run. Inspect result. Compare Earth. Ask why. Save.
Default: Mars, rover ramp, conservative preset. First load shows a ready scene and Run control.
Explore needs no login. Cloud features establish a guest session when first used.

## F01 — worlds

Bundle versioned reference data. No live NASA request during scene load.
Store source URL, reference conditions, model version, and known simplifications.

| World | Gravity reference | Atmosphere | Scene |
| --- | ---: | --- | --- |
| Earth | 9.80665 m/s², standard reference | Reference near-surface air | Basalt test platform, blue atmospheric horizon |
| Moon | 1.62 m/s², rounded | Vacuum approximation | Grey regolith, sharp shadows, dark sky |
| Mars | 3.71 m/s², rounded | Thin CO2 reference atmosphere | Rust terrain, pale dusty horizon |

Gravity uses local constant acceleration. Gas density is a reference state, not global weather.
Planets remain comparable through a shared test rig. Terrain decoration must not alter contact geometry accidentally.
Sources and atmospheric constants: verify NASA/JPL references before committing fixture data. See `planet-lab-research.md`.

## F02 — rover ramp

- Show recognisable rover, ramp, ground, start marker, scale reference, landing zone.
- Inputs: launch speed 1–20 m/s; launch angle 5–45°.
- Model: controlled release from ramp lip; rigid-body motion, gravity, contact, optional reference drag.
- Wheels spin from forward speed; this animation is cosmetic. No implied drivetrain or tire validation.
- Output: first-contact flight time, horizontal range, peak height, impact speed.
- End run on first landing or 30 simulated seconds.
- Label: "Controlled launch. Suspension and drivetrain not modelled."
- Fallback asset: authored wheel/chassis meshes. Never block physics on remote car download.

## F03 — projectile

- Objects: sphere and brick; explicit dimensions and mass.
- Inputs: mass 0.1–20 kg; speed 0–30 m/s; angle 0–80°; release height 0.5–10 m.
- Drag toggle. Vacuum reference tests disable drag.
- Output: trajectory, flight time, horizontal range, peak height, impact speed.
- Equal-mass and different-mass trials require equal starting conditions.
- Changing mass alone must not change vacuum acceleration.
- End on first ground contact or 30 simulated seconds.

## F04 — pendulum

- Inputs: length 0.5–3 m; bob mass 0.1–10 kg; initial angle 5–30°.
- Model: fixed pivot, rigid bob, constraint, documented small damping.
- Output: angle/time trace and period from repeated crossings.
- Reference: small-angle period `T = 2π sqrt(L/g)`.
- Label larger-angle deviation. Do not claim mass changes ideal period.
- Stop after three full cycles or 45 simulated seconds.

## F05 — wind tunnel

- Objects: sphere and plate. Fixed reference orientation.
- Inputs: wind speed 0–30 m/s; reference area 0.01–1 m².
- Model: restrained object; drag computed from curated coefficient and local reference gas density.
- Output: drag force and dynamic pressure against wind speed.
- Show gas density, coefficient, reference area, and validity assumptions.
- Moon vacuum approximation produces zero aerodynamic force.
- Flow streaks: illustrative overlay. Label "Illustrative airflow"; no fabricated pressure-field colours.
- Sweep is optional P1. Single-speed measurement must work first.

## F06–F08 — controls, results, comparison

- Parameter changes pause/reset scene. Clear stale measurements; retain last result under "Previous run" only when useful.
- Run starts from recipe, not arbitrary leftover body transforms.
- Step advances exactly one physics tick while paused. Slow motion changes playback rate, not force constants.
- Orbit camera always available; follow camera where useful. Reset camera separate from Reset experiment.
- Earth comparison clones recipe, changes only world, runs equal fixed steps, labels both views.
- Compare a non-Earth world with Earth. On Earth, prompt selection of Moon/Mars instead of duplicating Earth silently.
- Render two views if hardware permits. Low-quality mode uses sequential runs with aligned recorded traces.
- Display missing metrics as unavailable. Never substitute zero for missing data.
- Numeric comparisons identify baseline and units. No percentage from a zero baseline.

## F09 — AI

Supported examples:

- "Run the rover on the Moon at 8 metres per second."
- "Compare this setup with Earth."
- "Make the pendulum two metres long."
- "Why did that stay airborne longer?"

Model maps supported requests to validated commands. It does not calculate authoritative trajectories.
Ambiguous request asks one question. Unsupported request names the current limit.
Explain reads completed, validated run summary and assumptions. No completed run: explain setup only, clearly labelled.
If user edits scene during request, reject stale command through revision check.
No model key: show "AI unavailable"; keep local controls. Do not disguise canned responses as live AI.

## F10 — save and recovery

- Store current recipe locally with schema version; debounce writes.
- Refresh restores compatible draft; invalid draft offers Reset and preserves exportable raw data.
- Cloud Save stores recipe, title, and versions. No high-frequency frame stream in Postgres.
- Saved experiments drawer: title, activity, world, updated time, load, delete.
- Guest ownership is browser-session based. Explain loss of access after cleared storage.
- Supabase failure: retain local draft; mark cloud save failed; retry explicitly.

## Roadmap packs

| Pack | Activities | Required work |
| --- | --- | --- |
| Atmosphere | Parachute, balloon, fan, glider, drone | Coefficient/rotor/buoyancy models and validation |
| Machines | Gears, pulleys, springs, motors, flywheels | Prepared mechanisms, torque/loss models |
| Vehicles | Driving, braking, slope climbing, suspension | Wheel/tire and drivetrain models |
| Pressure | Bottle, balloon, syringe, tire, crush tests | Pressure differential and structural response |
| Thermal | Coffee cooling, metal heating, insulation, phase change | Material and heat-transfer data |
| Fluids | Pouring, fountains, boats, pipes | Suitable bounded fluid model |
| Structures | Beams, bridges, towers, landing legs | Calibrated structural models |
| Space | Escape and orbit | Variable gravity and separate integrator |

P1 product features: shared recipes, voice, challenge missions, screenshot/CSV export, Titan/Venus.
P2 product features: custom worlds, object assemblies, approved asset import, richer educational lessons.
P3 product features: specialist solver jobs, validated model packs, collaboration.

## Proof

- Projectile: compare vacuum trajectory with analytic solution at matching initial conditions; target ≤2% flight-time/range error.
- Pendulum: at 5°, compare measured period with small-angle reference; target ≤3% error.
- Wind: compare drag with independent equation; target ≤1% numeric error, zero in vacuum.
- Rover: compare controlled launch against same-mass projectile reference before first collision.
- Compare: same inputs except world; aligned simulated timestamps.
- Repeatability: same engine build, recipe, asset collision shapes, seed, and command order; document numeric tolerance.
- Cross-browser results: tolerance-based, not a blanket bit-identical promise.
- Validate implementation targets before shipping. Report any missed tolerance as a limitation, not a successful check.
