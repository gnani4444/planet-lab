# Agent coordination

Shared record of work in this repo. Claude Code, Codex, Cursor and any agent reading `AGENTS.md` post work here, so when one agent stops (usage limit, crash, tool switch) another continues the same task with plan, latest checkpoint and history intact.

```text
find or create task → plan → checkpoint work → hand off or take over → validate → complete
```

[`taskboard.md`](taskboard.md) is the generated overview. Each task under `tasks/<task-id>/` owns:

- `task.md`: machine-readable record (status, current executor, next action).
- `plan.md`: living plan and later decisions.
- `activity.md`: append-only timestamped checkpoints: which agent did what, plus concrete next action.

`active/` holds each agent's current task on this machine; not committed.

## Commands

```bash
./scripts/agent-taskboard.sh context    --agent codex
./scripts/agent-taskboard.sh start      --agent codex --title "Add login" --scope "app/auth"
./scripts/agent-taskboard.sh checkpoint --agent codex --task "<id>" --summary "API done" --next "Wire the form"
./scripts/agent-taskboard.sh take-over  --agent cursor --task "<id>" --reason "Codex hit its usage limit"
./scripts/agent-taskboard.sh handoff    --agent cursor --task "<id>" --summary "Form wired" --next "Add tests"
./scripts/agent-taskboard.sh complete   --agent cursor --task "<id>" --summary "Login works; tests pass"
./scripts/agent-taskboard.sh render     # rebuild taskboard.md (e.g. after a merge conflict)
```

## Agent integrations

| Agent | Instructions | Hooks |
| --- | --- | --- |
| Claude Code | `CLAUDE.md` (imports `AGENTS.md`) | `.claude/settings.json`: context on prompt, edit guard, checkpoint + commit on stop |
| Codex | `AGENTS.md` | `.codex/hooks.json`: same three hooks (load once project is trusted and hooks approved) |
| Cursor | `.cursor/rules/agent-taskboard.mdc`, `AGENTS.md` | `.cursor/hooks.json`: checkpoint + commit after each response |
| Any other agent | `AGENTS.md` | none; calls helper and commits explicitly |

All hooks go through `scripts/taskboard-hook.sh`. A hook writes to a task only while its agent is current executor, so a stale hook never overwrites work another agent took over. `.githooks/post-commit` pushes every commit.
