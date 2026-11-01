---
name: hackathon-prep
description: Hackathon prep workflow: research judges, sponsors and criteria, then ideate, scope and pitch winning project. Use when user names hackathon, pastes brief or link, asks about judging criteria, wants hackathon ideas, or starts any new hackathon cycle. Trigger on any signal hackathon is being planned. Judge and sponsor research always comes before ideation.
---

# Hackathon Prep v2

Encodes what worked (and failed) across 11 hackathons. Opinionated on purpose.

## Core thesis

**Hackathons are won by sharp idea solving real problem for someone in room, pitched with high energy by builder who slept.**

Tech and architecture do not win. Idea and pitch win. Everything else is downstream of those two.

## Start here

`HACKATHON.md` in repo root holds what `hackathon-init` scraped from event page: overview, dates, judges, criteria, tracks, prizes, sponsors, required stack, rules. Raw page text: `docs/hackathon/source.md`. Read both first. Verify and complete them (Phase 1-2), then write results back into `HACKATHON.md`.

---

## Hard rules (non-negotiable)

1. **Judge and sponsor research first.** Before ideation know each judge, what they care about, what each sponsor ships, and scoring criteria. Idea is function of research, not reverse.
2. **Real-problem filter.** Ask: *"Does this help >1 million people globally in way they'd pay for tomorrow?"* No = discard. "Good-to-have", "plays to track" and "emotional but not needed" all fail.
3. **Sellable-tomorrow test.** Ask: *"If finished by Monday, could it be sold to customer that week?"* No = discard. Winners are products with price tag day after. Demos, prototypes and proofs of concept without clear buyer fail.
4. **Novelty verified by research, never assumed.** Before committing, search web, GitHub, Product Hunt, YC company list, X launches from last 6 months. Near-identical product exists: reposition (different customer, angle or surface) or discard. "I think it's novel" is not enough. Check happens *before* any build commitment.
5. **Target sponsor's or judge's own pain.** Best idea: sponsor company or specific judge has problem and would buy. At event, validate pain with them directly.
6. **Sleep at least 4 hours if hackathon is 24hr+.** Pitch is product. Sleep-deprived pitches lose, even with strong tech.
7. **Web demos only for short hackathons (<24hr).** Mobile is slow to validate and rarely ships clean in time. User argues for mobile: push back hard, require specific reason (e.g. sponsor product is mobile-only).
8. **No default multi-agent architecture.** Use it only when problem structurally demands it (truly parallel work, independent actors, real coordination). Otherwise one agent with tools: simpler, more reliable, easier to pitch.
9. **Tech stack is never differentiator.** Use proven defaults (Next.js + NestJS + PostgreSQL, Claude/Gemini APIs, shadcn/ui), unless `HACKATHON.md` lists required sponsor tech. Spend saved time on idea and demo.

---

## Anti-patterns (kill on sight)

- **Mapping expertise onto problem.** Never start from "what can I build" and hunt for hackathon-shaped hole. Start from judges and sponsors.
- **Pattern-finding where none exists.** Recurring motifs (two-surface demos, multi-agent, voice AI) are not strategy. Each hackathon gets its own answer.
- **Ambitious projects without real problem.** Narrow project solving real problem beats sprawling project solving fake one.
- **Dating apps, generic chatbots, RAG wrappers, prompt-only tools.** Cannot answer "why not existing product"; die at competitive events.
- **Random teams formed at event (24hr+).** Go solo, or team with people user shipped with before or truly wants to ship with. Misfit teams kill pitch energy.
- **Leading pitch with tech.** Architecture slides lose rooms. Lead with problem and person who has it.
- **Building without talking to judges or sponsors.** In person they are present. Ten minutes of talk beats hours of assumption.

---

## Workflow

Follow in order. Never skip ahead.

### Phase 1: Judge & sponsor research (1-2h, before anything else)

Per judge: role, company, recent public work (blog, talks, LinkedIn, GitHub), problem they spend their day on. Per sponsor: product shipped, roadmap signals, what they would pay to have built. Mine event Discord, participant list and pre-event comms if user has access.

Output: short dossier per judge and sponsor in `HACKATHON.md`.

### Phase 2: Criteria & track analysis

Extract published scoring rubric. Infer implicit criteria from judge backgrounds and sponsor priorities. List tracks, what each rewards, which sponsor owns each. Note banned categories (some events ban RAG, chatbots, medical diagnostics, etc.).

Output: scoring framework plus disqualifier list in `HACKATHON.md`.

### Phase 3: Ideation (1-2h max, never before Phases 1-2)

Think like VC or product person, not engineer. Ask:
- What does this sponsor wish existed?
- What does this judge complain about on podcast, blog or LinkedIn?
- What would customer in this room pay for?

Every candidate must pass **all four filters, in order**:

1. **Real problem (rule 2):** helps >1M people who'd pay tomorrow? No = discard.
2. **Sellable tomorrow (rule 3):** finished Monday, sold that week? No = discard.
3. **Novelty (rule 4):** **research work, not thought experiment.** Web search product description, search GitHub and Product Hunt, check YC list, look for X launches in last 6 months. Near-identical exists: reposition or discard. Document findings and how idea differs.
4. **Sponsor/judge fit:** targets at least one sponsor's or judge's own pain? Demoable in under 3 minutes? Can potential customer at event join pitch?

Pick survivor with highest criteria-fit × sponsor-targeting × demoability. Never pick on "how cool is this to build". Record it in `docs/IDEA.md`.

### Phase 4: Scope demo first

Work backwards from 2-5 minute demo. Find moment judges *feel* product work: that is build's spine. Everything else supports it or gets cut.

Define MVP (what demo shows) and explicit cuts (not built even with spare time). Cut by default: mobile, auth, polish until core loop works end to end.

### Phase 5: Architecture & build

Use proven defaults unless specific reason requires otherwise. Document system briefly for coding agents (PRD, context, prompts, rules files as needed). Register build work on shared taskboard (`AGENTS.md`).

Build order: core demo loop, then visible differentiator, then polish. Project must demo at every commit. Never leave it broken overnight.

### Phase 6: Pitch prep (reserve 45+ min)

Structure: problem (with person who has it), product (demo moment), why now, why this team, ask. Map each feature to judging criterion. Validate framing with judges and sponsors during build.

Rehearse out loud at least twice. Pitch energy predicts outcome better than build quality. User under-slept (rule 6): buy energy first (coffee, short nap, walk). Never pitch tired.

---

## Team by duration

| Duration | Team mode | Rule |
| --- | --- | --- |
| ≤6h | Solo | Short windows reward decisive single-builder execution. |
| 6-24h | Solo or trusted partner | Team only with someone user shipped with before. |
| 24h+ | Small trusted team (2-3) | Random teams are trap. Event requires team and no trusted partner: keep it to 2, set explicit roles. |
| Multi-day / online | Team with accountability | Solo long online hackathons failed every time from motivation drift. |

---

## Demo is the product

Winning demos let judges *experience* it working on them: live voice conversation, disruption injected mid-workflow, report surfacing real insight. Losing demos were badly pre-recorded, crashed live, looked like ChatGPT wrapper, or never ran because team missed finals.

- Working end-to-end loop over polished UI
- One "moment" judges have never seen before
- Avoid chat-interface UIs: they read as wrappers even when not
- Video required: reserve at least 1h to record and edit
- Keep screen-recorded fallback if live demo breaks

## Pitch principles

- Lead with problem, not product
- Name specific person with problem, ideally someone in room
- Map each feature to judging criterion
- Close with clear ask (customer, investor, hire, follow-up meeting)
- Energy outweighs content. Practice at 120% of natural energy
- Never lead with architecture, stack or agent topology

## Sanity checks before committing

Ask out loud before building. Any weak answer: back to ideation.

1. Who specifically pays for this tomorrow?
2. Finished Monday, sellable that week?
3. Anything *exactly* like this already exist? (Cite searches run. "I don't think so" is not answer.)
4. Which judge's or sponsor's problem does it solve?
5. What is 30-second demo moment?
6. What gets cut if 4 hours vanish to bug?
7. Pitch headline in one sentence?
8. What would likely winner here build? Is this more or less defensible?
9. Picking this because I want to build it, or because it wins?

## When user brings a new hackathon

1. Get event link or brief (or read `HACKATHON.md`)
2. Run Phase 1 research (judges, sponsors, criteria) before ideation
3. Present findings
4. Only then ideate

User tries to skip to ideation: push back, insist on Phase 1. Most ideas fail real-problem filter because they were born without this context.
