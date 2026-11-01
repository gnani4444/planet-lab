# Guided feature tour

## Acceptance
- First visit opens a short, dismissible tour; completing or skipping it prevents automatic repeats in that browser.
- A visible Take a tour action replays every feature dialog.
- Steps explain activities, worlds, parameters, controls, measurements, Earth comparison, OpenAI, saved recipes and camera/settings without changing the experiment.
- Keyboard focus, Escape, Previous/Next, progress, mobile tabs and reduced motion remain usable.
- Exercise a real walkthrough, cover first visit/replay/persistence and mobile behavior, and run relevant regression checks.
- Update README, push GitHub, deploy Vercel, and verify the live tour. Preserve unrelated work and submitted entry.

## Implementation
Reuse native dialog semantics and existing design tokens; keep tour data/state in one component. Highlight the described feature when visible; mobile steps reveal the relevant existing panel. Do not launch experiments or call external services during the tour. No new dependency, backend or schema change.

## Stop condition
Tour acceptance checks and regression gates pass, GitHub and production match, and actual desktop/mobile walkthroughs work.
