# Physics audit

Reviewed the live Rapier implementation in `src/features/simulation/index.tsx` separately from the pure reference integrator in `src/features/simulation/physics.ts`. The pure tests are independent numerical checks; the Playwright checks exercise the rendered Rapier runtime. Both use the reference-area drag law `F_D = 1/2 ρ C_D A v²` ([NASA Glenn](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/)).

## Results

The final verification passed: production build and lint are clean, all 45 unit tests pass, and all 19 Playwright journeys pass. The browser suite covers six-world free fall, four Mercury restitution cases, Venus dense-air falling and launching, cross-world comparison/recovery, mobile layout, and existing journeys. Findings below distinguish pure-reference bounds from live-engine bounds.

1. **Quadratic-drag stability — fixed and verified.** The former explicit impulse update could reverse velocity by about 6.77× in the Venus stress case: radius `0.18 m`, `A = 0.1018 m²`, `ρ = 65 kg/m³`, `C_D = 0.47`, `m = 0.1 kg`, `v = 30 m/s`, and `Δt = 1/60 s`. Both paths now use symmetric gravity splitting and exact constant-coefficient quadratic-drag drift (`index.tsx:117-168`; `physics.ts:10-26`). The pure minimum-mass 10 m Venus drop matches the analytic time and impact speed within 1%; its terminal speed stays within 1%. The Rapier 2 m Venus drop matches analytic fall time and terminal speed within 3.5%. Venus's near-surface density is about 65 kg/m³ ([NASA NSSDC](https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html)).

2. **Contact and impact metrics — fixed and verified.** The pure integrator solves fractional contact time within a step using its drag-aware motion model (`physics.ts:79-89`, `115-120`, `178-183`). The Rapier drag path reconstructs incoming velocity from the uncollided trajectory before freezing the body at first contact (`index.tsx:142-160`, `435-450`). Browser free-fall checks pass in all six worlds with airtime error below `0.025 s` and impact-speed relative error below 3%. The dense Venus drop passes the 3.5% time and speed bounds above. Rapier contact position follows collider contact and its near-surface band, so these bounds are measured tolerances rather than a claim of exact mathematical-root placement.

3. **Bounce restitution — fixed and verified.** For ideal vertical bounce, `h' = e²h` and retained mechanical energy is `100e²%`, because rebound potential energy is proportional to height. Pure checks pass for `e = 0, 0.3, 0.7, 0.95`. Rapier explicitly uses the maximum restitution combine rule and the ballistic contact root (`index.tsx:182-184`, `227-235`, `442-453`). Browser checks at `e = 0, 0.01, 0.7, 0.95` pass within `0.045 m` rebound height and `1.6` percentage points retained energy; first-impact time is within `0.025 s` and impact speed within `0.1 m/s`.

4. **Timeout reporting — fixed and verified.** A Titan launch at `g = 1.35 m/s²`, `30 m/s`, `80°`, and `10 m` height has analytic flight time above the 30 s simulation cap. Both summaries now omit flight metrics when contact did not occur (`physics.ts:223-230`; `index.tsx:357-370`). The pure timeout regression test passes.

5. **Dense 2D launch — verified against an independent reference.** For a `0.1 kg` sphere launched from `2 m` at `30 m/s`, `45°` on Venus, an independently coded RK4 integration of `dx=vx`, `dy=vy`, `dvx=-k|v|vx`, `dvy=-g-k|v|vy` gives flight time `3.0219997206 s`, range `0.2358729839 m`, and impact speed `0.7553074337 m/s`. Halving RK4's step from `1e-4 s` to `5e-5 s` changes each result by less than `3e-9` in its displayed units. The pure integrator passes within 1%; the Rapier browser check passes within `0.06 s`, `0.01 m`, and `0.03 m/s`, respectively.

6. **Pendulum period and crossings — verified within the reference's domain.** The small-angle period is `T₀ = 2π√(L/g)`. The pure test allows 3% at 5°, where the approximation applies (`tests/physics/reference.test.ts`). At larger amplitudes the exact period is longer; 30° is not treated as an exact small-angle target. Runtime period measurement interpolates the zero-angle crossing between sampled positions (`index.tsx:384-388`).

7. **Comparison recipe — verified in browser.** Paired worlds advance under the same recipe and parent tick (`index.tsx:112-115`, `365-407`). The UI compares non-Earth recipes against Earth and disables comparison while Earth is selected. Store validation rejects self-comparison (`src/state/lab-store.ts`). The renderer has an internal Moon fallback for an Earth input, which the normal UI does not expose. Browser journeys verify Titan/Earth comparison and recovery.

## Numerical references

- Vacuum vertical drop from rest: `t = √(2h/g)`, `v = √(2gh)`. Independent pure checks cover all six worlds and verify mass independence. The test allows one fixed tick (`1/60 s`) in time and `gΔt` in speed; browser bounds are the tighter observed contract above (`tests/physics/audit.test.ts`, `tests/e2e/expanded-physics.spec.ts`).
- Vacuum launch from height `h`: `t = (v₀ sin θ + √((v₀ sin θ)² + 2gh))/g`; `R = v₀ cos θ · t`; `v_impact = √((v₀ cos θ)² + (v₀ sin θ - gt)²)`.
- Vertical quadratic drag: `v_t = √(2mg/(ρC_DA))`; `h = (v_t²/g) ln cosh(gt/v_t)`; `t = (v_t/g) acosh(exp(hg/v_t²))`. The independent test evaluates `acosh(exp(x))` with a stable identity to avoid overflow.
- Constant-Cd quadratic-drag drift uses `v₁ = v₀/(1 + k|v₀|Δt)` and displacement `Δx = sign(v₀) ln(1 + k|v₀|Δt)/k`, where `k = ρC_DA/(2m)`. The implemented vector form uses the same scalar speed damping along the velocity direction.

## Model limits

The activity model holds drag coefficient and cross-section fixed (`index.tsx:99-110`). Real `C_D` varies with flow regime, orientation, viscosity, and compressibility; Venus's hot, dense CO₂ atmosphere is therefore an educational approximation. The pure reference model and 3D runtime also use different projectile clearance conventions: pure start/contact coordinates omit rendered collider radius, while Rapier uses proxy clearance (`physics.ts`; `index.tsx:73-82`, `190-193`). Compare each against its own stated numerical reference rather than treating the pure simulation as a pixel-exact Rapier oracle.
