# Equoria - Claude Code Configuration

**Version:** 3.4.0
**Last Updated:** 2026-05-04
**Project:** Web browser-based horse breeding simulation game

---

## 🚨 NON-NEGOTIABLE WORKFLOW RULES (User Mandate, 2026-05-04)

These rules override every other workflow guidance in this file or any session-start hook. Established after a 62-commit rebase nightmare to master that should never have happened.

### 1. MAIN ONLY. No feature branches.

- Every session starts with `git checkout master && git pull --rebase origin master`.
- Every `bd` issue lands as ONE small commit (or two if test-then-fix) **directly on master**, pushed same-session.
- Never open a feature branch. Never accumulate work for "later landing." If a change is too big for one commit, it's too big for one session — split it.
- The push command is `git push origin master`. If branch protection blocks the push, report it — DO NOT detour onto a side branch.
- The user must SEE changes on Railway as we go. Branches that don't deploy don't count.

### 2. REAL DB ONLY. No test database.

- `.env.test` points at the canonical Equoria DB. Tests run against production data.
- Test fixtures must coexist with real game state — never assume test data dominates leaderboards, counts, ordering, etc. Filter by name pattern or unique IDs, not relative position.
- Cleanup logic must be SCOPED (`prisma.X.deleteMany({ where: { name: { startsWith: 'TestFixture-' } } })`), never broad. A loose cleanup pattern wipes real user data.
- Backend test cleanup that uses raw `deleteMany()` without a where-clause is forbidden.
- This is the user's explicit choice. Risks acknowledged. Do not propose reverting to a test DB.

### 3. NO LONG-LIVED BRANCHES. EVER.

- `fix/*`, `feature/*`, `epic-*`, etc. branches are forbidden going forward.
- The only exception is a hotfix that requires staged rollback infrastructure (e.g., a major schema migration) — and even that requires explicit user authorization at the start of the work.
- If you find yourself thinking "I'll just commit this on a branch and merge later," STOP. Land it on master or don't do it.

### 4. PRE-PUSH HOOK SLOWNESS IS THE COST OF SAFETY.

- The pre-push hook runs the full backend Jest suite (~10 min). That's intentional.
- Bypass with `--no-verify` ONLY when the user has explicitly authorized it for THIS specific push (not as a standing waiver).
- A failing pre-push test is a real signal. Fix the test or the code; don't bypass by default.

### 5. ONE PUSH AT A TIME.

- Never run two `git push` processes in parallel. They lock contention each other and one will silently fail.
- If a push appears stuck, check the pre-push hook output before starting another.

### Why these rules exist

The 2026-05-04 incident: 56 commits accumulated on `fix/21r-security-hardening-corrected` over weeks because each session built on the prior session's branch instead of branching off master. Result: a multi-hour rebase with architectural conflicts (master and branch had parallel security-middleware refactors with different APIs), forced `--no-verify` push to bypass a leaderboard test that was brittle to real-DB drift, and bypass of 24 required CI status checks to land everything at once. None of those failure modes existed if the work had landed in small same-session commits.

---

## 🎯 Current Sprint

### Active Priority: Epic 21R — Beta Deployment Readiness Remediation

- **Status:** `beta-deployment-readiness` is BLOCKED until the full readiness gate passes with no deferrals, bypasses, skipped beta tests, hidden/read-only beta routes, fake data, or mocked primary paths.
- **Branch:** `master`
- **Next:** Correct all 21R blockers, then rerun `bash scripts/check-beta-readiness.sh` end to end.

### 21R Beta Readiness Doctrine — No Deferrals

Active beta means testers can use every beta-live feature through real UI and real backend behavior. Agents must not downgrade a broken beta feature into a placeholder, hidden route, read-only route, graceful skip, or documentation caveat.

- **No beta-hidden.** If a route is in beta scope, it remains visible and must work. Hiding it is a product removal decision, not an implementation shortcut.
- **No beta-readonly.** If a tester can reach a feature with write actions, those actions must call real APIs and persist real state or return a real backend eligibility/error reason.
- **No graceful skips.** Do not use `test.skip`, `it.skip`, `describe.skip`, `test.fixme`, conditional E2E skips, or "skip if missing infra" behavior for beta-relevant coverage.
- **No bypass evidence.** Do not cite tests that use `x-test-skip-csrf`, `x-test-bypass-auth`, `x-test-bypass-rate-limit`, `x-test-user`, `x-test-bypass-ownership`, `VITE_E2E_TEST`, or route interception as beta readiness evidence.
- **No fake product values.** Do not display TODO actions, no-op handlers, `console.log` primary actions, hardcoded IDs, fabricated estimates, placeholder dates, local-only account settings, or "Unknown/0" values that masquerade as real data.
- **No mock primary paths.** Production/beta-facing frontend code must not use `MOCK_`, `mockApi`, `allMockHorses`, `mockSummary`, seeded fake players, or fake metrics outside tests.
- **No "not readiness evidence" loophole.** If a beta-live path exists in the repo and is broken, skipped, bypassed, mocked, hidden, or read-only, it is a defect to fix or a product-scope removal to explicitly document.
- **No false green status.** Do not mark 21R stories or `beta-deployment-readiness` done until the actual commands have been run and the evidence is recorded.

Required final signoff command:

```bash
bash scripts/check-beta-readiness.sh
```

The command must run with all gates enabled. It must not accept skip flags. Any environment that cannot run the full gate cannot produce beta-readiness signoff.

### Epic 20 Deliverables (2026-03-05)

- `backend/modules/` — 18 domain modules: auth, users, horses, breeding, traits, training, competition, grooms, riders, trainers, community, services, leaderboards, admin, docs, health, labs
- Backward-compat shims at `backend/routes/` and `backend/controllers/` — zero test breakage
- `backend/docs/swagger.yaml` — enhanced with `/api/v1` servers + community endpoints
- `frontend/src/lib/api-client.ts` — all 57 endpoints updated to `/api/v1/` prefix
- `docs/architecture/ARCH-01-Overview.md` — updated with new module structure

### Epic 18 Deliverables

- `frontend/src/components/ui/GallopingLoader.tsx` — Animated horse Suspense fallback (replaces CSS spinner in App.tsx)
- `frontend/src/components/ui/FenceJumpBar.tsx` — XP progress bar with fence markers at 25/50/75/100% + jumping 🐎
- `frontend/src/components/feedback/CinematicMoment.tsx` — Fullscreen overlay for trait-discovery / foal-birth / cup-win
- `frontend/src/components/feedback/LevelUpCelebrationModal.tsx` — Ribbon unfurl banner behind trophy (18-3)
- `frontend/src/components/horse/XPProgressBar.tsx` — Uses FenceJumpBar for XP fill (18-2)
- `frontend/src/components/competition/PrizeNotificationModal.tsx` — CinematicMoment for 1st-place wins (18-4)
- `frontend/src/components/foal/FoalDevelopmentTracker.tsx` — CinematicMoment on trait reveal (18-4)
- `frontend/src/pages/breeding/BreedingPairSelection.tsx` — CinematicMoment on foal birth (18-4)
- `frontend/src/index.css` — All 18 keyframes + .btn-cobalt horseshoe ::before/::after (18-5)

### Epic 17 Deliverables (Hybrid Onboarding Tutorial + Z-Index Token System)

- Z-index token system in `tokens.css` — `--z-*` variables replacing magic numbers
- Onboarding tutorial overlay system integrated with Epic 16 OnboardingPage

### Epic 16 Deliverables

- `backend/controllers/inventoryController.mjs` — GET /api/inventory, POST /equip, POST /unequip (JSONB-based)
- `backend/routes/inventoryRoutes.mjs` — Inventory routes with auth
- `frontend/src/hooks/api/useInventory.ts` — useInventory / useEquipItem / useUnequipItem
- `frontend/src/pages/InventoryPage.tsx` — Live API, HorsePicker modal for tack equip
- `frontend/src/pages/OnboardingPage.tsx` — 3-step wizard (Welcome → Starter Kit → Ready)
- `frontend/src/components/auth/OnboardingGuard.tsx` — Redirect if `completedOnboarding === false`
- `frontend/src/App.tsx` — OnboardingGuard + `/onboarding` route added
- `frontend/public/placeholder.svg` — Celestial Night horse silhouette SVG
- `frontend/public/assets/horses/README.md` — Art asset naming conventions

### Epic 14 Deliverables

- `Dockerfile` — Multi-stage: `frontend-builder` (Vite) → `production` (Express + embedded SPA)
- `railway.toml` — Railway build + deploy config; `prisma migrate deploy` before server start
- `backend/app.mjs` — `express.static(public/)` + SPA `index.html` fallback (production only)
- `frontend/src/lib/api-client.ts` — `VITE_API_URL ?? ''` for relative API URLs
- `frontend/src/lib/sentry.ts` — `initSentry()` + `SentryErrorBoundary` (opt-in via env var)
- `frontend/src/App.tsx` — Sentry ErrorBoundary wrapper
- `frontend/vite.config.ts` — `rollup-plugin-visualizer` → `dist/bundle-stats.html`
- `.github/workflows/ci-cd.yml` — Jobs 10 (Docker smoke test) + 11 (Lighthouse CI)
- `.lighthouserc.yml` — Lighthouse CI thresholds (a11y error ≥0.85, perf warn ≥0.6)
- `docs/deployment/RAILWAY_SETUP.md` — Step-by-step Railway setup guide

### Epic 13 Deliverables

- `TrainersPage.tsx` (`/trainers`) — Two tabs: Manage / Hire, World sub-location
- `TrainerList.tsx` — 6 mock trainers, filters, hire buttons disabled
- `MyTrainersDashboard.tsx` — 2 hired trainers, slot counter, expandable career/discovery
- `trainer/TrainerPersonalityBadge.tsx` — 5 personalities (focused/encouraging/technical/competitive/patient)
- `trainer/TrainerPersonalityDisplay.tsx` — Discipline tendencies + horse compatibility
- `trainer/TrainerAssignmentCard.tsx` — Assigned horse chip with disabled unassign
- `trainer/TrainerCareerPanel.tsx` — XP bar, milestones, retirement warning
- `trainer/TrainerDiscoveryPanel.tsx` — 3 categories × 2 discovery slots
- `WorldHubPage.tsx` — Added 9th location card (Trainers 🎓)
- `nav-items.tsx` — `/trainers` route registered (icon: null)

### Epic 11 Deliverables

- `CommunityPage.tsx` (`/community`) — Hub with 3 feature cards + activity feed
- `MessageBoardPage.tsx` (`/message-board`) — 5 section tabs, mock threads, "New Post" disabled
- `ClubsPage.tsx` (`/clubs`) — Discipline clubs, breed clubs, governance + elections
- `MessagesPage.tsx` (`/messages`) — Inbox/Sent tabs, unread badge, "Compose" disabled
- `MainNavigation.tsx` — Bell → Link to /messages, "Community" added to nav
- `nav-items.tsx` — 4 new routes registered

### Epic 12 Deliverables

- `BankPage.tsx` (`/bank`) — Balance card, weekly claim, transaction history
- `InventoryPage.tsx` (`/inventory`) — Category filter, item grid, equip buttons (mock-ready)
- `MyStablePage.tsx` (`/my-stable`) — Stable profile + Hall of Fame tabs
- `HorseDetailPage.tsx` — Added Pedigree, Health & Vet, Stud / Sale tabs (parchment theme)
- `HorseDetailPage.tsx` — Sticky bottom action bar (Feed/Train/Breed/Assign/List)

### Project Status

- ⚠️ **Beta readiness:** blocked by Epic 21R until all beta-live routes and primary actions are proven end to end.
- ⚠️ **Backend tests:** many suites exist, but beta-relevant bypass headers must be removed or excluded from readiness evidence.
- ⚠️ **E2E Tests:** Playwright beta readiness must pass without skips or bypasses before tester signoff.
- ⚠️ **Deployment:** Railway infrastructure exists, but beta deployment is blocked until 21R signoff.
- ⚠️ **Frontend:** beta-facing surfaces must use real API data, real actions, and honest empty/error states only.

### Session Start Checklist

```bash
bd ready            # ALWAYS run this first — find available work
bd show <id>        # Review issue before claiming
bd update <id> --status=in_progress  # Claim before starting
```

---

## 🚨 Non-Negotiable Process Rules

### Fix Discipline — Two Rules That Apply To Every Defect-Fix

These are the contract for ANY defect fix, hardening issue, or PR addressing reviewer feedback. Both load as session context.

- **`.claude/rules/EDGE_CASE_FIX_DISCIPLINE.md`** — prevents bypasses (no skips, no continue-on-error, no widened regex, no exclusion-as-cheat, no silent catches in security boundaries). Read it before claiming any 21R-\* issue.
- **`.claude/rules/OPTIMAL_FIX_DISCIPLINE.md`** — prevents shallow fixes (AC met but problem not actually solved). Requires: AC audit, sentinel-positive test, adjacent-locations check, no forward-reference docs, alternative considered, what-was-NOT-done report. **"Done" is the §8 checklist, not the literal AC.**

If you find yourself thinking "AC met, ship it" — stop and re-read `OPTIMAL_FIX_DISCIPLINE.md` §1, §2, §6. Cheap-default ≠ correct-default.

### BMad Methodology — Follow By The Book

- **NEVER fabricate audit outputs.** TEA gates (ATDD/TA/RV) and code review findings MUST be produced by running the actual skills (`bmad-tea`, `bmad-code-review`). Writing sections directly into story artifacts without running the skills is strictly forbidden.
- **NEVER close or mark a story `done` without explicit user approval.** The user decides when a story is closed — not Claude.
- **NEVER skip a required workflow step.** If a step has a skill, run the skill. If a step requires user input, stop and ask.
- **Quality and methodology adherence are non-negotiable.** Shortcuts that produce the appearance of compliance without the substance are not acceptable.
- **NEVER convert a beta blocker into deferred work.** For Epic 21R, "remaining risk", "legacy but not readiness evidence", "graceful skip", "temporarily hidden", "read-only for beta", and "follow-up later" are not acceptable closure language.
- **NEVER update readiness status from intent.** Only update sprint status, signoff files, or story completion after verifying the real code and recording the command evidence.

---

## ⚡ Core Rules (Essential Only)

### ES Modules Only

```javascript
// ✅ ALWAYS
import express from 'express';
export default myFunction;

// ❌ NEVER
const express = require('express');
module.exports = myFunction;
```

### Naming Standards

- camelCase: variables, functions, properties
- PascalCase: classes, React components
- kebab-case: file names

### Testing Philosophy

- **No mocks. Ever.** All backend tests run against the real test database. No mocked Prisma calls. A test that passes while hiding a broken feature is worse than no test.
- **Integration by default:** Backend tests call real controllers, real services, real DB. Mocking a DB call is testing nothing.
- **Frontend unit tests:** Existing tests with mocked API responses may remain. Do NOT add new `vi.mock`-of-API-client tests. Prefer Playwright E2E for all new user-facing feature coverage.
- **E2E tests (Playwright):** Real credentials, real backend, real DB. No bypass headers, no `x-test-user`, no route interception to add bypasses, and no `test.skip` on beta-critical paths.
- **Beta-relevant backend tests:** Do not use CSRF, auth, ownership, or rate-limit bypass headers as readiness evidence. If a helper still injects those headers, either replace it with a real-token helper or keep that suite out of beta-readiness claims until fixed.
- **Fail fast:** Tests must fail immediately when the real implementation is broken — not be silenced by mocked return values.
- **Backend:** 3617+ tests passing (226 suites)
- **Frontend:** Vitest + React Testing Library (component behavior); Playwright E2E (full-stack coverage)
- **E2E:** Playwright (Epic 9A-2) — `tests/e2e/`

### Issue Tracking

Use `bd` commands (not markdown TODOs):

```bash
bd ready              # Find available work
bd create "Task"      # Create issue
bd update ID --status in_progress
bd close ID           # Mark complete
```

---

## 🔌 MCP Server Rules (Token Savings)

**NEVER call these — irrelevant to Equoria, wastes ~14K tokens:**

- `mcp__claude_ai_Stripe__*` (31 tools) — no payments in Equoria
- `mcp__claude_ai_Supabase__*` (29 tools) — uses Prisma + PostgreSQL directly

**NEVER call these — native tools are cheaper:**

- `mcp__filesystem__*` → use `Read`/`Write`/`Edit`/`Glob`/`Bash(ls)`
- `mcp__serena__*` → use `Read`/`Grep`/`Glob`/`Edit`
- `mcp__git__*` → use `Bash(git ...)`
- `mcp__task-manager__*` → use `bd` commands

**Call only when needed:** `context7` (library docs), `github` (PRs/issues), `postgres` (debug SQL), `playwright` (screenshots), `sequential-thinking` (complex arch), `chrome-dev-tools` (live browser)

Full guide: `/mcp-guide`

---

## 📚 Documentation Skills (Call When Needed)

Use `/` commands to load detailed docs:

### Security & Standards

- `/security-guide` - Full security documentation (SECURITY.md)
- `/es-modules-guide` - ES Modules detailed guide
- `/contributing` - Full contribution guidelines

### Architecture & Systems

- `/backend-api` - Backend API layer documentation
- `/test-architecture` - Testing strategy & patterns
- `/groom-system` - Groom system implementation

### Configuration

- `/mcp-setup` - MCP server configuration guide
- `/agent-config` - Agent & skill configuration
- `/deployment-guide` - Production deployment procedures

---

## 🚀 Quick Commands

### Development

```bash
npm run dev          # Start dev server
npm test            # Run tests
npm run lint:fix    # Auto-fix linting
```

### Testing

```bash
npm test -- --watch                    # Watch mode
npm test -- auth                       # Specific pattern
npm test -- --detectOpenHandles        # Debug leaks
```

### Beads Workflow

```bash
bd ready            # Available tasks
bd show ID          # Task details
bd sync             # Sync with remote
```

---

## 📁 Project Structure

```
equoria/
├── backend/              # Node.js + Express (100% complete)
│   ├── controllers/      # Business logic
│   ├── routes/          # API endpoints
│   ├── models/          # Data models
│   └── __tests__/       # 468+ tests
├── frontend/            # React 19 browser game (Epic 18+ shipped — see Epic Deliverables)
│   └── src/
├── packages/database/   # Prisma ORM + PostgreSQL
└── .claude/            # Documentation (call via skills)
```

---

## 🔧 Recent Epic Highlights

Active priority is **Epic 21R — Beta Deployment Readiness Remediation** (see top of file).

For shipped Epic deliverables (9A → 18), see the **Epic Deliverables** sections above and `git log`. Epics 9A/9B/9C/11/12/13/14/16/17/18 are all closed.

---

## 🆘 Emergency Contacts

**Test Failures:** Check balanced mocking (external deps only)
**Import Errors:** Ensure `.js` extensions, ES modules only
**Context Issues:** Use skills (`/security-guide`) instead of loading full docs

---

**For detailed documentation, use `/` skills above.**
**Full docs in `.claude/` - don't load manually unless debugging.**

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->

## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
