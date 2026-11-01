# devday-exchange-london

Hackathon project for [https://warp-peach-ef6.notion.site/](https://warp-peach-ef6.notion.site/), bootstrapped with `hackathon-init`. Brief: [`HACKATHON.md`](HACKATHON.md).

## Working with coding agents

Claude Code, Codex, Cursor and any agent reading [`AGENTS.md`](AGENTS.md) share one taskboard: [`agent-coordination/taskboard.md`](agent-coordination/taskboard.md). Each agent registers what it builds, checkpoints as it goes, and can take over a task another agent left unfinished.

Every commit is pushed to GitHub automatically. After cloning, enable once:

```bash
./scripts/agent-taskboard.sh setup
```
