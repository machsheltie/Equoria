# Equoria — Full Spec-vs-Code Audit

**Date:** 2026-07-02
**Method:** 11 parallel domain auditors, each read the relevant PRDs / epics / tech-specs / sprint artifacts, then deep-traced the corresponding backend (controller→service→route→schema) and frontend (page→hook→api) + tests. Read-only; no test suite executed; every finding cites `file:line`.
**Scope decisions (defaults, awaiting user confirmation):** committed scope; deep code-trace; explicitly-deferred/future work listed separately, not counted as a gap.

**Gap categories:** **A** = never built · **B** = partial / built-but-unreachable · **C** = incorrect / diverges from spec · **D** = false-closed / dead code / false-green claim.

---

## Executive summary

The project is **far more complete than its tracking docs claim** — `sprint-status.yaml` is largely stale (e.g. Epic 31E genetics marked `backlog` while fully shipped; Epic 22/30 frontend marked `backlog` while built). The security posture, marketplace, breeding genetics, clubs/messaging, and economy shops are genuinely real and wired.

The gaps cluster into three shapes:

1. **Beta is BLOCKED by infra, not features** — a failed production migration, an un-restored master gate, residual CI red, and a stale green sign-off record. These are already tracked in `bd` and are **user-gated**.
2. **"Built but not wired" false-closures** — the dominant functional pattern. Many Epic 7 (groom) and other components have passing isolation tests and mounted backends, but no page renders them / no hook connects them. They were marked `completed` on component-test evidence. Players can't reach them.
3. **A few genuinely broken live paths** — competition awards no progression, competition results never load, trainers have no training effect, exotic trait triggers can never fire, ProfilePage stats read 0. These are the highest-value fixes.

**Beta-readiness verdict: BLOCKED** (4 P0 items, all infra/process, mostly user-gated).

Totals: **4 P0 · 9 P1 · ~24 P2 · ~28 P3**, plus ~6 cleanup/orphan items and pervasive doc staleness.

---

## P0 — Beta blockers (infra/process; mostly user-gated)

### P0-1 · Production migration recorded FAILED → Railway deploys blocked

- **Category B** · source: `docs/epics.md:233`, `bd Equoria-4umc5`, `bd Equoria-fefh2.14`
- Migration `20260530120000_v58ta_horse_restrict_fks` is in `failed` state on the prod DB (Supabase via Railway) since 2026-05-30. Repair was proven on a simulated temp DB (`equoria_prodsim`); the live prod apply is user-gated. Local replay sentinel (`backend/__tests__/scripts/freshDbMigrationReplay.sentinel.test.mjs`) passes.
- **Plan:** User authorizes, then run against prod: `prisma migrate resolve --rolled-back 20260530120000_v58ta_horse_restrict_fks` → `prisma migrate deploy` → confirm `prisma migrate status` clean. Not agent-runnable (Constitution §6 + c3kb6 destructive-script discipline).

### P0-2 · Master gate not restored; `--no-verify` still the push mechanism

- **Category B** · source: CLAUDE.md active exception, `bd Equoria-fefh2.20` (P0, OPEN), `bd Equoria-fefh2.15` (P0, in-progress)
- fefh2.20's full dependency chain (.14/.16/.17/.18/.19/.24/.25/.44) is closed, so it's unblocked but not executed. fefh2.15: single-process full runs OOM-crash (exit 134 ~38min); only the 8-shard sequential form is viable; a run went fully green but three-consecutive-green on a frozen tree is not locked.
- **Plan:** Execute fefh2.20 WS5 in order (doctrine suite → lint/format → fresh-DB replay → authoritative full suite ×3 green → frontend Vitest → Playwright readiness → evidence verification → CodeQL+ZAP → full master CI on the resulting commit). Then user retires the CLAUDE.md `--no-verify` exception.

### P0-3 · Residual CI-only failures + Security Gate red on master

- **Category B** · source: `bd Equoria-fefh2.43` (P1, in-progress)
- Shards at 498/499 and 696/700; residual CI-only failures (all pass locally): `betaReadinessEnvSentinel` (reads gitignored `backend/env.beta` + `env.beta-readiness` a fresh CI checkout can't have), `preflightTimerSentinel`, `traitHistoryLogFkIntegrity.integration`, `breedController`; plus Security Gate job red.
- **Plan:** Land .43 fixes to master — pin tracked, secret-free `*.example` templates for the env sentinel; root-cause the other 4 in CI context (no skips). Confirm two consecutive green master CI runs incl. Security Gate.

### P0-4 · Beta sign-off record shows green while readiness is blocked

- **Category A (false completion)** · source: `docs/beta-signoff.yaml:31-54`
- Records `gates_passed: 12, gates_failed: 0` at commit `d0853723` dated 2026-05-14 — four weeks _before_ the 2026-06-10 discovery that the test infra was broken and prod migration failed. Signing off on it would deploy against known-broken infra.
- **Plan:** Treat as invalid; do not fill `signed_off_by`. Re-run `scripts/check-beta-readiness.sh` (no flags, master only) after P0-1/2/3 clear; let it overwrite the record; then seek human sign-off.

---

## P1 — High (real functional gaps / false-green on live surfaces)

### P1-1 · ProfilePage "Game Statistics" cards always render 0

- **Category C** · `frontend/src/pages/ProfilePage.tsx:136-143,233-237` · spec: PRD-02 §1.2, stories 2-4 + 8-2
- `useUserProgress()` → `GET /api/v1/users/:id/progress`, but `userController.mjs:100-110` hand-picks fields and never returns `totalHorses`, `totalCompetitions`, `winRate`, `breedingCount` → all resolve `undefined → 0`. A player with horses/wins sees 0/0/0. Constitution §2 forbids "0 masquerading as real data" on beta surfaces.
- **Plan:** Source Horses Owned from `useDashboard()` (`dashboardData.horses.total`); source Competitions Won + Win Rate from a `useCompetitionStats` hook against `GET /api/v1/users/:userId/competition-stats`; pick a real source for Breeding Count or drop the card. Add a Playwright test: seeded user with N horses shows N.

### P1-2 · Horse Search & Filter (Story 3-6) built but reachable by no route

- **Category B + D (false-closed)** · spec: `docs/sprint-artifacts/3-6-horse-search-filter.md`; `sprint-status.yaml:403 completed`
- `HorseListView.tsx` / `horse/HorseSearchBar.tsx` / `horse/HorseFilters.tsx` / `useHorseFilters.ts` exist and are unit-tested, but the only importer is test files. The live `/stable` route renders `StableView.tsx`, which has category tabs only — no search, no age/breed/discipline/training filters, no URL persistence. Almost certainly dropped in the Celestial-Night redesign. The unit tests gave false confidence (they exercise an unmounted component).
- **Plan:** Integrate `HorseSearchBar` + `HorseFilters` + `useHorseFilters` into `StableView.tsx` (apply `applyFilters` from `lib/utils/horse-filter-utils.ts` before the category-tab filter/pagination). Add a Playwright E2E asserting search/filter reachability + URL persistence on `/stable`. If genuinely deferred instead, flip `sprint-status.yaml:403` off `completed` and file a `bd` issue.

### P1-3 · Overnight show execution awards NO horse XP, user XP, or stat gains

- **Category B** · `backend/modules/competition/shows/showController.mjs:592-717` · spec: Epic BACKEND-A BA.4 steps 4-5; PRD-03 §2.1
- The live cron `executeClosedShows` creates a `competitionResult`, pays prize money, awards _rider_ XP/stats, sets `firstWin` — but never touches horse XP, user XP, or horse stats. The real XP/stat logic lives only in the legacy `enterAndRunShow` path, which is now 410 Gone. Since the 7-day show is the _only_ live competition path, **competing produces zero horse progression.**
- **Plan:** Extract the horse-XP + user-XP + stat-gain block from `enterAndRunShow` into a shared helper; invoke it per placement inside `executeClosedShows`'s `$transaction`. Add a real-DB test asserting a placed horse gains XP.

### P1-4 · CompetitionResultsPage "My Results" list permanently empty

- **Category B** · `frontend/src/pages/CompetitionResultsPage.tsx:393-398`, `CompetitionResultsList.tsx:427` · spec: Story 5.2, Epic 27.3
- The list is rendered with no `results` prop; the component defaults `results = []` and does not self-fetch (`_userId` is explicitly unused). Always shows "No competition results found." The results modal + ScoreBreakdownRadar performance panel are consequently unreachable too.
- **Plan:** Add a `useUserCompetitionResults(userId)` hook (real endpoint) and pass its data in, or make the list self-fetch from `userId`.

### P1-5 · Groom Talent Tree (Story 7-6) built, backend mounted, but no UI path or hook

- **Category B** · `frontend/src/components/groom/GroomTalentTree.tsx` (zero non-test importers); backend `groomTalentsRoutes.mjs` mounted `groomRoutes.mjs:672` · claimed `completed`, "75/75 tests"
- A permanent progression mechanic with a ready backend and zero UI access. `useGrooms.ts` has no talent hook.
- **Plan:** Add `groomsApi.getTalents/selectTalent` + `useGroomTalents/useSelectTalent`; render `GroomTalentTree` in `GroomDetailPanel` (or a new detail tab) wiring `onSelectTalent` to the mutation.

### P1-6 · Trainers have zero effect on training outcomes

- **Category A** · `backend/modules/training/controllers/trainingController.mjs:266,452-458` · spec: PRD-06 §1/§3; frontend claims "boost training session effectiveness" (`TrainersPage.tsx:76`)
- Training modifiers come only from `getTemperamentTrainingModifiers(horse.temperament)` — no trainer argument. The active `TrainerAssignment` is loaded solely to award trainer XP; it never modifies stat gain or discipline score. No `getTrainerBonus` exists. The trainer system's value proposition is decorative and the UI tells players something untrue (Constitution §2).
- **Plan:** Implement `computeTrainerModifiers({trainer, discipline, temperament})` mirroring `riderBonus.mjs`; apply to `disciplineScoreIncrease`/stat-gain before persistence; add a sentinel test. OR (product decision) correct PRD §3 + frontend copy and file as deferred.

### P1-7 · Rider/trainer roster cap not enforced at hire

- **Category A** · `riderMarketplaceController.mjs:203-346`, `trainerMarketplaceController.mjs:204-333` · spec: PRD-05/06 §2.7 (FR-\*-7)
- No `riderConfig.mjs`/`trainerConfig.mjs` exist; hire checks funds only. The `RIDER_SLOT_CAP=5` / "4 trainer slots" are frontend display-only — a player can hire unlimited staff via the API.
- **Plan:** Add `riderConfig.mjs`/`trainerConfig.mjs` with the cap; count non-retired owned staff inside the hire `$transaction`; return 400 at cap; fix FR-\*-7 traceability.

### P1-8 · Exotic + 2 ultra-rare trait triggers can never fire

- **Category D (false-green: "14/14 tests")** · `backend/utils/ultraRareTriggerEngine.mjs` · spec: PRD-04 §3 "100% Backend Complete"
- Evaluators read `horse.dailyCareLogs`, `horse.groomTaskLogs`, `horse.siblings` — none are loaded by `getHorseWithHistory` and none exist in the schema (no `DailyCareLog` model). So all 5 exotic traits + Born Leader + Stormtouched can never trigger (Soulbonded/Dreamtwin even `.map`/`.length` on `undefined` → throw → caught → false). `flag.flagName` is read on a `String[]` → always undefined. The "14/14 tests" only assert the definition registry, never invoking the engine against a horse. Path is live-wired and player-facing (`UltraRareTraitPanel`).
- **Plan:** Add the missing relations to `getHorseWithHistory` OR rewrite evaluators against relations that exist (`groomInteractions`, `milestoneTraitLogs`); fix `epigeneticFlags` as `String[]`; add real-DB sentinel tests that set up qualifying data and assert each trait _fires_. File a `bd` issue per trait family.

### P1-9 · Accessibility audit (Story 30.5) never ran instrumental checks

- **Category D** · `docs/sprint-artifacts/wcag-audit-epic30-2026-05-13.md:11,119-122` · spec: Epic 30.5 (Lighthouse a11y ≥ 0.85 on 8 highest-traffic pages)
- The "audit" was static code analysis only; axe-core/Lighthouse not run, contrast not computed instrumentally, forced-colors not verified in-browser. None of the 8 enumerated pages were checked against the 7-point table. This is a beta-readiness gate with zero measured evidence.
- **Plan:** Run Lighthouse a11y (or axe-core via Playwright) on the 8 pages; run instrumental contrast on the dark-navy palette; verify forced-colors + keyboard-only flow in-browser; append measured results. File `bd` if any page < 0.85.

---

## P2 — Medium

**Competition / Training (all `showController.mjs` / competition pages):**

- **P2-1 · Live scorer ignores traits/training/tack/health** (Cat B/D) — `showController.mjs:514-565` is a bare 5-stat avg + luck + rider; the rich `simulateCompetition.mjs` is unrouted. Trained discipline score has no effect on placement. Needs product ruling: route through canonical simulator, or document the simplified formula and amend BA.4/PRD.
- **P2-2 · Competition browser filters are display-only** (Cat B) — `CompetitionBrowserPage.tsx:257-274` never applies discipline/date/fee filters; no "closing <24h" option; USD `$` labels on a coin economy.
- **P2-3 · No "Create Show" UI** (Cat A) — `POST /api/v1/shows/create` exists but no api-client method / button; the "players create their own shows" premise is UI-absent.
- **P2-4 · No <2-entry cancellation + refund; `cancelled` absent from enum** (Cat A) — a 1-entry show auto-wins 50% of the escrowed prize; 0-entry marked `completed` with no refund.
- **P2-5 · Training eligibility: no max-age (20) and no injury/health gate** (Cat A) — `computeCanTrain` checks only age<3, Gaited trait, cooldown. SECURITY.md's "injured horses cannot train" is a false claim.

**Breeding / Foal development:**

- **P2-6 · Foal age-stage cadence uses real weeks, contradicting the 7-day = 1-game-year clock** (Cat B) — `foalAgeUtils.mjs:24-39` graduates at 728 real days while training-eligibility age-3 = 21 real days; three different scales. BB.4 "graduation → training-eligible" can never hold. Needs a canonical decision (recommend re-expressing stages in game-years).
- **P2-7 · `GET /foals/:id/development` never got BB.1/2/3 fields** (Cat B) — returns legacy 6-day structure; the age-stage data was attached to a _different_ endpoint (`/:foalId/activities`).
- **P2-8 · BB.3 milestone detection is dead code** (Cat A) — `checkBondMilestones` has zero production callers; no `completedMilestones` store/endpoint.
- **P2-9 · Epic 29 `DevelopmentTracker` built but reachable by no page** (Cat B) — `foal/DevelopmentTracker.tsx` (681 lines) imported by nothing; `FoalDetailPage` renders the legacy day-based panel.

**Groom (advanced UIs, all built + backend-ready but unreachable — Cat B):**

- **P2-10 · Career Lifecycle dashboard (7-4)** — `GroomCareerPanel.tsx` unreachable (metrics _are_ live via `GroomDetailPanel`; XP/retirement timeline/milestones/warnings are not).
- **P2-11 · Show-Handler + Bonus-Trait panels (7-7)** — `GroomShowHandlerPanel.tsx` / `GroomBonusTraitPanel.tsx` unreachable; no hooks.
- **P2-12 · Legacy System UI (7-5)** — `GroomLegacyPanel.tsx` unreachable; no hooks.
- **P2-13 · Age-based Task Panel (7-3)** — `GroomAssignmentCard`/`GroomTaskPanel` unreachable; live assign flow lacks the age-tiered task display.
  > For P2-10..13: each needs api-client + hook + render into groom detail, OR a product decision to down-status the story (Constitution §6). Epic 7 is marked COMPLETE, overstating delivered value.

**Rider / Trainer:**

- **P2-14 · Retired riders/trainers still assignable via API** (Cat B) — `riderController.mjs:99` / `trainerController.mjs:95` lack a `retired:false` guard (UI hides them, API doesn't).
- **P2-15 · 6th discovery slot never revealable** (Cat B) — `Math.min(floor(level/2),6)` with level cap 10 → only 5 slots ever; PRD says all 6 at max.
- **P2-16 · Rider auto-retires at 80w (backend) vs 104w (frontend/warnings)** (Cat C) — riders silently retired ~24 weeks before the UI ever warns. Needs canonical career length + `riderConfig.mjs`.
- **P2-17 · Rider dismissal not exposed in UI** (Cat A) — backend route exists; `ridersApi`/`useRiders` omit dismiss (trainer has it). Riders only leave via auto-retirement.

**World / Hub:**

- **P2-18 · NextActions endpoint implements a subset of the 23.4 priority table** (Cat B) — no `check-results` (needs a `viewedAt` column), `compete` doesn't verify open shows exist, `breed` mares-only (skips stallions), no `metadata`, cap 6 vs 10.
- **P2-19 · WhileYouWereGone aggregates 3 of 6 spec'd event types** (Cat B) — missing `club-activity`, `training-complete`, `market-sale`; frontend already renders icons for all 6.

**Security / Traits:**

- **P2-20 · Resource Duplication Prevention is dead code** (Cat D) — `gameIntegrity.mjs preventDuplication` mounted nowhere; the documented 5-second dedup control is inactive (money is partially protected by ledger tx + DB constraints).
- **P2-21 · Phoenix-Born trigger weakened "for testing" in prod** (Cat B) — `ultraRareTriggerEngine.mjs:224-225` `recoveries >= 0` always true; ignores the 3-stress/2-recovery/before-age-2 rule.
- **P2-22 · `evaluateEpigeneticFlags` is a permanent stub in a live path** (Cat C) — returns `[]`; wired into `/epigenetic-traits/evaluate-milestone`. Real flags come from a _separate_ weekly engine, so the milestone-path contribution is dead. Route through `flagEvaluationEngine.mjs` or implement.
- **P2-23 · Two divergent 9-flag rosters; PRD documents the stale one** (Cat B) — live `epigeneticFlagDefinitions.mjs` (aloof/skittish/fragile) vs stale `utils/epigeneticFlags.mjs` (antisocial/social/sensitive); two definition endpoints return different sets.
- **P2-24 · PRD §1.5 deterministic trait conflict-resolution not implemented** (Cat A) — only a generic keep-first list exists; the Boldness≥60 / bond≥70 rules (raised to 4.8 in the validation report) are absent.

**Docs/Deploy:**

- **P2-25 · `railway.toml` startCommand swallows migration failure (fail-open)** (Cat C) — `... migrate deploy || echo "skipped" && ... server.mjs` masks real failures; contradicts Epic 14 "fail fast." (Borderline P1.) Remove the `|| echo` swallow; add a sentinel.
- **P2-26 · Economy shops have no functional PRD** (Cat D) — bank/feed/tack/vet/farrier/crafting are fully built + beta-live but specced only in sprint artifacts, not the PRD tier. Add a PRD-03 §5.x (catalogs, pricing, cooldowns, effects).
- **P2-27 · labs experimental endpoints are player-reachable but unspecified** — `personality-evolution`, `compatibility`, `environment`, enhancedReporting on `authRouter`. Product decision: spec them as beta surfaces, or admin-gate/remove.
- **P2-28 · `sprint-status.yaml` doesn't track backend epics** — economy/labs/events/31A-F never entered it; still says activity feed / physical disciplines are "mock." Either extend it or add a scope-header note.

---

## P3 — Low (polish / drift / spec-doc accuracy)

- **Auth:** password min-length client 8 vs backend 12 (`validation-schemas.ts:78`); orphaned `useDashboard` hook + `/dashboard/:userId` endpoint (subject `UserDashboard.tsx` deleted).
- **Competition:** `isFirstEverWin` never surfaced (CinematicMoment not gated on lifetime-first); `CooldownTimer` no `prefers-reduced-motion` guard + not wired into training; `DisciplineSelector` "All Disciplines" not expandable, badge "Rec."; `ScoreBreakdownRadar` uses raw rgba, `--gold-radar-fill` token never added; `maxEntries` never populated/enforced.
- **Breeding:** activity object shape (`label`/`bondChange` vs spec `name`/`bondImpact`); `ageStage` enum spelling (`two_year_old`, `null` for graduated) + 104 vs 105-week boundary.
- **Rider/Trainer:** 3 of 6 marketplace specialities fall back to Dressage discovery traits; `discoverySlots` not seeded at hire (lazy, deterministic — 0tqa contract broken but no data loss); rider discovery is a read-time stub (no persistence, uniform content); `assignRider` writes `name: undefined` into `horse.rider` JSONB.
- **Hub:** `NextActionsBar` returns null on empty instead of the resting message + no 60s `refetchInterval`; `NarrativeChip` missing `role="status"`; return-detection updates `lastVisit` on mount not dismissal + title "While You Were Away" vs "…Gone" + non-link "more"; CommunityPage hardcoded "Elections open" badge + Hall-of-Fame `…` placeholders.
- **Horse detail:** `PedigreeTab` offspring is a static placeholder (never queries real offspring); `HealthVetTab` vet history hardcoded empty + static "6 weeks" text.
- **Frontend/design-system:** app-level `SentryErrorBoundary` fallback is a bare `<p>` not `ErrorCard` (`App.tsx:42`); `GoldBorderFrame` not applied to HorseDetailPage hero; DECISIONS.md §6 contradicts the game barrel on GoldTabs deprecation; EmptyState path drift; `select.tsx` ADR note moot.
- **Traits:** behavioral roster drift (6 of 10 §1.2 traits missing from catalogs); PRD §5.1 competition example matches no code effects; §4.2 discovery bond thresholds (≥80/≥95 vs ≥50/≥80), no vet-eval reveal, no `epigeneticEdge` lineage reveal.
- **Bundle (30.6):** self-hosted fonts ~101.6KB preloaded (Inter 47.1 + Cinzel 25.3 + Cinzel-Decorative 29.2) exceed the 60KB AC; LCP never measured; the 3 named components not per-component lazy (mitigated by page-level splitting).
- **Security:** "Token Fingerprinting" claimed in SECURITY.md/PRD-08 but never built (HMAC signature is the real anti-tamper); `gameIntegrity.mjs validateTimestamp` (clock-drift/time-manipulation) is dead — no active equivalent.
- **Silent-catch tail:** `bd Equoria-1ohys` — legacy silent `.catch` fail-loud migration still in its tail (ratcheted 788→248; non-blocking, guarded by doctrine ratchet).

---

## Cleanup / orphan / dead code

- **`backend/modules/__ml7jj_inscope_70pb9__/`** — leaked test fixture (empty `routes/`, git-untracked, zero references; from `doctrineScanPatterns.sentinel.test.mjs`). **Remove.**
- **`backend/middleware/gameIntegrity.mjs`** — entirely unmounted (stat-guard, timestamp-validation, breeding/training/transaction validators all dead). Delete + correct SECURITY.md to point at the real service-layer enforcement, OR mount the pieces that add value with sentinel tests.
- **`docs/BreedData/*.txt`** (310 uppercase-allele files) — stale duplicates; canonical data moved to `backend/data/breeds/`. Live foot-gun if a seeder is re-pointed at them (would false-flag every breed Brindle). Archive/delete.
- **`MARKETPLACE_PAGE_DELIVERY.md`** (root) — describes the deleted groom `MarketplacePage.tsx`. Obsolete; delete.
- **Orphaned `useDashboard` + `/dashboard/:userId`** — delete or consume (consuming would also fix P1-1's horse count).
- **`HorseListView`/`HorseSearchBar`/`HorseFilters`** — dead unless re-wired per P1-2.

---

## Cross-cutting stale docs (accuracy, not gaps)

- **`sprint-status.yaml`** — the single biggest divergence: Epic 31E `backlog` (shipped), Epic 22/30 & 22-8 nav `backlog`/`in-progress` (built), 31A `review`, economy/labs/events untracked, still references mock activity-feed + mock physical disciplines.
- **Story-file headers** vs sprint-status vs bd disagree across many stories (3-6, 21, 4-4/4-5, 9c-5, 13-5, 10-5, 15-2, 31A-1/31E-2).
- **SECURITY.md** — wrong retention path (`services/` vs `modules/admin/services/`), false claims (fingerprinting, resource dedup, injured-can't-train), plus relocated test-file refs.
- **`mfaService.mjs:9-11`** — stale comment claims no at-rest encryption; encryption _is_ applied in `mfaController.mjs` (inverse false-green).
- **PRD-03/PRD-04** — "❌ Not Implemented" lines for Conformation Shows + Temperament that are actually shipped; versioning drift (`/api/...` vs `/api/v1/...`).
- **`docs/epics.md` Epic 21R** — statuses stale vs the live tracker (21R-1..6 done, 21S done).
- **`TECH-SPEC-03-Test-Infrastructure.md`** — obsolete (prescribes `jest.unstable_mockModule` mocking, 80/85 coverage, "468 tests" — all contradict current no-mocks doctrine + ~12k tests). Archive.
- **`AUDIT_FINDINGS_21R_FALSE_CLOSURE.md` / `CLOSURE_VERIFICATION_AUDIT_RESULTS.md`** — point-in-time, superseded. History, not current state.
- **PRD-11 §6 open-question #3** — claims no `@@unique([electionId, voterId])`; the constraint exists (`schema.prisma:1441`). Resolved.

---

## Deferred / future (correctly out of scope — NOT gaps)

- Avatar upload (2-1 AC-4 deferred to Phase 2); global/mandatory MFA for non-admins (SECURITY.md A07 follow-up); `uploadGuard.mjs` + `ssrfGuard.mjs` build-ahead gates (no consumer by design).
- Epic 25 onboarding _visual_ rebuild + Epics 26-29 Celestial Night flows (post-beta polish, depend on Epic 22).
- World Hub card alert badges (needs a horse-care aggregation backend; 9B-1 marks optional).
- PRD-05/06 §4 exclusions (staff trading, Hall-of-Fame banners, discovery-slot gameplay modifiers, multi-trainer stacking); PRD-11 §4 exclusions (nested reply trees, moderation, real-time push, block/mute).
- Breed portrait art + lore (`bd Equoria-ggzdu`, `Equoria-w16yk`, P4); `audit_logs` partitioning spike.
- `Equoria-ctop1` / `Equoria-fbnw8` (BLOCKED) — breedGeneticProfile ↔ breedProfiles.json reconciliation (gaits/conformation/temperament, not color).

---

## Verified genuinely complete (high confidence)

Auth/MFA/CSRF/prototype-pollution/audit-trail+retention/GDPR/rate-limiting (14 control clusters, all mounted); horse marketplace (atomic TOCTOU-safe) + detail (13 real tabs); Epic 12 stable pages (zero mocks); color genetics 31A + 31E (fully wired, sentinel-guarded, _exceeds_ spec); breeding foal path; clubs/elections/forum/DM (live, DB-constrained); economy shops (bank/vet/farrier/feed/tack/inventory/crafting, all real + ledger-backed); SSE events; leaderboards (all real queries, PII-guarded); training core; conformation shows; Celestial Night Epic 22 (all 8 stories) + Epic 30 components (GoldBorderFrame/ErrorCard/RewardToast/EmptyState); CI gate architecture (real, sentinel-self-tested, no illegitimate continue-on-error); onboarding (Epic 15-2, server-authoritative).

---

## Proposed prioritized execution order (for user approval)

1. **Unblock beta (P0-1..4)** — user-gated infra/process; nothing agent-runnable without your go-ahead on the prod migration + master-gate restoration.
2. **Fix broken live paths (P1-1, P1-3, P1-4, P1-6, P1-8)** — these make core loops (profile stats, competition progression, competition results, trainers, exotic traits) actually work.
3. **Wire the false-closures (P1-2, P1-5, P2-10..13)** — decide per item: integrate vs down-status the story (your call, Constitution §6).
4. **Enforcement/correctness (P1-7, P2-5, P2-14, P2-25)** — roster caps, training gates, retired-staff guard, railway fail-fast.
5. **Measure the a11y gate (P1-9)** — required real evidence for beta.
6. **P2 systems work** (competition scoring ruling, foal cadence, hub aggregation, trait engines).
7. **P3 polish + cleanup + doc reconciliation** — batchable.

**Update 2026-07-02 (post-review):** the user approved filing. Every finding below is now a tracked `bd` issue under epic **Equoria-oey96**, each with a step-by-step plan, literal AC commands, and the mandatory execution protocol (`docs/audits/AUDIT_EXECUTION_PROTOCOL.md`). Agents may not self-close these issues.

## Finding → bd issue index (epic Equoria-oey96)

| Finding                  | Issue                           |     | Finding                   | Issue    |
| ------------------------ | ------------------------------- | --- | ------------------------- | -------- |
| P0-1 prod migration      | (existing) Equoria-4umc5        |     | P2-14 retired assignable  | oey96.24 |
| P0-2 master gate         | (existing) Equoria-fefh2.20/.15 |     | P2-15 6th slot            | oey96.25 |
| P0-3 CI residual red     | (existing) Equoria-fefh2.43     |     | P2-16 rider 80w vs 104w   | oey96.26 |
| P0-4 stale signoff       | oey96.1                         |     | P2-17 rider dismiss UI    | oey96.27 |
| P1-1 profile stats 0     | oey96.2                         |     | P2-18 NextActions subset  | oey96.28 |
| P1-2 stable search dead  | oey96.3                         |     | P2-19 WYAG 3-of-6         | oey96.29 |
| P1-3 show XP awards      | oey96.4                         |     | P2-20 gameIntegrity dead  | oey96.30 |
| P1-4 results list empty  | oey96.5                         |     | P2-21 Phoenix-Born        | oey96.31 |
| P1-5 talent tree         | oey96.6                         |     | P2-22 flag-eval stub      | oey96.32 |
| P1-6 trainer effect      | oey96.7                         |     | P2-23 two flag rosters    | oey96.33 |
| P1-7 roster caps         | oey96.8                         |     | P2-24 conflict resolution | oey96.34 |
| P1-8 exotic triggers     | oey96.9                         |     | P2-25 railway fail-open   | oey96.35 |
| P1-9 a11y measurement    | oey96.10                        |     | P2-26 economy PRD         | oey96.36 |
| P2-1 scoring decision    | oey96.11                        |     | P2-27 labs exposure       | oey96.37 |
| P2-2 browser filters     | oey96.12                        |     | P2-28 sprint-status       | oey96.38 |
| P2-3 create-show UI      | oey96.13                        |     | P3 password drift         | oey96.39 |
| P2-4 cancel/refund       | oey96.14                        |     | P3 dashboard orphan       | oey96.40 |
| P2-5 training gates      | oey96.15                        |     | P3 isFirstEverWin         | oey96.41 |
| P2-6 foal cadence        | oey96.16                        |     | P3 CooldownTimer          | oey96.42 |
| P2-7 /development        | oey96.17                        |     | P3 DisciplineSelector     | oey96.43 |
| P2-8 milestones          | oey96.18                        |     | P3 radar token            | oey96.44 |
| P2-9 tracker wiring      | oey96.19                        |     | P3 maxEntries             | oey96.45 |
| P2-10 career panel       | oey96.20                        |     | P3 foal contracts         | oey96.46 |
| P2-11 show-handler       | oey96.21                        |     | P3 trainer speciality     | oey96.47 |
| P2-12 legacy panel       | oey96.22                        |     | P3 slots at hire          | oey96.48 |
| P2-13 task panel         | oey96.23                        |     | P3 rider discovery        | oey96.49 |
| —                        | —                               |     | P3 rider JSONB name       | oey96.50 |
| P3 NextActionsBar        | oey96.51                        |     | P3 NarrativeChip          | oey96.52 |
| P3 WYWG divergences      | oey96.53                        |     | P3 CommunityPage          | oey96.54 |
| P3 Pedigree offspring    | oey96.55                        |     | P3 HealthVet              | oey96.56 |
| P3 error boundary        | oey96.57                        |     | P3 GoldBorderFrame        | oey96.58 |
| P3 DS doc contradictions | oey96.59                        |     | P3 bundle remainder       | oey96.60 |
| SEC docs accuracy        | oey96.61                        |     | P3 trait roster           | oey96.62 |
| P3 trait §4.2/§5.1       | oey96.63                        |     | Cleanup batch             | oey96.64 |
| PRD-03/epics 21R docs    | oey96.65                        |     | Archive obsolete          | oey96.66 |
| Story-file headers       | oey96.67                        |     | PRD-05/06 traceability    | oey96.68 |

Dependencies wired: oey96.17/.18 ← .16 (cadence decision); .19 ← .17; .46 ← .16; .31 ← .9; .68 ← .8 + .26. Epic related to the four pre-existing P0 infra issues.
