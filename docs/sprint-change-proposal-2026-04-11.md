# Sprint Change Proposal: Beta Deployment Readiness Course Correction

**Project:** Equoria  
**Date:** 2026-04-11  
**Prepared for:** Heirr  
**Workflow:** BMad Correct Course  
**Mode:** Batch  
**Change Type:** Major course correction blocking beta deployment  
**Approval:** Approved as written by Heirr on 2026-04-11

---

## 1. Issue Summary

The current project artifacts repeatedly claim that Equoria is production-ready, fully wired to live APIs, and suitable for launch preparation. The adversarial review found that this is not true enough for beta testers.

The primary problem is not isolated test failure. The problem is false confidence:

- Critical Playwright flows are allowed to pass while using test-only headers, `NODE_ENV=test`, and skipped scenarios.
- Production frontend code still contains player-facing mock data and mock APIs.
- Runtime test cleanup endpoints remain mounted in backend modules.
- Several "integration" tests mock the database, middleware, or service layer so heavily that they validate mocks rather than the deployed system.
- Current documentation and sprint status present work as complete while the real beta readiness risk is still open.

This is a deployment blocker. Beta testers should not be exposed to screens that appear playable but are backed by mock data, disabled placeholder controls, skipped workflows, or routes that only work under test-mode bypasses.

---

## 2. Trigger and Context

### Trigger

The user requested an adversarial senior web developer review before deploying to a select group of test users. The explicit concern was that previous work may have prioritized getting tests to pass quickly rather than ensuring the game works for real players.

### Course Correction Goal

Bring Equoria to a credible beta-testable state by replacing false-positive test confidence with production-parity gates:

- No beta-critical frontend screen may use in-source mock data or mock API behavior.
- No beta-critical E2E test may skip broken player flows.
- No beta-critical E2E test may depend on test-only CSRF or rate-limit bypass headers.
- No non-production deployment may expose runtime test cleanup routes.
- Test classification must reflect what the test actually proves.
- Beta scope must be narrowed to features that are actually wired end to end.

---

## 3. Findings Driving This Correction

### P0: E2E tests are not production-parity

Observed risks:

- `playwright.config.ts` starts the backend with `NODE_ENV=test`.
- `tests/e2e/global-setup.ts` uses `x-test-skip-csrf` and `x-test-bypass-rate-limit`.
- `tests/e2e/core-game-flows.spec.ts` and `tests/e2e/breeding.spec.ts` use test bypass headers.
- `test.skip()` is used in beta-critical flows, turning broken player journeys into passing test runs.

Why this matters:

Real players will not run the game with `NODE_ENV=test`, bypass headers, or skipped actions. These tests can pass while registration, login, training, breeding, competition entry, CSRF handling, or rate limiting fail in beta.

### P0: Production frontend contains mock-backed player experiences

Observed mock or placeholder locations:

- `frontend/src/pages/TrainingDashboardPage.tsx`: `allMockHorses`, `mockSummary`, and a `handleTrain` path that logs instead of completing a real training mutation.
- `frontend/src/pages/breeding/BreedingPredictionsPanel.tsx`: in-component `mockApi`.
- `frontend/src/components/foal/MilestoneEvaluationDisplay.tsx`: in-component `mockApi`.
- `frontend/src/components/foal/EnrichmentActivityPanel.tsx`: in-component `mockApi`.
- `frontend/src/components/traits/EpigeneticTraitDisplay.tsx`: in-component `mockApi`.
- `frontend/src/pages/MyStablePage.tsx`: `MOCK_STABLE`, `MOCK_HALL_OF_FAME`.
- `frontend/src/pages/CommunityPage.tsx`: `MOCK_RECENT_ACTIVITY`.
- `frontend/src/hooks/api/useTransactionHistory.ts`: empty stub response.
- `frontend/src/components/competition/CompetitionDetailModal.tsx`: horse selector and entry flow are placeholder or disabled.

Why this matters:

Players can reach UI that looks like gameplay but is not backed by their actual account, horses, economy, progression, or competition state. That invalidates beta feedback because testers will report on a simulation of the game rather than the game.

### P0: Runtime test cleanup endpoints are mounted

Observed risks:

- `backend/modules/grooms/routes/groomRoutes.mjs`: `/test/cleanup` is mounted and can delete groom interactions and assignments.
- `backend/modules/traits/routes/epigeneticTraitRoutes.mjs`: `/test/cleanup` is guarded only by `NODE_ENV !== 'production'`.

Why this matters:

Beta/staging environments are usually non-production by environment name. A route guarded only by "not production" can become available in beta and mutate real tester data.

### P1: Integration tests overuse mocks and are misclassified

Observed examples:

- `tests/integration/user.test.mjs`
- `backend/tests/integration/horseRoutes.test.mjs`
- `backend/modules/competition/__tests__/conformationShowExecution.test.mjs`

Why this matters:

Mock-heavy tests are useful as unit or component tests, but they do not prove routing, middleware, Prisma behavior, database constraints, auth cookies, CSRF, or transactions. Calling them integration tests overstates readiness.

### P1: Current artifact claims conflict with code reality

Conflicting artifact claims:

- `docs/product/PRD-UNIFIED-SUMMARY.md` claims production-ready status, backend 100%, frontend 100%, and full live API wiring.
- `docs/product/PRD-03-Gameplay-Systems.md` claims gameplay systems and frontend are complete.
- `docs/architecture.md` frames the frontend as a thin UI over a production-ready backend.
- `docs/architecture-frontend.md` describes API hooks and live route coverage as established architecture.
- `_bmad-output/project-context.md` still allows balanced mocking, E2E bypass headers, and graceful E2E skips.
- `docs/epic-21-test-quality-sprint.md` already identifies test-quality risks, but several relevant stories remain backlog or incomplete.

Why this matters:

The team is planning from optimistic documentation. The deployment decision must be based on actual production-parity evidence.

---

## 4. Epic and Sprint Impact Assessment

### Current sprint impact

Epic 21, "Test Architecture Quality Sprint," must remain active and be expanded. The current sprint status shows:

- `21-4-fix-e2e-breeding-spec-quality`: backlog
- `21-5-react-query-hook-tests`: backlog
- `21-6-reclassify-supertest-integration-tests`: backlog
- `21-8-e2e-credential-strategy-migration`: backlog
- `21-9-e2e-coverage-missing-features`: backlog

These are no longer optional or post-polish work. They are beta blockers.

### Impact on Epics 22-30

The Celestial Night frontend rebuild should continue only after beta-critical functional truth is restored. Visual polish and atmosphere are valuable, but they must not cover over mock-backed gameplay.

Recommended sprint change:

- Pause new polish-only work from Epics 23-30 until the beta readiness remediation gate is green.
- Allow only UI work that removes mock behavior, wires real API paths, or hides incomplete beta functionality.
- Treat Epic 22 navigation completion as allowed only if it improves access to real beta flows and does not expand fake surface area.

### Impact on Epics 31A-31F

Physical systems and genetics work may remain marked done at the engine/API level only if verified by real integration tests. Frontend exposure of those systems must not be considered beta-ready until connected to real API data without mocks.

### New epic required

Create a focused remediation epic before beta deployment:

**Epic 21R: Beta Deployment Readiness Remediation**

Purpose: remove false-positive readiness signals and establish production-parity beta gates.

---

## 5. Artifact Impact and Required Updates

### PRD updates

Required changes:

- Downgrade "production-ready" claims to "implementation complete in several domains; beta readiness blocked pending production-parity verification."
- Add a "Beta Deployment Readiness Gate" section.
- Define beta-critical journeys explicitly:
  - Register/login/logout/session refresh
  - Onboarding
  - Stable overview using real account data
  - Horse detail using real horse data
  - Training readiness and training execution
  - Competition browse/detail/entry/result where implemented
  - Breeding pair selection/prediction/action where implemented
  - Bank/balance/transaction visibility where implemented
  - Community surfaces only if backed by real APIs, otherwise hidden

Proposed replacement language:

```markdown
Equoria is not beta-deployable until beta-critical player journeys pass in a production-like environment without mock data, skipped E2E tests, test-only bypass headers, or runtime cleanup routes. Features that are not wired end to end must be hidden from beta navigation or clearly excluded from beta scope.
```

### Architecture updates

Required changes:

- Add a production-parity testing rule:
  - Playwright must run against the same auth, CSRF, cookie, CORS, and rate-limit behavior that beta users will hit.
- Add a test-only code boundary:
  - Test-only cleanup and bypass helpers may exist only in isolated test harnesses, not mounted runtime routes.
- Add an API integration contract:
  - Production frontend pages must use React Query hooks or typed API client methods. In-source `mockApi`, `MOCK_*`, or fake player data is not allowed in beta-facing routes.

### UX spec updates

Required changes:

- Add "Beta UI Truthfulness" as a UX principle:
  - If a screen cannot perform the advertised gameplay action with real account data, it must be hidden, disabled with a clear beta-excluded label, or converted to an informational locked state.
- Require empty, loading, error, and unavailable states for all beta-critical screens.
- Replace mock activity feeds and hall-of-fame sections with real data or "not in beta" states.

### Test architecture updates

Required changes:

- Reclassify tests by what they prove:
  - Unit: mocks are allowed.
  - Component: MSW is allowed for visual and state coverage.
  - Contract: mocked upstream is allowed only when validating exact request/response contracts.
  - Integration: must include real middleware and real database behavior unless explicitly named otherwise.
  - E2E: no test-only auth/security bypasses for beta-critical flows.
- Remove "graceful skip" language for beta-critical E2E tests.
- Add a failure rule:
  - If a beta-critical flow is not wired, the test must fail and block beta, not skip.

### Sprint status updates

Required changes:

- Add Epic 21R as `in-progress` or `backlog` immediately.
- Mark beta deployment as `blocked` until Epic 21R acceptance criteria pass.
- Move the existing Epic 21 backlog items that overlap with beta readiness under the beta blocker lane.

---

## 6. Recommended Path Forward

### Options considered

#### Option A: Direct adjustment only

Continue current sprint and patch mocks/bypasses opportunistically.

Rejected as insufficient. The issue is systemic enough that opportunistic fixes will leave documentation, sprint status, and release gates out of sync.

#### Option B: Rollback recent frontend work

Rollback broad UI work until all flows are known-good.

Rejected as too blunt. Much of the frontend and Celestial Night work can be preserved if fake data is removed or incomplete features are hidden.

#### Option C: MVP scope review plus remediation gate

Narrow the beta to real, wired functionality and add a dedicated remediation epic before test-user deployment.

Recommended. This preserves useful work while stopping false readiness from reaching testers.

### Recommended decision

Adopt Option C:

1. Freeze beta scope.
2. Add Epic 21R.
3. Remove or hide production mocks.
4. Rebuild E2E around production-parity behavior.
5. Remove runtime test cleanup routes.
6. Reclassify and strengthen integration tests.
7. Deploy to beta only after the readiness gate is green.

---

## 7. Detailed Change Proposal

### Epic 21R: Beta Deployment Readiness Remediation

#### Story 21R-1: Define beta scope and navigation truth table

Owner: LeadArchitect + PM/SM  
Priority: P0  
Purpose: decide which screens are truly available to beta users.

Implementation artifact: `docs/beta-route-truth-table.md`

Tasks:

- Create a beta route inventory for all authenticated routes.
- Mark each route as `beta-live`, `beta-hidden`, or `beta-readonly`.
- For every `beta-live` route, list the required API endpoints and player actions.
- Update navigation so beta testers cannot reach fake or unsupported gameplay.
- Update PRD and UX docs to reflect beta scope.

Acceptance criteria:

- Every nav item has an explicit beta status.
- No route marked `beta-live` contains player-facing mock data.
- No route marked `beta-live` has primary gameplay actions that only log, no-op, or remain placeholder-disabled.

#### Story 21R-2: Remove production frontend mocks from beta-facing code

Owner: FrontendSpecialistAgent  
Priority: P0  
Purpose: replace fake gameplay surfaces with real API integration or hide them from beta.

Target files:

- `frontend/src/pages/TrainingDashboardPage.tsx`
- `frontend/src/pages/breeding/BreedingPredictionsPanel.tsx`
- `frontend/src/components/foal/MilestoneEvaluationDisplay.tsx`
- `frontend/src/components/foal/EnrichmentActivityPanel.tsx`
- `frontend/src/components/traits/EpigeneticTraitDisplay.tsx`
- `frontend/src/pages/MyStablePage.tsx`
- `frontend/src/pages/CommunityPage.tsx`
- `frontend/src/hooks/api/useTransactionHistory.ts`
- `frontend/src/components/competition/CompetitionDetailModal.tsx`

Tasks:

- Replace `mockApi`, `MOCK_*`, and hardcoded player state with real React Query hooks or typed API client methods.
- Where backend endpoints are missing, remove the route from beta navigation or render a clear beta-excluded state.
- Replace no-op handlers with real mutations or remove the action from beta.
- Add component tests for empty, loading, error, and success states.

Acceptance criteria:

- `rg -n "mockApi|MOCK_|allMockHorses|mockSummary" frontend/src` returns no beta-facing production matches.
- Training, stable, breeding, competition, community, and transaction surfaces either use real APIs or are excluded from beta.
- No beta-facing primary action is implemented as `console.log`, no-op, or permanent placeholder.

#### Story 21R-3: Remove E2E skips and test-only bypasses from beta-critical flows

Owner: QualityAssuranceAgent  
Priority: P0  
Purpose: make Playwright fail when the game fails for real players.

Target files:

- `playwright.config.ts`
- `tests/e2e/global-setup.ts`
- `tests/e2e/core-game-flows.spec.ts`
- `tests/e2e/breeding.spec.ts`
- `frontend/src/lib/api-client.ts`
- `backend/middleware/csrf.mjs`
- `backend/middleware/rateLimiting.mjs`

Tasks:

- Run E2E backend in a beta-like environment, not generic `NODE_ENV=test`.
- Remove `x-test-skip-csrf` and `x-test-bypass-rate-limit` from Playwright setup and specs.
- Acquire CSRF tokens the same way the frontend does in beta.
- Use realistic rate-limit-safe test account setup instead of disabling rate limiting.
- Replace `test.skip()` on beta-critical flows with failing tests and backlog tickets.
- Keep test-only bypasses only for lower-level test harnesses if still needed, never E2E.

Acceptance criteria:

- `rg -n "test.skip\\(" tests/e2e` returns no beta-critical skips.
- `rg -n "x-test-skip-csrf|x-test-bypass-rate-limit" tests/e2e frontend/src/lib/api-client.ts` returns no matches.
- E2E registration/login/onboarding/stable/training paths pass without security bypass headers.
- Any unwired beta-critical feature fails the E2E gate instead of being skipped.

#### Story 21R-4: Remove or harden runtime test cleanup routes

Owner: BackendSpecialistAgent + SecurityArchitect  
Priority: P0  
Purpose: prevent accidental deletion or mutation of beta tester data.

Target files:

- `backend/modules/grooms/routes/groomRoutes.mjs`
- `backend/modules/grooms/controllers/groomController.mjs`
- `backend/modules/traits/routes/epigeneticTraitRoutes.mjs`
- Any additional `/test/cleanup` route discovered by search.

Tasks:

- Remove mounted runtime cleanup routes from backend modules.
- Move cleanup logic into isolated test utilities or scripts that are not reachable through HTTP.
- If a route must remain for local development, require an explicit local-only flag and ensure it cannot run in beta/staging.
- Add route inventory tests that fail if `/test/cleanup` is mounted.

Acceptance criteria:

- `rg -n "test/cleanup|cleanupTestData" backend/modules backend/routes` returns no mounted runtime route.
- Beta/staging cannot reach cleanup operations over HTTP.
- Automated test coverage proves cleanup endpoints are not registered.

#### Story 21R-5: Reclassify and strengthen integration tests

Owner: QualityAssuranceAgent + BackendSpecialistAgent  
Priority: P1  
Purpose: make test names match test confidence.

Target examples:

- `tests/integration/user.test.mjs`
- `backend/tests/integration/horseRoutes.test.mjs`
- `backend/modules/competition/__tests__/conformationShowExecution.test.mjs`

Tasks:

- Audit all files under `tests/integration` and `backend/**/integration`.
- Move mock-heavy tests to unit/component categories or rename them explicitly.
- Add real database integration coverage for beta-critical API flows.
- Verify auth middleware, CSRF, Prisma constraints, transactions, and response shapes in integration tests.
- Keep mocks only at true external boundaries.

Acceptance criteria:

- No test called "integration" mocks the primary database/service/middleware path it claims to validate.
- Beta-critical backend APIs have real database tests.
- Test docs define the allowed mocking boundary by test type.

#### Story 21R-6: Add beta deployment readiness gate

Owner: LeadArchitect + QualityAssuranceAgent + SecurityArchitect  
Priority: P0  
Purpose: create a single go/no-go checklist for selected tester deployment.

Tasks:

- Add a beta readiness script or documented command sequence.
- Include lint, typecheck, unit, real integration, production-parity E2E, security route scan, and mock scan.
- Produce a release candidate report with pass/fail status.
- Require explicit signoff before inviting test users.

Acceptance criteria:

- Beta release candidate cannot be marked ready unless all gates pass.
- Gate includes grep-style scans for mocks, skips, bypass headers, and cleanup routes.
- Gate output is short enough to be reviewed before deploy.

---

## 8. Implementation Handoff

### Recommended agent routing

- EquoriaLeadArchitect: own scope freeze, artifact updates, and readiness gate definition.
- QualityAssuranceAgent: own E2E parity, skip removal, test classification, and readiness report.
- FrontendSpecialistAgent: own production mock removal and route truthfulness.
- BackendSpecialistAgent: own cleanup route removal and real integration tests.
- SecurityArchitect: own CSRF/rate-limit parity and beta environment hardening.
- UIUXProductDesigner: own beta-hidden and beta-readonly states so testers are not misled.

### Suggested execution order

1. Create Epic 21R and update sprint status.
2. Build beta route truth table.
3. Remove or hide beta-facing frontend mocks.
4. Remove E2E bypasses and skips.
5. Remove runtime cleanup endpoints.
6. Reclassify integration tests and add real database coverage.
7. Run readiness gate in a beta-like environment.
8. Only then deploy to selected testers.

### Estimated effort

Rough effort: 7-12 focused engineering days, depending on how many mock-backed screens are hidden versus fully wired.

Recommended minimum beta path: 5-7 days if scope is aggressively narrowed to login, onboarding, stable, horse detail, and one or two verified gameplay loops.

---

## 9. Beta Readiness Gate

The beta deployment gate must pass all of the following:

### Code scans

```powershell
rg -n "mockApi|MOCK_|allMockHorses|mockSummary" frontend/src
rg -n "test.skip\\(" tests/e2e
rg -n "x-test-skip-csrf|x-test-bypass-rate-limit" tests/e2e frontend/src/lib/api-client.ts
rg -n "test/cleanup|cleanupTestData" backend/modules backend/routes
```

Expected result:

- No beta-facing production mock matches.
- No beta-critical E2E skips.
- No E2E/client test-bypass headers.
- No mounted runtime cleanup route.

### Required automated checks

- Frontend lint and typecheck pass.
- Backend lint and module validation pass.
- Unit tests pass.
- Real database integration tests pass for beta-critical APIs.
- Playwright E2E passes in production-like beta mode.
- Security scan confirms CSRF and rate limiting are active.

### Required manual checks

- New user can register and complete onboarding.
- Returning user can log in and resume session.
- Player sees only real account-owned horses and real account data.
- Training either completes successfully with real mutation or is excluded from beta.
- Competition entry either completes successfully with real mutation or is excluded from beta.
- Breeding either completes successfully with real mutation or is excluded from beta.
- Bank/transactions either show real data or are excluded from beta.
- Community screens either show real data or are excluded from beta.

---

## 10. Checklist Results

### Section 1: Trigger and context

- Trigger identified: adversarial readiness review before selected-user beta.
- Problem statement documented: tests and docs can pass while real player flows fail.
- User impact documented: beta testers may encounter fake, skipped, or bypass-only gameplay.

Status: Complete

### Section 2: Epic impact assessment

- Current Epic 21 impact documented.
- Epics 22-30 impact documented.
- Epics 31A-31F verification impact documented.
- New remediation epic proposed.

Status: Complete

### Section 3: Artifact conflict and impact

- PRD conflicts documented.
- Architecture conflicts documented.
- UX spec conflicts documented.
- Test architecture conflicts documented.
- Sprint status conflicts documented.

Status: Complete

### Section 4: Path forward evaluation

- Direct adjustment evaluated and rejected.
- Rollback evaluated and rejected.
- MVP scope review plus remediation gate selected.

Status: Complete

### Section 5: Sprint Change Proposal components

- Issue summary included.
- Impact analysis included.
- Recommended approach included.
- Detailed change proposal included.
- Implementation handoff included.

Status: Complete

### Section 6: Final review and handoff

- Proposal reviewed by Heirr.
- Heirr approved the proposal as written on 2026-04-11.
- Route implementation through Epic 21R before beta deployment.

Status: Complete

---

## 11. Approval Decision

Decision:

- Approved as written by Heirr on 2026-04-11.
- Create Epic 21R immediately.
- Keep beta deployment blocked until the readiness gate passes.

Handoff:

- Scope classification: Major
- Route to: Product Manager / Solution Architect for backlog replan, with QA, Security, Frontend, and Backend ownership on Epic 21R stories.
