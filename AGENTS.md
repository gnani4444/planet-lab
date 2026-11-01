# devday-exchange-london

Hackathon project bootstrapped with `hackathon-init`. Several coding agents (Claude Code, Codex, Cursor, any agent reading `AGENTS.md`) and people work here at once. They coordinate through one shared taskboard. Every commit is pushed to GitHub.

## Hackathon

Event brief: [`HACKATHON.md`](HACKATHON.md) (judges, criteria, tracks, prizes, sponsors, required stack, rules). Raw page: `docs/hackathon/source.md`. Read the brief before ideation or scoping. Use skill `hackathon-prep` to research, ideate and pitch.

## Project notes

<!-- Fill as project takes shape: stack, how to run, demo script. -->

## Shared taskboard (mandatory)

Source of truth for work in progress: [`agent-coordination/taskboard.md`](agent-coordination/taskboard.md). Generated; never edit by hand. Each task has `plan.md` and append-only `activity.md` under `agent-coordination/tasks/<task-id>/`, so any agent can resume where another stopped.

Run every command with **your own agent name**: `claude-code`, `codex`, `cursor`, `gemini`, `copilot`, `opencode`, ... (lowercase letters, numbers, hyphens). Same name all session.

**Before inspecting or changing files for a request:**

1. See current state:
   ```bash
   ./scripts/agent-taskboard.sh context --agent <your-name>
   ```
2. Unfinished task already covers request: take over that **same task**, even if another agent created it. Command prints plan, last checkpoint, next action. Never create a duplicate.
   ```bash
   ./scripts/agent-taskboard.sh take-over --agent <your-name> --task "<task-id>"
   ```
3. Only when no task covers the work, register one:
   ```bash
   ./scripts/agent-taskboard.sh start --agent <your-name> \
     --title "<concise task title>" --scope "<relative paths>"
   ```
4. Fill generated `plan.md` before task-scoped changes.

**While working**, checkpoint before long or risky steps, after each milestone, and when blocked (`--status blocked`):

```bash
./scripts/agent-taskboard.sh checkpoint --agent <your-name> --task "<task-id>" \
  --summary "<what is now true>" --next "<single next action>"
```

**When done**, validate, then close. Use `handoff` instead to release unfinished work.

```bash
./scripts/agent-taskboard.sh complete --agent <your-name> --task "<task-id>" \
  --summary "<what changed and how it was validated>"
```

End every response with exactly one line in this form. Agents with hooks (Claude Code, Codex, Cursor) record it on the taskboard and use it as commit message:

```text
Taskboard checkpoint: <what changed, key result, or blocker> | Next: <single next action>
```

Never overwrite another task's plan or rewrite its activity log. Taking over extends the same record; expected whenever another agent stops.

## Git: every commit is pushed

- `origin` is the GitHub repo. `.githooks/post-commit` pushes each commit in background.
- Claude Code, Codex and Cursor commit automatically each turn. Other agents commit after each meaningful step, message prefixed with agent name: `git commit -m "<your-name>: <what changed>"`.
- Never force-push or rewrite pushed history. Context reports failed push: run `git pull --rebase && git push`. `agent-coordination/taskboard.md` conflicts: keep either side, run `./scripts/agent-taskboard.sh render`.
- Fresh clone: run `./scripts/agent-taskboard.sh setup` once to enable push-on-commit.
- Per-clone switches: `git config taskboard.autocommit false`, `git config taskboard.autopush false`, `git config taskboard.enforce false` (hooks stop blocking edits without a task).

## Project skills

In `.agents/skills/<name>/` (Codex, Cursor) and `.claude/skills/<name>/` (Claude Code). Task matches a skill: read its `SKILL.md` first. Installed: `gsap-scrolltrigger`, `hackathon-prep`, `mcp-builder`, `react-three-fiber`, `remotion`, `skill-creator`, `substance-3d-texturing`, `threejs-webgl`, `ui-ux-pro-max`, `web3d-integration-patterns`.
