# Planet Lab design context

Scientific workbench using Next.js, React and Tailwind v4. Dark mode and compact density follow `DESIGN.md` and `src/app/globals.css`.

## Sources

- Tokens: `src/app/globals.css`
- Layout and existing dialogs: `src/components/lab/lab-shell.tsx`
- Assistant dialog: `src/components/lab/assistant-panel.tsx`
- Project direction: `DESIGN.md`

## Constraints

Preserve the scene-first workbench, existing tokens, keyboard controls and mobile tabs. Reuse native dialogs instead of adding a dialog dependency. The tour must not change experiment inputs or make cloud requests.

## Tour decision

Use a compact dark dialog card with a restrained feature spotlight, Back/Next and Skip. Reveal the existing mobile panel for each feature, then restore the original panel and focus when the tour closes.
