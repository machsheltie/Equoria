# TODO List — Equoria

**Last Updated:** 2026-03-13
**Current Phase:** Celestial Night UI Rebuild (Epics 22–30 + BACKEND-A + BACKEND-B)

---

## CRITICAL — Must Fix Before Next Push

### Lint Warnings in WIP Celestial Night Code (6 warnings, 0 errors)
- [ ] `frontend/src/components/onboarding/BreedSelector.tsx:31` — `value` → `_value`
- [ ] `frontend/src/components/training/DisciplineSelector.tsx:144` — `discipline` → `_discipline`
- [ ] `frontend/src/contexts/AuthContext.tsx:62` — `role` → `_role`
- [ ] `frontend/src/contexts/AuthContext.tsx:64` — `roles` → `_roles`
- [ ] `frontend/src/pages/CompetitionResultsPage.tsx:221` — remove or use `performanceView`
- [ ] `frontend/src/pages/OnboardingPage.tsx:91` — `v` → `_v`

### GitHub Token Hygiene
- [ ] **Revoke both PAT tokens** shared in chat on 2026-03-12 (exposed in conversation history)
- [ ] **Remove `GITHUB_TOKEN` env var** from shell profile — it overrides `gh auth` and causes 403s
- [ ] Verify `gh auth status` uses `machsheltie` account after cleanup

---

## HIGH PRIORITY — Celestial Night Phase

### Backlog Stories (not yet started)
- [ ] **BA.5** — Milestones JSONB (backend schema + seed data for foal milestones)
- [ ] **BB.2** — Age-Evolving Activities (frontend foal activity UI by age stage)
- [ ] **BB.3** — Milestone Detection (backend logic to auto-detect & award milestones)
- [ ] **30.5** — Accessibility Audit (WCAG 2.1 AA compliance pass on all new pages)
- [ ] **30.6** — Bundle Size Audit (verify Vite chunk sizes, tree-shaking, code splitting)

### In-Progress Stories — AC Verification Needed
All 29 stories marked `in-progress` in `sprint-status.yaml` need:
- [ ] Acceptance criteria walkthrough against implementation
- [ ] Vitest/Playwright test coverage for new components
- [ ] Visual QA in browser (Celestial Night theme rendering)

### Sprint Planning Completion
- [ ] **Step 5: Validate and report** — sprint planning workflow not yet finalized
- [ ] Review `docs/sprint-artifacts/sprint-status.yaml` for accuracy after AC verification

---

## MEDIUM PRIORITY — Technical Debt

### Prisma Migration Cleanup
- [ ] Verify `20260312180554_add_show_status_and_entries` migration applied cleanly in all envs
- [ ] Confirm `ShowStatus` enum, `ShowEntry` table, `AgeStage` enum all functional

### Test Health
- [ ] Monitor `databaseOptimization.test.mjs` p95 timing (known flaky)
- [ ] Monitor `groomBondingIntegration.test.mjs` stall_care (known flaky)
- [ ] Current: 230 suites, 3671 tests passing

### Documentation
- [ ] Update session briefing if any architectural decisions change
- [ ] Keep `sprint-status.yaml` in sync as stories complete

---

## COMPLETED (Recent)

- [x] **2026-03-12** — Fix 80 test failures (graduateFoal mock, Show schema migration, cooldown edge case)
- [x] **2026-03-12** — Fix GitHub push 403 (unset GITHUB_TOKEN env var)
- [x] **2026-03-12** — Commit Celestial Night tech spec + wireframes + epics (`90fe77ce`)
- [x] **2026-03-12** — Commit full UI rebuild + backend extensions (`1b9dc9e1`, `dd9960c2`)
- [x] **2026-03-12** — Sprint planning Steps 0.5–4 complete (sprint-status.yaml populated)
- [x] **2026-03-05** — Epic 20 Backend Architecture Refactor (18 domain modules)
- [x] **2026-03-05** — Epic 21 Horse Marketplace (`950b939d`)
- [x] **2026-03-02** — Epic 19A Security Hardening
- [x] **2026-03-02** — Epic 19B Community System (forums, messages, clubs, elections)
