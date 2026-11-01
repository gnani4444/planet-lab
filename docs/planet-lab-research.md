# Planet Lab: product and technical research

Researched November 1, 2026. This is a feature inventory and proposed architecture, not a claim that these features have been built or validated. Prices are USD, checked against official OpenAI documentation on this date. Availability, limits, taxes, regional premiums, and processing tiers can change.

## Recommendation

Build a browser-based planetary experiment playground. Let people choose a world, bring everyday objects into a test area, control experiments with voice or sliders, and compare measured outcomes with Earth. Start with curated objects and explicit physical models. Add more experiments by extending a registry of models and assets.

Recommended first stack: React/TypeScript, React Three Fiber/Three.js, Drei, and Rapier through react-three-rapier. Render and simulate ordinary experiments on the user's device. Use OpenAI for language, experiment setup, explanations, optional voice, and creative image assets. Run expensive specialist solvers on a separate backend only when needed.

The product can cover many physical domains, but there is no single engine or AI API that reliably simulates arbitrary objects and all their interactions. A detailed-looking mesh does not provide material properties, internal mechanisms, or validated aerodynamic coefficients.

## 1. Product modes and features

These are proposed product features, not capabilities supplied automatically by a library.

| Mode | Features | Main purpose |
| --- | --- | --- |
| Free experiment | Select world; spawn, grab, rotate, scale, duplicate, launch, reset, and remove supported objects | Play and discovery |
| Earth comparison | Synchronized runs, matched initial conditions, ghost trajectories, shared timelines | See what changed and why |
| Air laboratory | Vacuum chamber, wind tunnel, gas mixture, pressure and temperature controls | Separate atmospheric effects from gravity |
| Vehicle proving ground | Ramps, slopes, obstacles, braking lane, traction tests, suspension view | Compare vehicle behaviour |
| Flight laboratory | Gliders, rotors, parachutes, balloons, launch rigs | Explore lift, drag, buoyancy, and thrust |
| Machine workshop | Gears, joints, motors, springs, pulleys, flywheels, supported assemblies | Explore mechanisms |
| Thermal bench | Heating, cooling, phase diagrams, insulation, material presets | Explore temperature and pressure |
| Challenge mode | Predict outcomes; meet measurable goals; unlock experiment packs | Give experiments a game loop |
| Guided lesson | Short missions, hints, explanations, misconceptions, adjustable reading level | Teaching and independent learning |
| Custom world | Editable gravity, gas state, wind, surface, and lighting | Hypothetical experiments |
| Creator mode | Arrange test rigs, save experiments, author challenges, import supported assets | Community-created experiments |
| Shared laboratory | Shareable links, experiment recipes, replays, spectator mode, later collaboration | Let others repeat results |

Common controls: pause, fixed-step advance, slow motion, limited accelerated playback, camera orbit/follow/first-person views, cutaway views for prepared assets, force arrows, unit selection, measurement tools, graphs, CSV export, screenshots, and video capture. Rewind requires saved state or recorded replay; it is not achieved by making the time step negative.

Trust features: display equations and assumptions, parameter sources and reference conditions, model version, data confidence, numeric tolerances, and unsupported conditions. Separate measured telemetry, model predictions, and narrative explanations. Preserve random seeds and command history for repeatable experiments.

## 2. Worlds and environment data

Use named environments rather than implying every selectable place is a planet. NASA's planetary fact sheet supplies a useful baseline, while individual world pages and satellite parameters provide detail. Rounded fact-sheet values are insufficient for high-precision engineering. [NASA planetary fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/), [JPL satellite parameters](https://ssd.jpl.nasa.gov/sats/phys_par/).

| World | Distinctive environment | Best proposed activities | Priority |
| --- | --- | --- | --- |
| Earth | Familiar baseline with atmosphere and liquid water | Validate experiments; compare other worlds | First |
| Moon | Low gravity and an extremely tenuous exosphere | Jumps, ramps, pendulums, impacts, vacuum comparisons | First |
| Mars | Low gravity and a thin, mostly CO2 atmosphere | Rover tests, parachutes, rotor lift, dust and drag comparisons | First |
| Titan | Low gravity, a substantial nitrogen atmosphere, extreme cold | Balloons, wings, parachutes, hydrocarbon-fluid scenarios | Next |
| Venus | Dense atmosphere, high surface pressure, high temperature | Pressure chambers, drag, heating and hardware limits | Next |
| Mercury | Tenuous exosphere and large thermal variation | Ballistics and illumination/thermal studies | Later |
| Europa | Icy environment and tenuous atmosphere | Friction scenarios and constrained surface experiments | Later |
| Pluto | Low gravity and a tenuous, variable atmosphere | Slow ballistic experiments and atmosphere comparisons | Later |
| Giant planets | Atmospheric layers without a usable solid surface | Probes, balloons, pressure-depth profiles | Specialist |
| Custom world | User-defined, explicitly hypothetical conditions | Isolate a single parameter or explore extremes | First/next |

Titan adds a genuinely different atmosphere rather than only a gravity preset. Venus needs hardware-durability assumptions; otherwise the simulation silently treats objects as indestructible. Jupiter has no true surface, so a road placed there must be explicitly identified as an artificial platform. [NASA Titan facts](https://science.nasa.gov/saturn/moons/titan/facts/), [NASA Jupiter facts](https://science.nasa.gov/jupiter/jupiter-facts/).

Store: gravity or gravitational parameter and radius, altitude, location/season/time, pressure, temperature, composition, gas density and viscosity, wind vector, terrain friction and roughness, ground compliance, solar illumination, and uncertainty. Identify whether values are measured, reference averages, estimates, or user overrides. A mean planetary temperature is not a complete local weather model.

Use local constant gravity for short-range experiments. Orbital and escape experiments require a separate spatial gravity model. An orbiting station is in free fall; it is not a place where gravity has disappeared. Unknown exoplanet atmospheres must be user assumptions or explicitly marked estimates.

## 3. Activity inventory: small to complex

Feasibility labels describe a proposed development path:

- **Core:** simple real-time equations or rigid-body mechanics with curated data.
- **Extension:** additional model development, coefficients, mechanisms, and validation.
- **Specialist:** high-fidelity results need dedicated solvers and domain-specific data; often use backend jobs or precomputed datasets.

| Family | Objects and activities | Required model | Stage |
| --- | --- | --- | --- |
| Gravity and motion | Drop different masses; throw balls; jump an avatar; launch a projectile; compare hang time | Gravity, initial conditions, optional drag | Core |
| Contact and friction | Slide a book; roll a bottle; stack boxes; bounce a ball; topple dominoes; compare slopes | Colliders, friction, restitution, mass distribution | Core |
| Collisions | Bowling, billiards, carts, momentum transfer, impact impulses | Rigid-body dynamics and contact | Core |
| Oscillation | Pendulums, swings, springs, bouncing suspension, coupled oscillators | Joints, springs, damping | Core/extension |
| Simple machines | Seesaws, levers, pulleys, winches, gears, flywheels | Constraints, torque, motors, losses | Core/extension |
| Sports | Basketball shots, long jumps, football trajectories, golf drives, frisbees | Ballistics; shape-specific drag/lift for advanced objects | Core/extension |
| Wheels and vehicles | Toy cars, bicycle models, electric rovers, ramp jumps, braking, wheelspin, climbing | Wheel contact, drive torque, tire forces, suspension | Extension |
| Vehicle survival | Tire pressure, batteries, cooling, lubricants, pressure seals | Temperature/pressure-dependent component data | Extension/specialist |
| Passive flight | Paper planes, gliders, kites, parachutes, falling leaves | Lift/drag coefficients, wind, orientation | Extension |
| Powered flight | Drones, fans, helicopters, propellers, model aircraft | Rotor/propeller and motor maps; atmosphere dependence | Extension/specialist |
| Gas buoyancy | Helium balloons, hot-air balloons, buoyancy versus payload | Gas state, displaced volume, temperature, buoyancy | Extension |
| Wind and shape | Fan tests, model car drag, umbrellas, sails, wing angle tests | Coefficient-based forces; CFD for resolved flow | Extension/specialist |
| Pressure | Sealed bottle, balloon expansion, syringe piston, crushable can, tire | Internal versus external pressure and structural response | Extension/specialist |
| Liquids | Pour from a bottle, water jet, fountain, floating objects, boats, pipes | Buoyancy and fluid models; free surfaces for pouring | Extension/specialist |
| Heat | Cooling coffee, heating metal, insulation, radiative cooling, thermal expansion | Lumped thermal models or heat-transfer solvers | Extension/specialist |
| Phase changes | Ice melting, evaporation, freezing, boiling under changed pressure | Material phase data and coupled energy/mass balance | Extension/specialist |
| Engines | Petrol engine, electric motor, jet, rocket, steam demonstrator | Different propulsion/energy models for each type | Extension/specialist |
| Energy | Solar panels, wind turbines, flywheel storage, battery-runtime comparisons | Irradiance, efficiency curves, load and temperature models | Extension |
| Structures | Bridge loads, beams, towers, landing legs, crush tests | Coarse joint networks or finite-element models | Extension/specialist |
| Deformable materials | Rope, flag, cloth, soft ball, deformable seal | Soft-body models and calibrated material parameters | Extension/specialist |
| Granular surfaces | Sand pile, rover tracks, digging, dust settling, wheel sinkage | Granular dynamics and terrain models | Specialist |
| Sound | Speaker propagation, gas-dependent sound speed, vacuum comparison | Acoustic propagation; interface sound is separate | Extension/specialist |
| Robots | Gripper pickup, robot arm, rover traversal, balance task | Multibody mechanics, controllers, contact | Extension/specialist |
| Orbits | Satellite launch, escape trajectories, orbit changes | Variable gravity and appropriate numerical integration | Separate module |
| Electromagnetism | Magnets, coils, circuits, motor demonstrations | Circuit/field solvers; planetary fields when relevant | Specialist |
| Biology and chemistry | Plant growth, metabolism, corrosion, long-term habitability | Empirical models and major uncertainty | Research only |

These are experiment concepts, not a promise of interchangeable physical accuracy. Two objects can use the same visual asset while requiring entirely different models for flight, pressure collapse, heating, and fracture.

### Objects and assemblies

Start with a library containing a ball, brick, book, bottle, crate, wheel, spring, pendulum, ramp, toy car/rover, parachute, simple wing, balloon, and fan. Add prepared machines later. An uploaded photograph can help identify an object category; the user must supply or confirm dimensions, mass, materials, and internals. A glTF upload supplies appearance, not physical truth.

Each object definition needs visual mesh, simplified collision shape, dimensions, mass, centre of mass/inertia, material/contact properties, joints, supported experiments, and model validity ranges. Aerodynamic objects additionally need reference area and coefficient curves. Thermal objects need heat capacity, conductivity, emissivity, and applicable phase data. Engines need intake, fuel/oxidizer, torque/efficiency maps, cooling, and operating limits.

Changing object size must have an explicit mass rule. Changing mass must not silently alter geometry. Scaling an object is not physically neutral.

## 4. Air testing and the limits of a wind tunnel

Provide two workspaces:

1. **Atmosphere chamber:** control pressure, temperature, composition, and wind; measure drag, buoyancy, pressure differences, and simplified heat transfer.
2. **Wind tunnel:** mount a supported object, sweep speed and orientation, and chart forces. Show streamlines only if they come from a field model; decorative streaks are not measured CFD results.

In physical mode, derive gas density from compatible pressure, temperature, and composition. For an ideal gas, rho = p/(R_specific T). Independent, incompatible sliders belong in an explicitly hypothetical mode. Dense/high-pressure conditions can require a real-gas equation of state. [NASA equation of state](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/equation-of-state/).

Useful measurable quantities: relative airspeed, dynamic pressure, drag, lift, acceleration, terminal velocity under the applicable model, buoyant force, pressure differential, temperature, and energy use. Show Reynolds/Mach validity bounds when aerodynamic assumptions depend on them.

For an educational model, use D = 0.5 rho v_rel^2 Cd A and L = 0.5 rho v_rel^2 Cl A with curated coefficients. These are force equations, not a solution of the surrounding airflow. Cd and Cl depend on shape and operating conditions; do not invent them from an image or freeze them across all regimes. [NASA drag equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/), [NASA lift equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/lift-equation/).

Specific tests: sphere versus flat plate; umbrella angle; car orientation; parachute area; drone payload; balloon fill gas; wind turbine loading; bottle pressure; fan force; and heat loss in different gas states. Lower gravity alone does not imply a faster car: traction, motor torque, surface properties, drag, and gearing also matter. Rockets carry propellant/oxidizer and must not share an air-breathing-engine availability rule.

For water, use phase data. Below the triple-point pressure, stable bulk liquid water is not described by simply lowering a familiar boiling point. Frozen/boiling/evaporating states can require a coupled model. [NIST water phase data](https://webbook.nist.gov/cgi/cbook.cgi?Mask=4&Name=water).

## 5. Graphics, engines, and deployment

The following recommendations are engineering judgments based on documented capabilities, not measured benchmarks for this project.

| Stack | Strength | Tradeoff | Recommendation |
| --- | --- | --- | --- |
| Three.js + React Three Fiber + Rapier | Fine control over a React-based laboratory UI and 3D scene; WASM physics | Assemble rendering, tools, and extra physical models yourself | Best fit for the proposed browser build |
| Babylon.js + Havok | Broad web engine with integrated physics workflow and tooling | Different scene/component model; custom science still required | Strong alternative for a more game-like build |
| PlayCanvas + Ammo | Browser-focused engine with editor-oriented scene workflow | Another authoring workflow and extra physical models | Good if the team already knows it |
| Godot native/web | Full game-development workflow and native targets | Web export uses the Compatibility renderer; current docs list restrictions | Prefer if native game delivery becomes primary |
| Unreal + Pixel Streaming | High-end rendering streamed to browsers | Remote GPU hosting, streaming latency, and operational cost | Later, only if cinematic fidelity warrants it |

React Three Fiber is a React renderer for Three.js, not a separate physics solver. Rapier documents rigid bodies, joints, snapshots, and soft bodies, but confirm the chosen JavaScript package and wrapper expose the required feature before scheduling it. [react-three-rapier](https://github.com/pmndrs/react-three-rapier), [Rapier features](https://rapier.rs/docs/).

Three.js offers a WebGPU renderer with WebGL2 fallback. Its material and post-processing workflow differs from the established WebGL path, so pick one pipeline and verify required effects. WebGPU availability alone does not guarantee a better frame rate. [Three.js WebGPURenderer](https://threejs.org/manual/pages/webgpurenderer).

Babylon's Havok integration uses WebAssembly. PlayCanvas documents Ammo-based physics. Godot's current web renderer has limitations compared with native rendering. Unreal Pixel Streaming performs rendering on the remote machine and sends interactive video to browsers. [Babylon Havok](https://doc.babylonjs.com/features/featuresDeepDive/physics/havokPlugin/), [PlayCanvas physics](https://developer.playcanvas.com/user-manual/physics/physics-basics/), [Godot web export](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html), [Unreal Pixel Streaming](https://dev.epicgames.com/documentation/en-us/unreal-engine/overview-of-pixel-streaming-in-unreal-engine).

### What makes the scene look good

- A bounded, detailed landing site instead of a uniformly low-detail planet.
- Physically based materials with authored normal, roughness, and colour maps.
- Deliberate sunlight, contact shadows, environment lighting, exposure, and restrained post-processing.
- World-specific terrain, rocks, horizon, atmosphere, and dust, without treating cosmetic effects as physics measurements.
- Detailed object meshes paired with cheaper collision proxies.
- Good scale references, camera framing, smooth transitions, and readable force/measurement overlays.
- Compressed assets, level of detail, instancing, capped pixel density, and adjustable effects.

Target a smooth desktop experience, then measure real hardware; do not promise a frame rate before profiling. Plan lower-cost settings for mobile. Keep physics on a fixed time step with appropriate substeps and render interpolation. Reduce render quality before changing the scientific meaning of a comparison.

Poly Haven provides CC0 models, textures, and HDRIs useful for Earth-like materials and props. Check separate API terms if integrating its live API. Generated images can supply concept art or colour textures; they do not automatically provide calibrated PBR maps, seamless world geometry, or usable collision meshes. [Poly Haven license](https://polyhaven.com/license).

## 6. OpenAI integration

Use a bounded command pipeline: user request, supported action selection, validated parameters, local simulation, measured telemetry, then explanation. Keep normal object interactions responsive even when the model is unavailable.

| Product function | Proposed model/API | Application responsibility |
| --- | --- | --- |
| Parse “launch this rover on Mars at 8 m/s” | Responses API, function calling, gpt-6-luna | Validate units, object/world IDs, speed bounds, and missing information |
| Explain measured results | gpt-6-luna; route difficult questions to gpt-6.1-sol | Provide actual telemetry and assumptions; check numbers |
| Plan a supported multi-step experiment | Responses API with structured outputs/function tools | Permit only registered model capabilities |
| Select an activity or evaluate a challenge explanation | Decisions API, gpt-6-luna | Define choices/rubrics; use code for numerical scoring |
| Natural live voice | gpt-live-1 with delegated backend | Run simulation tools and return confirmed outcomes |
| Alternative voice architecture | Realtime API or transcription/text/speech pipeline | Evaluate latency and total cost for the chosen models |
| Identify an uploaded household object | Vision-capable Responses model | Ask for scale, material, mass, internals; show uncertainty |
| Generate creative scenery or posters | GPT-Image-2.5 Flare; Sunburst for editing precision | Convert/validate usable assets and reuse outputs |
| Ground explanations in curated facts | Versioned data files initially; file search when corpus needs it | Preserve provenance; avoid live browsing every frame |
| Build and verify the application | Codex during development | Record a concrete contribution for judging |

Current official docs describe gpt-6-luna as efficient for focused workloads and gpt-6.1-sol as suitable for more complex work. Start with Luna, then evaluate real examples before upgrading every request. [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol).

The Decisions API currently supports only gpt-6-luna and returns predicates, fixed choices, or rubric scores. It is appropriate for routing, not arbitrary scene construction or a physical solver. Use Responses function calling for actions with arguments. [Decisions](https://developers.openai.com/api/docs/guides/decisions), [function calling](https://developers.openai.com/api/docs/guides/function-calling).

GPT-Live handles conversation while a backend handles reasoning and tools. It does not directly accept images/video according to its model page; send object photos to a vision-capable backend. GPT Image outputs images, not a documented production-ready 3D mesh asset. [GPT-Live guide](https://developers.openai.com/api/docs/guides/live), [GPT-Live model](https://developers.openai.com/api/docs/models/gpt-live-1), [GPT Image guide](https://developers.openai.com/api/docs/guides/image-generation).

Suggested tool names: select_world, spawn_supported_object, set_environment, set_launch_conditions, run_experiment, pause_experiment, compare_runs, get_measurements, and reset_experiment. A model cannot authorize a physical capability that is absent from the registry.

Do not call OpenAI on each physics frame. Send compact event/state summaries when the user asks or a meaningful outcome occurs. Keep API keys on the server; use the documented browser voice connection flow. Never turn generated arbitrary code into executable simulation behaviour without a separate trusted authoring workflow.

## 7. Tokens, prices, and an illustrative budget

Text input/output, vision images, generated images, and voice have different accounting. A token is a model-accounting unit, not a physics step or a fixed number of user actions. Include hidden reasoning tokens where billed; count repeated context and tool results. Use returned usage fields rather than visible answer length.

### Verified rates

Standard short-context text rates, USD per one million tokens:

| Model/endpoint | Uncached input | Output |
| --- | ---: | ---: |
| gpt-6-luna through Responses | $0.10 | $0.50 |
| gpt-6.1-sol through Responses | $2.00 | $10.00 |
| gpt-6-luna through Decisions | $0.10 | No output-token charge |

Cache reads/writes, long contexts, processing tiers, regional processing, and tools have their own rates. Decisions pricing is endpoint-specific; do not apply its free output rule to Luna Responses calls. [Luna pricing](https://developers.openai.com/api/docs/models/gpt-6-luna), [Sol pricing](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [Decisions pricing](https://developers.openai.com/api/docs/guides/decisions#pricing-and-availability).

GPT-Live costs $0.05 per connected minute, billed per second; backend work is extra. GPT-Image-2.5 Flare standard rates are $5 per million text-input tokens, $8 per million image-input tokens, and $30 per million image-output tokens. Image costs depend on actual generated-token usage and settings; do not treat those as a universal price per image. [Live pricing](https://developers.openai.com/api/docs/models/gpt-live-1), [Flare pricing](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare).

### Worked example, not a forecast

Assume 100 sessions, 20 Responses requests per session, 2,000 uncached input tokens and 300 total billable output tokens per request. No cache writes, tool fees, retries, regional uplift, long-context multiplier, or taxes are included.

- Total input: 4,000,000 tokens. Total output: 600,000 tokens.
- All Luna Responses: $0.40 + $0.30 = **$0.70**.
- All Sol Responses: $8.00 + $6.00 = **$14.00**.
- Optional 2,000 Decisions calls at 500 uncached input tokens each: **$0.10**.
- Optional 100 connected voice sessions of five minutes each: **$25.00**, plus backend costs above.
- Example image batch: 20 separately generated images, each hypothetically using 300 text-input tokens and 4,000 image-output tokens, would cost **$2.43**. This is arithmetic on assumed usage, not a resolution/quality guarantee.
- Combined Luna + Decisions + voice + illustrative images: **$28.23** under these assumptions.

Hosting, CDN/storage, asset purchases, specialist CPU/GPU jobs, and remote rendering are separate expenses. Ordinary local rendering and physics consume no OpenAI tokens.

Reduce cost by using local controls for common actions, short measured-state summaries, bounded outputs, caching stable prefixes where supported, reusable generated assets, closed idle voice sessions, and an application-side session budget. Prompt caching is conditional on prefix matching; verify actual cache usage. [Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching).

## 8. Credits and account checks

Treat three concepts separately: Codex subscription/coupon usage for building, API organization credit for running the app, and hosting/graphics compute. Do not assume credits transfer between these balances.

Current official documentation says eligible paid Pro and Business subscriptions can claim API credits through an API organization they own. Eligibility includes a subscription at least seven days old, matching account email, and ownership conditions. Allowance depends on plan/seats, with an advertised maximum of $500; complimentary subscriptions do not qualify. Credits require activation and expire according to the applicable billing cycle. Confirm the actual account's benefit and balance rather than assuming eligibility. [Subscriber API credits](https://developers.openai.com/api/docs/guides/chatgpt-api-credits).

The repository's Builders Guide describes a Codex coupon redeemable once before December 31, 2026 at 00:00 UTC, with credits lasting 30 days after redemption. It does not establish an amount of runtime API credit. Prize subscriptions may also have separate terms. Check the coupon issuer's description and API billing dashboard before budgeting.

Before implementation, verify model access, organization verification where required, rate limits, available credit, expiry, and intended project organization. Credit availability does not remove rate limits. Use project-scoped credentials, usage logging, alerts, and an application-side spending cutoff. This research did not inspect the user's billing balance, redeem coupons, change settings, or call paid generation APIs.

## 9. Specialist simulation roadmap

| Need | Candidate | Integration approach |
| --- | --- | --- |
| Resolved airflow, turbulence, heat transfer, multiphase flow | OpenFOAM family | Backend/precomputed jobs; return fields and metadata to the browser |
| Vehicle/terrain mechanics and detailed tires | Project Chrono | Native/backend solver or precomputed experiment library |
| Combustion, thermodynamics, chemical kinetics | Cantera | Backend calculations coupled to an explicit engine/system model |
| Structural stress/fracture | Finite-element workflow | Geometry/material preparation, meshing, solver jobs, validation |
| High-detail liquids/cloth/soft bodies | Suitable dedicated solver or verified engine module | Small bounded scenes; benchmark before promising real-time results |

OpenFOAM documents multiple solver classes; its existence does not make an unmeshed arbitrary object immediately simulation-ready. Chrono explicitly targets vehicle/terrain and multibody problems. Cantera supplies thermo-chemical calculations, not a complete graphical car engine. [OpenFOAM solver catalogue](https://doc.openfoam.com/2306/tools/processing/solvers/), [Chrono](https://projectchrono.org/), [Cantera](https://www.cantera.org/).

Validate simple models against analytical cases before making comparative claims: vacuum fall time, projectile trajectories, pendulum period at small angles, conservation tests, and drag approaching the expected terminal velocity. Check identical inputs reproduce results within a defined tolerance, and expose timestep/coefficient limitations. A game engine producing believable motion is not engineering certification.

## 10. Build stages and stop conditions

This is a roadmap; the full inventory does not fit the remaining hackathon window.

1. **Hackathon core:** Earth/Moon/Mars, a bounded test area, curated objects, one polished vehicle-ramp experiment, matched Earth comparison, measured charts, reset, and typed AI commands/explanations. Add a wind/drag test if the core is already stable. Stop when the full journey is reliable and reserve time for the required video/submission.
2. **First product expansion:** atmosphere chamber, parachute/balloon experiments, Titan/Venus, voice, saved recipes, challenge missions, and downloadable results.
3. **Advanced laboratory:** prepared mechanisms, vehicle component models, thermal/fluid experiments, asset authoring, and more detailed materials.
4. **Specialist platform:** queued engineering solvers, datasets, validated model packs, collaborative lessons, and research-oriented extensions.

A stronger demo measures a few things honestly than a wider demo that claims every visible effect is physically solved. The long-term differentiator is one repeatable question across many systems: “What changes when the environment changes?”
