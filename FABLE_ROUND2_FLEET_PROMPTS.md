# Fable Round 2 — Spec-vs-Code Audit Fleet Hand-off (Epic Equoria-oey96, 2026-07-02)

Companion to `FABLE_SPRINT_PLAN.md` and `FABLE_ROUND1_FLEET_PROMPTS.md`. Covers the 68-issue beta-readiness
audit epic `Equoria-oey96`. Fable already wrote full bodies into each issue and created
`docs/audits/AUDIT_EXECUTION_PROTOCOL.md`, so these inject prompts are deliberately lean — the detail lives
in the issue and the protocol doc.

## Relationship to the other epics

- **Round 1 (`FABLE_ROUND1_FLEET_PROMPTS.md`)** = economy transaction-correctness (16 issues).
- **Round 2 (this doc)** = spec-vs-code / beta-readiness (68 issues under `Equoria-oey96`).
- They **share hot files** — see "Cross-epic file contention" below. Do not run both fleets in parallel on
  the shared files.

## ⚠️ Cross-epic file contention (read before dispatching anything)

Put ALL of these in **one serial lane** — never two agents on them at once:

- **`backend/showController.mjs`** — Round 1: `8pb6w` → `c7mx0` → `3k96w` → `g8qg0`; Round 2: `.4` (show XP)
  and `.11` (full scorer). Recommended order across both epics: land the Round 1 showController fixes first
  (they harden the money paths), THEN `.4` show-XP, THEN `.11` scorer. One lane, one agent, serial.
- **Roster controllers** — Round 1 `n4m5j` (groom cap, count-in-tx) and Round 2 `.8` (rider/trainer cap)
  are the same defect class. Do them back-to-back with the same agent so the count-in-transaction pattern
  is applied consistently; `.8` should copy `n4m5j`'s fix.

Everything NOT on that list is fair game for parallel agent-team dispatch (see the batching map at the end).

## Decisions log (baked into the relevant issues below)

- **`.16` Foal cadence** — **Game-year clock / 7 real days** (via `backend/utils/horseAge.mjs`). Unblocks
  `.17`/`.18`/`.46`. (2026-07-02)
- **`.11` Live scorer** — **Full scorer: stats + traits + training + tack + health.** Bigger build +
  balancing; matches the spec. (2026-07-02)
- **`.7` Trainer effect** — **Implement the boost** (`computeTrainerModifiers`). (2026-07-02)
- **`.26` Rider career** — **104 weeks** (align backend up to the UI). (2026-07-02)
- **Deferred to in-issue gates** (agent presents options and waits): gameIntegrity's fate, labs exposure,
  conflict resolution, task-panel scope. No pre-decision needed.

## How to use each block

The issue body already carries the "why," file:line evidence with STOP-if-changed, a numbered plan, literal
AC, and a "Traps" section; `AUDIT_EXECUTION_PROTOCOL.md` carries the discipline. So each inject is just:
`/safe-ralph` line + "read the issue + the protocol" + the tool to lace in + dependency/parallel flags.

## GLOBAL INJECT TEMPLATE (applies to every runnable issue below)

```
Read Equoria-oey96.<N> AND docs/audits/AUDIT_EXECUTION_PROTOCOL.md first — the issue's AC requires the
protocol. Follow it exactly: re-verify the file:line evidence (STOP if the DEFECT is gone or the code was
refactored; pure line-number drift with the defect intact is NOT a stop — append the corrected citations
to the issue and continue), failing test FIRST with raw output pasted, real-DB/no-mocks, literal AC
execution, post-change suite re-run, adjacent-locations check, §9 self-critique, then the fixed
completion-report template. DOC-ONLY issues: the "failing test" is the AC grep/citation showing the stale
text present before and absent after — do not fabricate a vacuous test. If your fix adds/moves a
prisma.$transaction site, update the retryableTransactionWrapping sentinel pins in the SAME commit and run
that sentinel before pushing. bd close is FORBIDDEN — post evidence and STOP for my closure approval. Push
only after `bash scripts/doctrine-checks/run-all.sh` exits 0, via `git push origin master --no-verify`.
```

---

## P0 — Beta blockers (YOURS to authorize — not agent-runnable)

These are infra/process. An agent can prep, but you execute the gated step.
**CORRECTED 2026-07-06 (Day 5 review)** — the original P0-1/P0-3 text below was stale and P0-1's
instruction was DANGEROUS; follow this corrected version only.

- **P0-1 — RESOLVED 2026-06-16, do NOT re-run.** The prod migration `v58ta_horse_restrict_fks` was
  repaired and verified on 2026-06-16 (`Equoria-fefh2.14`, user-approved closure: resolve + deploy, 91/91
  clean, FK-drift 0). **Running `migrate resolve --rolled-back` + `migrate deploy` against the
  already-repaired prod DB would be destructive — never do it.** What remains: (a) a READ-ONLY
  `prisma migrate status` confirmation on prod via railway run (user-gated, command in the Day-2 report),
  and (b) the doc corrections tracked as `Equoria-45222` (epics.md + the 2026-07-02 audit still claim
  FAILED).
- **P0-2 — Master gate not restored / `--no-verify` still active** (`bd fefh2.20`, `fefh2.15`). Fleet
  lands `3ewqy` (ip8kk already landed 73ca57f0b); lead executes the master-gate-diagnosis steps 3–7
  (triage run, two consecutive green CI runs, three green local authoritative runs on a frozen HEAD, WS5
  checklist, timed hook run); then **you** retire the CLAUDE.md exception block (steps 8–9). The first
  green gate alone does NOT satisfy the removal condition.
- **P0-3 — LARGELY RESOLVED.** The four named CI-only failures were fixed on master 2026-06-16 (see
  `docs/debugging-reports/2026-07-06-master-gate-diagnosis.md` §1 — do NOT re-investigate them). The
  residual `fefh2.43` AC ("all backend shards + Security Gate green on two consecutive master commits")
  is blocked only by `3ewqy` landing; it is IN_PROGRESS and dep-wired.
- **P0-4 / `oey96.1` — Stale beta-signoff** (docs/beta-signoff.yaml). The invalidation landed
  (511f4e10f); the issue awaits YOUR closure. Re-run readiness only after P0-2 completes; **you**
  re-sign-off. No further code fix.

---

## P1 — Broken live paths (full inject blocks)

Recommended first three (no decision needed): `.4`, `.2`, `.3`. (`.5` LANDED 2026-07-06 as d90f50c24 —
verify-and-close only, plus the follow-up E2E `Equoria-dyoyi`; its sibling `wt42i` is the same defect,
also awaiting the user's verify-and-close call.)

### Equoria-oey96.2 — ProfilePage stats always 0 — Sonnet high — parallel-safe

> ✅ **LANDED 2026-07-07 (commit e4ab154ac) — AWAITING USER CLOSURE.** /progress extended (shared helper), ProfilePage cards show real data, real-DB sentinel + Playwright green. Follow-ups filed: Equoria-4z3i9, Equoria-lg8ga. Do NOT re-dispatch.

```
/safe-ralph Equoria-oey96.2 make /progress return totalHorses/totalCompetitions/winRate/breedingCount and render them on ProfilePage; test fails-first then passes; evidence on the issue; awaiting my closure
```

```
[GLOBAL INJECT TEMPLATE, N=2]
Lace in: senior-backend (the /progress endpoint in userController.mjs:100-110) + senior-frontend
(ProfilePage.tsx:136-143). Follow the issue's recorded design decision EXACTLY: extend the /progress
endpoint on the BACKEND (one page, one aggregate call) — extract a shared helper from the
getUserCompetitionStats aggregation rather than copy-pasting it, and do NOT bolt extra hooks onto
ProfilePage. Add a Playwright assertion that the cards show non-zero for a seeded user.
Parallel: safe (own page + own endpoint). Constitution §2 — no placeholder data, real values or honest empty.
```

### Equoria-oey96.3 — Horse Search & Filter built but unreachable — Sonnet high — parallel-safe

> ✅ **LANDED 2026-07-07 (commits bf1422c0a + a51def2b1) — AWAITING USER CLOSURE.** Search/filter wired into StableView, failing-first Playwright E2E spec landed. Follow-ups filed: Equoria-s7i2f, Equoria-5ud14, Equoria-dlruc. Do NOT re-dispatch.

```
/safe-ralph Equoria-oey96.3 wire the existing search/filter components into StableView and prove reachability; Playwright fails-first then passes; evidence on the issue; awaiting my closure
```

```
[GLOBAL INJECT TEMPLATE, N=3]
Lace in: senior-frontend + playwright-e2e-tester. The components currently import from test files only —
integrate them into the real /stable StableView route. The sentinel is a Playwright test that drives the
search/filter on /stable (must fail now: no route reaches them).
Parallel: safe (StableView + its components).
```

### Equoria-oey96.4 — Overnight shows award NO XP/stat gains — Opus xhigh — ⚠ SERIAL (showController lane)

```
/safe-ralph Equoria-oey96.4 extract the XP/stat-gain block into the overnight show cron $transaction so competing grants progression; sentinel fails-first then passes; evidence on the issue; awaiting my closure
```

```
[GLOBAL INJECT TEMPLATE, N=4]
Lace in: senior-backend + systematic-debugging. showController.mjs:592-717 — the only live competition path
gives zero progression. Extract the XP/stat block from the retired path into the cron $transaction; awards
must be idempotent and inside the tx (reuse the Round 1 audit patterns).
⚠ SERIAL LANE: showController.mjs. Land the Round 1 showController fixes (8pb6w→c7mx0→3k96w→g8qg0) FIRST,
then this, then .11. Never run concurrently with another showController issue.
Sentinel: run the overnight cron over a seeded show → horse XP and user XP both increase by the expected
amount, exactly once.
```

### Equoria-oey96.5 — CompetitionResultsPage "My Results" always empty — Sonnet high — parallel-safe

```
/safe-ralph Equoria-oey96.5 add useUserCompetitionResults so My Results self-fetches; test fails-first then passes; evidence on the issue; awaiting my closure
```

```
[GLOBAL INJECT TEMPLATE, N=5]
Lace in: senior-frontend. CompetitionResultsList.tsx:427 renders with no results prop and never self-fetches.
Add the useUserCompetitionResults hook + fetch. Sentinel: seeded user with results → list is populated.
Parallel: safe.
```

### Equoria-oey96.6 — Groom Talent Tree unreachable (no UI/hook) — Sonnet high — parallel-safe

> ✅ **LANDED 2026-07-07 (commit b0730924c) — AWAITING USER CLOSURE.** api-client + hook + GroomDetailPanel render wired; E2E spec landed. Follow-up filed: Equoria-y28dh (talent-tree personality-key mismatch — 3 of 4 personalities get the "not available" fallback; product decision). First of the .6→.20→.21→.22 groom-panel serial chain — .20/.21/.22 still open. Do NOT re-dispatch .6.

```
/safe-ralph Equoria-oey96.6 add the talent-tree api-client + hook and render it in groom detail; test fails-first then passes; evidence on the issue; awaiting my closure
```

```
[GLOBAL INJECT TEMPLATE, N=6]
Lace in: senior-frontend. Backend is mounted; players just can't view/allocate. Add api-client + hook +
render in the groom detail panel. Sentinel: Playwright can view and allocate a talent for a seeded groom.
Parallel: safe.
```

### Equoria-oey96.7 — Trainers have zero training effect — Opus xhigh — DECISION: IMPLEMENT

> ✅ **LANDED 2026-07-07 (commits a9620dd54 + 18287a273) — AWAITING USER CLOSURE.** DECISION + formula (balance-formulas §2) ratified; computeTrainerModifiers implemented (skill/level/speciality/compat-matrix, caps 0.20/0.08), wired to discipline-score gain (composition traits→temperament→trainer), PRD-06 §3 updated, 12/12 real-DB tests. Follow-up filed: Equoria-oey96.69 (surface trainerModifier % in the TrainingTab UI). Do NOT re-dispatch.

```
/safe-ralph Equoria-oey96.7 implement computeTrainerModifiers so assigned trainers actually boost training; sentinel fails-first then passes; evidence on the issue; awaiting my closure
```

```
[GLOBAL INJECT TEMPLATE, N=7]
DECISION 2026-07-02: IMPLEMENT the boost (not the copy-correction path). ⚠ SECOND GATE STILL OPEN
(2026-07-06): the modifier FORMULA needs the user's sign-off. Sequence: propose the computeTrainerModifiers
formula (inputs, curve, caps) ON THE ISSUE and STOP for approval — do NOT invent the math and build. After
sign-off: build computeTrainerModifiers and apply it in the training stat-gain path; today modifiers use
only horse temperament and the assignment is loaded solely for XP. Lace in: senior-backend +
systematic-debugging.
Sentinel: identical horses, one with an assigned trainer → measurably higher training gain; unassigned
unchanged. Real-DB.
```

### Equoria-oey96.8 — Rider/trainer roster cap not enforced — Opus xhigh — copy n4m5j pattern

```
/safe-ralph Equoria-oey96.8 enforce the rider/trainer roster cap with a count-in-transaction guard; sentinel fails-first then passes; evidence on the issue; awaiting my closure
```

```
[GLOBAL INJECT TEMPLATE, N=8]
⚠ USER DECISION 2026-07-06: the cap is SCALED BY STABLE LEVEL, not flat. GATE: propose the scaling curve
(cap per stable level, and where "stable level" comes from — note there is no stableLevel column in the
schema today, so the proposal must name the real source or flag the schema need) ON THE ISSUE and STOP for
the user's sign-off BEFORE building. After sign-off:
Lace in: senior-backend. Hire currently checks funds only; caps are frontend-display-only → unlimited staff
via API. Add the cap config + a count-in-transaction guard.
COPY THE PATTERN from Round 1 Equoria-n4m5j (landed, closed): the cap is a COUNT not a column — debit/lock
first, then count() INSIDE the tx, then throw if over. Do NOT use a conditional-updateMany predicate on a
count.
Sentinel: two concurrent hires at cap−1 → exactly one 201, final count == cap (for that stable level).
Dependency: this + the .26 rider-retirement decision unblock the PRD-traceability fix (.68).
```

### Equoria-oey96.9 — Exotic + ultra-rare trait triggers can never fire — Opus xhigh — ✅ UNGATED (2026-07-06)

```
✅ USER RATIFIED 2026-07-06: ADJUST the conditions — NO new schema. Rewrite the evaluators against relations
that exist (groomInteractions, milestoneTraitLogs, traitHistoryLogs, competitionResults, sire/dam) per the
per-trait mapping table posted on the issue, and rework the 3 unrepresentable triggers to their proposed
snapshot-based forms. The one required sign-off (adjusted trigger conditions / PRD-04 edits) is now given —
ready to run.
```

```
[GLOBAL INJECT TEMPLATE, N=9]
Lace in: senior-backend + systematic-debugging. Per the ratified mapping: fix the relations/evaluators so
the triggers can actually fire, and add REAL firing tests (the current "14/14 tests" only check the
registry, not firing). Blocks Phoenix-Born (.31).
Sentinel: a horse meeting an exotic trigger's real conditions actually receives the trait (fails now).
```

### Equoria-oey96.10 — Accessibility audit never ran instrumental checks — Sonnet high — parallel-safe

```
/safe-ralph Equoria-oey96.10 run real Lighthouse/axe + contrast on the 8 key pages and record measured evidence; check fails-first then passes; evidence on the issue; awaiting my closure
```

```
[GLOBAL INJECT TEMPLATE, N=10]
Lace in: playwright-e2e-tester (axe-core integration). The ≥0.85 gate currently has zero measured evidence —
static analysis only. Wire instrumental Lighthouse/axe + contrast checks into the beta-readiness run for the
8 key pages; the gate must be backed by a real measurement that can fail.
Parallel: safe (test infra).
```

### Equoria-oey96.35 — railway.toml swallows migration failure (fail-open) — Opus xhigh

```
/safe-ralph Equoria-oey96.35 make railway.toml fail CLOSED on migration failure instead of swallowing it; sentinel fails-first then passes; evidence on the issue; awaiting my closure
```

```
[GLOBAL INJECT TEMPLATE, N=35]
Lace in: senior-backend. railway.toml currently swallows a migration failure (fail-open) — exactly how P0-1
slipped to prod unnoticed. Make the deploy step fail closed. Coordinate with P0-1 (same failure story).
Sentinel: a simulated failing migration in the deploy path → the deploy aborts, not proceeds.
```

---

## P2 — Medium (27 issues: `.11`–`.34`, `.36`–`.38`)

These already carry full bodies + traps. Use the GLOBAL INJECT TEMPLATE with the right tool per domain; get
exact IDs from `bd list --parent Equoria-oey96 --label audit-20260702`. Decisions already made are baked in.

| Domain / item                                                       | Model       | Tool to lace                            | Notes / flags                                                                          |
| ------------------------------------------------------------------- | ----------- | --------------------------------------- | -------------------------------------------------------------------------------------- |
| `.11` Full competition scorer (traits+training+tack+health)         | Opus xhigh  | senior-backend + bmad-tea               | DECISION: full scorer. ⚠ SERIAL showController lane — run AFTER `.4`. Balancing-heavy. |
| `.16` Foal cadence → 7-day game-year clock                          | Opus xhigh  | senior-backend                          | DECISION made. Use horseAge helpers. Blocks `.17`/`.18`/`.46`.                         |
| `.17` (depends on `.16`) → blocks `.19`                             | Opus xhigh  | senior-backend                          | Run after `.16`; then `.19`.                                                           |
| Competition browser filters display-only                            | Sonnet high | senior-frontend + playwright-e2e-tester | Parallel-safe.                                                                         |
| No "Create Show" UI                                                 | Sonnet high | senior-frontend                         | Parallel-safe.                                                                         |
| No <2-entry cancel/refund (1-entry auto-wins 50%)                   | Opus xhigh  | senior-backend                          | ⚠ SERIAL showController lane. Money path.                                              |
| Training no max-age/injury gate                                     | Sonnet high | senior-backend                          | Parallel-safe.                                                                         |
| `/development` missing BB fields + dead milestone detection         | Opus xhigh  | senior-backend + systematic-debugging   | Ties to `.16`.                                                                         |
| Epic 29 DevelopmentTracker on no page                               | Sonnet high | senior-frontend                         | Parallel-safe.                                                                         |
| Groom 7-3/7-4/7-5/7-7 panels unreachable                            | Sonnet high | senior-frontend                         | Parallel-safe (sibling of `.6`).                                                       |
| Retired staff still assignable via API                              | Opus xhigh  | senior-backend                          | Access-control; pairs with `.8`/`.26`.                                                 |
| Rider retires 80w vs 104w                                           | Sonnet high | senior-backend                          | DECISION: 104w.                                                                        |
| Rider dismissal not in UI                                           | Sonnet high | senior-frontend                         | Parallel-safe.                                                                         |
| NextActions / WhileYouWereGone subset of spec                       | Sonnet high | senior-frontend                         | Parallel-safe.                                                                         |
| resource-dedup + gameIntegrity dead middleware                      | Opus xhigh  | hunt-mocks + senior-security            | ⚠ DECISION gate (gameIntegrity fate) — agent presents options, waits.                  |
| Phoenix-Born trigger weakened "for testing"                         | Opus xhigh  | senior-backend                          | Depends on `.9` (exotic triggers).                                                     |
| evaluateEpigeneticFlags live-path stub + two divergent flag rosters | Opus xhigh  | senior-backend + systematic-debugging   | Reconcile the two rosters.                                                             |
| Economy shops have no PRD                                           | —           | bmad-create-prd                         | Spec task, not a fix — Fable/you author the PRD first.                                 |
| Labs endpoints reachable but unspecified                            | Opus xhigh  | senior-security                         | ⚠ DECISION gate (labs exposure) — agent waits.                                         |

---

## P3 + cleanup + doc reconciliation (30 issues: `.39`–`.68`)

> ✅ **LANDED 2026-07-07 — AWAITING USER CLOSURE:** `oey96.62` (commit 7355c43ff) — PRD-04 §1.2 behavioral trait roster reconciled to the shipped catalog; the 6 design-vision names (secretive/explorative/desensitized/peopleOriented/routineDependent/stressProne) documented as NOT in any shipped catalog (corrected the "config-only" premise — they're in neither). Follow-up filed: `Equoria-1llf8` (§1.3/§5.1 residual refs). `oey96.34` still owns §1.5 conflict-resolution refs.

Mostly mechanical — Sonnet high, and many are agent-team parallel-safe. Get exact IDs from
`bd list --parent Equoria-oey96 --label audit-20260702`.

- **Doc reconciliation** (sprint-status.yaml, SECURITY.md wrong paths + 3 false claims, mfaService comment
  inverse false-green, PRD-03/04 "Not Implemented" lines that shipped, TECH-SPEC-03 obsolete mocking,
  epics.md 21R): Sonnet high, `hunt-mocks` for the false-green/false-claim ones. Parallel-safe EXCEPT any
  issue that edits `.claude/rules/SECURITY.md` — those (incl. `.61`, `7rc1q`, `mi64z`, `nzhu8`) go through
  the SECURITY.md serial lane (Round 4 / HANDOFF.md), NOT this pool. These fix the _map_, not the
  territory — high value for stopping future false-closure.
- **Spec-drift fixes** (password min-length client/server drift, hub AC divergences — role="status",
  resting-message, refetch; CooldownTimer/DisciplineSelector/ScoreBreakdownRadar deviations; PedigreeTab/
  HealthVetTab placeholders; error-boundary bare `<p>` vs ErrorCard; font payload 101KB vs 60KB AC; "Token
  Fingerprinting" claimed-but-never-built): Sonnet high, `senior-frontend`. Mostly parallel-safe.
- **Cleanup / orphans** (remove `backend/modules/__ml7jj_inscope_70pb9__/` leaked fixture; remove
  `docs/BreedData/*.txt`, `MARKETPLACE_PAGE_DELIVERY.md`; orphaned `useDashboard`//dashboard/:userId):
  Sonnet high. **Verify orphan status before any deletion** (grep for imports first — the protocol's
  adjacent-locations check). NOTE (2026-07-06): the `gameIntegrity.mjs` deletion is OWNED by `oey96.30`
  (decided REMOVE; Lane C, with the required sentinel + SECURITY.md corrections) — it is NOT part of this
  cleanup batch; do not double-dispatch it.
- `.68` PRD traceability fix: gated on `.8` (roster caps) + `.26` (rider retirement). Run last.

---

## Agent-team batching map

**Parallel-safe fan-out** (disjoint files — dispatch to an agent team, each in its own worktree, lead
integrates serially on master). ⚠ "Disjoint" corrected 2026-07-06 — three clusters share files and must
serialize INTERNALLY (see HANDOFF.md): groom panels (`.6` → `.20` → `.21` → `.22` — all touch
GroomDetailPanel.tsx/useGrooms.ts/grooms.ts), competition browser (`.12` → `.13`, same page), leaderboard
(`6lobd` → `2y91o` → the rest — shared queries/controller).

- Frontend "wire it up": `.3`, `.6` (then its panel chain), DevelopmentTracker page, competition
  browser filters (serialized `.12`→`.13`), Create Show UI, rider dismissal UI,
  NextActions/WhileYouWereGone. (`.5` is LANDED — verify-and-close, not dispatch.)
- `.2` profile stats (own page + own endpoint).
- `.10` a11y instrumentation (test infra).
- Doc reconciliation batch (P3) — independent files EXCEPT the SECURITY.md editors (serial lane).

**Serial lane #1 — `showController.mjs`** (one agent, in order): Round 1 `8pb6w` → `c7mx0` → `3k96w` →
`g8qg0` → Round 2 `.4` → `.11` → `<2-entry refund`.

**Serial lane #2 — roster/staff**: Round 1 `n4m5j` → Round 2 `.8` → retired-staff-assignable → `.68`.

**Blocked until upstream**: `.9` (Day 2 exotic-traits schema) → `.31` Phoenix-Born; `.16` → `.17` → `.19`
and `.18`/`.46`.

**Reminder on landing**: even parallel-safe work must PUSH serially — never two `git push` at once. The team
investigates/implements in parallel; the lead lands one commit at a time (Constitution §1).

## Tool-injection notes to add to the bd issues (optional, via `bd update --notes`)

If you want the tool baked into the issue itself so any agent picks it up:

- Frontend issues (`.2`,`.3`,`.5`,`.6`, panels): `use senior-frontend; prove reachability with a Playwright test`.
- Backend correctness (`.4`,`.7`,`.8`,`.9`,`.11`, foal/flag issues): `use senior-backend + systematic-debugging`.
- False-green / dead-code / doc-claim issues: `use hunt-mocks`.
- a11y (`.10`): `use playwright-e2e-tester with axe-core`.
- Before closure on any P1/P2: `run bmad-code-review over the diff`.
