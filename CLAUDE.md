# Equoria — Claude Code Configuration

**Version:** 4.0.0 (constitution-first rewrite)
**Last Updated:** 2026-05-26
**Project:** Web browser-based horse breeding simulation game

---

## Active exceptions (read before doing anything else)

Time-boxed deviations from the constitution. Each names the reason, scope, and removal condition. **If an exception isn't in this section, it doesn't exist** — agents may not invent new ones.

_None currently active._

The `--no-verify` exception (active 2026-05-12, removed 2026-05-27 with user authorization) is retired. Root cause and fix: the pre-push hook's full `jest --runInBand` suite — the documented ~10-min gate — had regressed to ~95 min plus a post-run hang, from single-process heap/handle accumulation (per-import `process.on` handlers in `app.mjs`). That leak is fixed (Equoria-l052p guards the handlers behind `NODE_ENV !== 'test'`), and the lone order-dependent failure the restored gate exposed is fixed (Equoria-lnfmj: scoped a foal-milestone idempotency assertion). Verified 2026-05-27: the exact hook command `jest --runInBand --retryTimes=1` runs 641 suites / 11889 tests green in ~16 min with no hang. **Pushes go through the real hook again: `git push origin master`** (no `--no-verify`).

---

## The Equoria constitution

These seven principles govern every decision an agent makes in this codebase. Specific rules elsewhere in this file are _examples_ of these principles in action — when an agent encounters a situation the rules don't explicitly cover, it reasons from the constitution.

### 1. Visible work beats hidden work

A change that isn't deployed to Railway didn't happen. Branches accumulate untested surface area and produce architectural drift between sessions. A session that doesn't end in a successful push leaves work stranded locally — which is the same as not doing the work.

**This is the principle that produced the 2026-05-04 incident.** Fifty-six commits accumulated on `fix/21r-security-hardening-corrected` over weeks because each session built on the prior session's branch instead of branching off master. The result: a multi-hour rebase with architectural conflicts (master and the branch had parallel security-middleware refactors with different APIs), a forced `--no-verify` push to bypass a leaderboard test that was brittle to real-DB drift, and bypass of 24 required CI status checks to land everything at once. None of those failure modes existed if the work had landed in small same-session commits.

**Implications:**

- Every session starts with `git checkout master && git pull --rebase origin master`.
- Every `bd` issue lands as one small commit (or two if test-then-fix) directly on master, pushed same-session.
- The push command is `git push origin master`. If branch protection blocks it, report it — do not detour onto a side branch.
- Feature branches, `fix/*`, `feature/*`, and `epic-*` branches are forbidden. The only exception is a hotfix that requires staged rollback infrastructure (e.g., a major schema migration), and that requires explicit user authorization at the start of the work.
- Never run two `git push` processes in parallel — they contend on locks and one will silently fail.

If you find yourself reasoning toward "I'll just commit this on a branch and merge later," you are starting the next 2026-05-04. Stop.

### 2. A beta is a falsifiable test, not a compliance ritual

Active beta means testers can use every beta-live feature through real UI and real backend behavior. The point of a beta gate is to _fail when something is broken_. Anything that produces a green signal without exercising the real failure mode defeats the gate.

This is why "remaining risk," "legacy but not readiness evidence," "graceful skip," "temporarily hidden," "read-only for beta," and "follow-up later" are not acceptable closure language for Epic 21R stories. If a beta-live path is broken, that's a defect to fix or a product-scope removal to explicitly document — there is no third option.

**Bypass patterns we've seen agents reach for, all forbidden as readiness evidence:**

- Hiding routes that are in beta scope, or making them read-only
- `test.skip`, `it.skip`, `describe.skip`, `test.fixme`, conditional E2E skips, "skip if missing infra" behavior
- Bypass headers: `x-test-skip-csrf`, `x-test-bypass-auth`, `x-test-bypass-rate-limit`, `x-test-user`, `x-test-bypass-ownership`, `VITE_E2E_TEST`, route interception
- Fake product values: TODO actions, no-op handlers, `console.log` primary actions, hardcoded IDs, fabricated estimates, placeholder dates, local-only account settings, "Unknown/0" values masquerading as real data
- Mock primary paths: `MOCK_`, `mockApi`, `allMockHorses`, `mockSummary`, seeded fake players, fake metrics outside tests

This list is non-exhaustive. The principle is the test — when a new pattern appears, ask whether it exercises the real failure mode or hides it.

**Required final signoff command:** `bash scripts/check-beta-readiness.sh` with all gates enabled, no skip flags. Any environment that cannot run the full gate cannot produce beta-readiness signoff.

### 3. Tests exist to detect real failures

Anything that softens the failure signal defeats the purpose of having tests. A test that passes while hiding a broken feature is worse than no test, because it produces false confidence.

**Implications:**

- **No mocks of internal code.** Backend tests call real controllers, real services, real DB. Mocking a DB call is testing nothing.
- **Real DB only.** `.env.test` points at the canonical Equoria DB; tests run against production data. This is the user's explicit choice — the risk of test/prod drift is real, but the alternative is testing fiction. Do not propose reverting to a test DB.
- **Real-DB tests must scope their cleanup.** `prisma.X.deleteMany({ where: { name: { startsWith: 'TestFixture-' } } })` — never broad. A raw `deleteMany()` without a where-clause wipes real user data; that's forbidden.
- **Test fixtures coexist with real game state.** Filter by name pattern or unique IDs, never by relative position. Tests must not assume their data dominates leaderboards, counts, or ordering.
- **E2E (Playwright) uses real credentials, real backend, real DB.** No bypass headers, no `test.skip` on beta-critical paths.
- **Frontend unit tests** with mocked API responses may remain, but do not add new `vi.mock`-of-API-client tests. Prefer Playwright E2E for new user-facing coverage.
- **Pre-push slowness is the cost of safety.** The ~10–16-minute Jest suite is intentional. A failing pre-push test is a real signal — fix it, don't bypass it.

### 4. Substance over the appearance of substance

Agents are incentivized to produce green status. The user values truth about red status more than the appearance of green status. This means: when an agent is tempted to make a status look better than the underlying code warrants, the temptation itself is the warning sign.

**Implications:**

- **Never fabricate audit outputs.** TEA gates (ATDD/TA/RV) and code review findings must be produced by running the actual skills (`bmad-tea`, `bmad-code-review`). Writing sections directly into story artifacts without running the skills is forbidden.
- **Never update readiness status from intent.** Update sprint status, signoff files, or story completion only after verifying the real code and recording the command evidence.
- **"Done" is not the literal acceptance criteria** — it's the `OPTIMAL_FIX_DISCIPLINE.md` §8 checklist. If you find yourself thinking "AC met, ship it," re-read §1, §2, §6. Cheap-default ≠ correct-default.
- **AC audit, sentinel-positive test, adjacent-locations check, no forward-reference docs, alternative considered, what-was-NOT-done report** are required for any defect fix. Details: `.claude/rules/OPTIMAL_FIX_DISCIPLINE.md` and `.claude/rules/EDGE_CASE_FIX_DISCIPLINE.md`.
- **Quality and methodology adherence are non-negotiable.** Shortcuts that produce the appearance of compliance without the substance are not acceptable. If a workflow step has a skill, run the skill. If a step requires user input, stop and ask.

### 5. Small bounded work over accumulated risk

One issue → one or two commits → one push → one session. Work that's too big for a session is too big — split it into smaller `bd` issues. The 56-commit branch was not bad luck; it was the predictable outcome of letting work accumulate.

**Implications:**

- Session start: `bd ready` → `bd show <id>` → `bd update <id> --status=in_progress`.
- Session close: push or it didn't happen (see Principle 1).
- If a single issue is producing more than ~2 commits' worth of change, that's a signal to file follow-up `bd` issues and ship what's done.
- Use `bd` for all task tracking. Do not use TodoWrite, TaskCreate, or markdown TODOs for project work. Use `bd remember` for persistent project knowledge, not MEMORY.md files.

### 6. User authority over agent initiative

Closing a story, marking it done, authorizing a `--no-verify` push, branching for a hotfix — these are user decisions, not agent decisions. Agents propose; the user disposes.

**Implications:**

- **Never close or mark a story `done` without explicit user approval.** The user decides when a story is closed.
- **Never authorize a bypass for yourself.** If a situation seems to call for `--no-verify`, a branch, or a skipped check, stop and ask. (The active exceptions block above is the only sanctioned bypass; new ones require a user-authored entry in that block.)
- **Never convert a beta blocker into deferred work** on your own authority.

### 7. Date-stamped exceptions over standing waivers

When a rule has to bend, name the reason, bound the scope, state the end condition, and put it in the **Active exceptions** section at the top of this file. Exceptions that aren't time-boxed quietly become defaults — that's how the 56-commit branch happened.

The active-exceptions block exists so that future-Claude (and future-you) can see at a glance what's _temporarily_ true vs. what's the standing rule. If you find yourself wanting to make an undocumented exception, the answer is "ask the user to add it to the block, or don't do it."

---

## Current sprint

### Active priority: Epic 21R — Beta Deployment Readiness Remediation

**Status:** `beta-deployment-readiness` is BLOCKED until the full readiness gate passes with no deferrals, bypasses, skipped beta tests, hidden/read-only beta routes, fake data, or mocked primary paths. (See Constitution §2.)

**Branch:** `master` (per Constitution §1)
**Next:** correct all 21R blockers, then rerun `bash scripts/check-beta-readiness.sh` end-to-end with all gates enabled.

### Project status snapshot

- Beta readiness: blocked by Epic 21R until all beta-live routes and primary actions are proven end-to-end
- Backend tests: 3617+ tests passing (226 suites), but beta-relevant bypass headers must be removed or excluded from readiness evidence
- E2E (Playwright): beta readiness must pass without skips or bypasses before tester signoff
- Deployment: Railway infrastructure exists; beta deployment blocked until 21R signoff
- Frontend: beta-facing surfaces must use real API data, real actions, and honest empty/error states only

### Session start checklist

```bash
git checkout master && git pull --rebase origin master
bd ready                              # find available work
bd show <id>                          # review issue before claiming
bd update <id> --status=in_progress   # claim before starting
```

### Session close checklist

```bash
git pull --rebase
bd dolt push
git push origin master                # --no-verify per active exception
git status                            # must show "up to date with origin"
```

Work is not complete until `git push` succeeds. Don't say "ready to push when you are" — push.

---

## Operational reference

### Stack conventions

- **ES modules only.** `import express from 'express'`; never `const express = require('express')`. The codebase is uniformly ESM; mixing breaks the loader.
- **Naming:** `camelCase` for variables/functions/properties; `PascalCase` for classes and React components; `kebab-case` for file names.
- **Backend module tests** live in `backend/modules/<domain>/__tests__/` (per Epic 21 Story 21-1 AC5). Top-level `backend/__tests__/` is reserved for cross-module integration tests and middleware sentinels. Full convention: `.claude/rules/CONTRIBUTING.md` § "Backend Module Conventions".

### Project structure

```
equoria/
├── backend/              # Node.js + Express
│   ├── modules/         # Domain modules (each owns __tests__/)
│   ├── controllers/     # Backward-compat shims (Epic 20)
│   ├── routes/          # API endpoints
│   ├── models/          # Data models
│   └── __tests__/       # Cross-module integration + middleware tests
├── frontend/            # React 19 browser game
│   └── src/
├── packages/database/   # Prisma ORM + PostgreSQL
└── .claude/             # Rules, skills, docs (loaded on demand)
```

### Quick commands

```bash
# Development
npm run dev                                  # dev server
npm test                                     # run tests
npm run lint:fix                             # auto-fix linting
npm test -- --watch                          # watch mode
npm test -- auth                             # specific pattern
npm test -- --detectOpenHandles              # debug leaks

# Beads
bd ready
bd show <id>
bd update <id> --status=in_progress
bd close <id>
bd sync
```

### MCP servers — call only when needed

Native tools are cheaper for everything except specialized cases. Avoid:

- `mcp__claude_ai_Stripe__*` — no payments in Equoria
- `mcp__claude_ai_Supabase__*` — uses Prisma + PostgreSQL directly
- `mcp__filesystem__*` — use `Read`/`Write`/`Edit`/`Glob`/`Bash(ls)` instead
- `mcp__serena__*` — use `Read`/`Grep`/`Glob`/`Edit` instead
- `mcp__git__*` — use `Bash(git ...)` instead
- `mcp__task-manager__*` — use `bd` instead

Call when actually useful: `context7` (library docs), `github` (PRs/issues), `postgres` (debug SQL), `playwright` (screenshots), `sequential-thinking` (complex arch), `chrome-dev-tools` (live browser).

### External documents

Load on demand via `/` skills — don't preload:

- `/security-guide` — full security documentation
- `/es-modules-guide` — ES Modules detailed guide
- `/contributing` — full contribution guidelines
- `/backend-api` — backend API layer documentation
- `/test-architecture` — testing strategy and patterns
- `/groom-system` — groom system implementation
- `/mcp-setup` — MCP server configuration
- `/agent-config` — agent and skill configuration
- `/deployment-guide` — production deployment procedures
- `/hyperresearch` — research vault workflow (CLI: `C:/Users/heirr/AppData/Local/Programs/Python/Python313/Scripts/hyperresearch.exe`, not on PATH)

Shipped epic deliverables (Epics 9A–20) and architectural decisions: `.claude/EPIC_HISTORY.md` and `docs/architecture/`. Read when changing a system whose history matters for the change.

### Dependency maintenance

Last audit: 2026-05-06 — 0 vulnerabilities across all packages. Detail and schedule: `.claude/DEPENDENCY_MAINTENANCE.md`.

Audit command (any idle session): `npm audit && cd backend && npm audit` (frontend: PowerShell `cd ../frontend; npm audit`).

Version bumps that change APIs (ESLint v8→v10, Jest v29→v30, TypeScript v5→v6, Express v4→v5, React Router v6→v7) are not casual maintenance — treat them as architectural changes that need a `bd` issue and a plan, not a "while I'm here" upgrade.

---

## When something doesn't fit

The constitution is the framework. When you hit a situation the principles don't obviously cover, reason from them rather than improvising a new rule. The Anthropic research that motivated this file's structure is clear that _principles survive pressure_ — when context fills up and earlier instructions drift out of attention, the values that produced the rules are what remains. If you're uncertain, the answer is almost always: ask the user, file a `bd` issue, and ship what's clearly safe.
