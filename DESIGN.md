# Planet Lab — UI and components

Screen question: "What changes when I run this experiment on another world?"
Largest element: actual 3D experiment. Main action: Run. Signature: paired Earth/world trajectories and measured difference.

## Direction

Scene-first scientific workbench. Quiet neutral controls; colour belongs to worlds, trajectories, and forces.
Use true-black flat app direction from design-taste-frontend. Adapt builder composition to a 3D laboratory.
UI search returned generic marketing patterns; do not use its hero/features/CTA layout.

No marketing landing page, neon console, decorative telemetry, glass cards, or full-screen chat.
Main scene supplies visual richness. Controls stay compact and readable.

## Tokens

| Token | Value |
| --- | --- |
| Ground | `#000000` |
| Surface | `#111111` |
| Raised control surface | `#2A2A2A` |
| Primary text | `#FFFFFF` |
| Secondary text | `#B4B4B4` |
| Metadata | `#949494`; verify contrast on actual surface |
| Control boundary | `#666666` where boundary is required for recognition |
| Data accent | `#4CB3F0` |
| Earth comparison | Pale neutral, dashed trace; explicit label |
| Error | `#E5484D` plus text/icon |
| Focus | Visible white/sky outline; test against both scene and panels |
| Typography | Inter 400/500/600; load through framework font tooling |
| Figures | Tabular digits; units beside values |
| Sizes | Title 20px; section 16px; body 14px; secondary 12px |
| Shape | Floating panels 20px radius; pill action buttons; nested controls 8px radius |
| Spacing | 4/8/12/16/24/32px; use consistent panel padding |

Default desktop controls: 36px visual height inside ≥44px interaction area. Touch controls: ≥44px.
White Run button, black label. Neutral navigation. Sky blue for active-world measurement marks.
Terrain keeps natural colour. No requirement to desaturate physical scenery to meet UI hue budget.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Ready lab; first-run activity chooser available as sheet |
| `/lab` | Same workbench; useful stable link |
| `/s/[token]` | P1 read-only shared recipe; Try this creates a local copy |

No account page in launch scope. Saved experiments and settings open inside workbench.
URLs may carry validated world/activity IDs. Complex recipe lives in local/cloud state, not arbitrary query code.

## Desktop composition

At 1440×900:

```text
┌ Planet Lab ─ Activity ─ World ───── Compare Earth ─ Save ─ Settings ┐
│ Object / activity │                                              │
│ palette           │               3D test area                    │
│                   │          trajectory + force overlays          │
│                   │                               Inspector      │
│                   │                               inputs + units │
│                   │                                              │
├───────────────────┴──── Run / Pause / Step / Reset ────────────────┤
│ Measurements + small plot                 Ask about this experiment│
└───────────────────────────────────────────────────────────────────┘
```

- Header: 56px. Name, current activity/world, meaningful actions; no empty search/avatar placeholders.
- Left palette: roughly 208–232px; four activities with real preview thumbnails and short names.
- Centre: flexible scene. Camera controls pinned inside scene corners.
- Right inspector: roughly 264–288px; activity-specific fields, environment summary, assumptions disclosure.
- Bottom dock: roughly 160–208px; controls, primary measurements, chart, compact AI input.
- Default scene remains visible without scrolling. Panels scroll internally only when necessary.
- At 1024–1279px, collapse palette to activity menu; inspector becomes toggleable drawer.
- Comparison splits scene evenly, locks timeline, labels worlds, keeps one common control panel.

## Component inventory

| Component | Job | Data/source |
| --- | --- | --- |
| `LabShell` | Layout, panels, responsive composition | UI store |
| `LabHeader` | Product, world/activity switch, Save | Recipe + persistence state |
| `WorldPicker` | Earth/Moon/Mars; future worlds clearly disabled | World registry |
| `ActivityPalette` | Four supported activities | Activity registry |
| `ActivityPreview` | Recognisable object thumbnail | Asset registry |
| `SceneViewport` | Client-only Canvas, loading/error boundary | Simulation adapter |
| `PlanetEnvironment` | Terrain, sky, lighting | World registry |
| `ExperimentRig` | Render active activity | Recipe |
| `PhysicsBridge` | Commands, fixed-step advance, telemetry | Simulation module |
| `CameraToolbar` | Orbit/follow/reset camera | Local camera state |
| `ParameterInspector` | Labelled number input plus slider | Activity schema |
| `EnvironmentSummary` | Gravity, density, reference conditions | World data |
| `SimulationControls` | Run, pause, step, reset | Run state |
| `MeasurementStrip` | Relevant current/result numbers | Measured telemetry |
| `TelemetryPlot` | One clear time series; table alternative | Recorded samples |
| `ComparisonView` | Two worlds or aligned replay fallback | Paired runs |
| `AssistantDock` | Input, progress, answer, retry | AI API client |
| `SavedExperimentsDrawer` | Save/load/delete; honest cloud status | Persistence adapter |
| `AssumptionsPanel` | Equations, sources, simplified effects | Model metadata |
| `LabErrorBoundary` | Recover asset/WebGL failure | Local failures |

Compose small controls. Do not create a separate component for every label or value.
Use accessible primitives for dialogs, sliders, selects, tooltips, tabs, and disclosure.
If scaffold includes `components.json`, follow project's 21st search rule before hand-writing matching UI primitives.
Never import marketing demos into scientific controls without removing irrelevant behaviours.

## Interaction rules

- Number input remains usable without dragging slider. Units always visible.
- Changing activity/world/configuration increments recipe revision and resets the current run.
- Running state shows elapsed simulation time. No fake progress percentage.
- Before result, show initial conditions and "Ready". Charts wait for measured samples.
- AI can propose/apply supported reversible changes. Show applied action; stale responses cannot mutate scene.
- Save states: local only, saving, saved, failed. Never show Saved before confirmation.
- Keyboard: Tab through controls; Space toggles run only outside text inputs; R resets only outside inputs.
- Prevent global hotkeys while dialogs or AI input own focus.
- Dragging objects needs a keyboard alternative. Free object dragging is P1; launch controls are launch scope.

## Narrow screens

Below 768px: header, scene, control row, labelled tabs: Setup / Results / Ask.
Scene height roughly 40–50svh; never hide Run behind a drawer.
World/activity menus become sheets. Comparison stacks or uses labelled aligned replays.
Keep full page zoom enabled. Test 390×844 and landscape tablet.

## Required states

| State | Behaviour |
| --- | --- |
| Loading asset | Fixed scene frame; show asset name/bytes when known; cancel/reset available |
| Asset failure | Fallback mesh plus message; retry asset separately |
| WebGL unavailable | Explanation, compatible-device hint, numeric/reference view; no blank screen |
| AI unavailable/timeout | Local controls work; answer area gives retry and reason |
| Supabase unavailable | Draft remains local; cloud features show unavailable |
| Invalid input | Error beside field; retain last valid recipe |
| Unsupported experiment | Name missing capability; keep current scene |
| Empty saved list | "No saved experiments" and current Save action |
| Mobile low performance | Lower render resolution/effects; preserve physics step and comparison meaning |

## Graphics brief

One detailed test platform per world. Match geometry scale and collision dimensions.
PBR terrain, contact shadows, directional sunlight, atmospheric horizon where appropriate.
Use compressed GLB assets, lazy loading, instanced rocks, bounded shadow maps, capped pixel density.
Use authored primitive rover fallback from day one.
No runtime image generation dependency. Record asset URLs/licenses in `public/assets/credits.json`.
UI transitions 120–200ms. Reduced motion removes camera fly-through and cosmetic drift; physics runs only on user action.

## Visual acceptance

Inspect real browser at 1440×900, 1024×768, 390×844.
Verify contrast, visible focus, text zoom, keyboard operation, labels, error recovery, and reduced motion.
Check scene-to-control hierarchy. Product identity must come from actual experiments and world assets.
No screenshot QA claimed until UI exists.
