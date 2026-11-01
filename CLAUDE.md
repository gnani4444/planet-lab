@AGENTS.md

## Claude Code specifics

- Taskboard agent name: `claude-code`.
- `.claude/settings.json` wires three hooks to `scripts/taskboard-hook.sh`:
  - **UserPromptSubmit** adds taskboard context (active task, unfinished tasks, recent activity) to every prompt.
  - **PreToolUse** blocks `Edit`/`Write` in this repo until you have an active task. When it fires, run `start` or `take-over`, then retry.
  - **Stop** records final `Taskboard checkpoint:` line on active task and commits the turn; post-commit hook pushes it.
- Stop hook writes only while you are the task's current executor, so it never overwrites a task Cursor or Codex took over.
