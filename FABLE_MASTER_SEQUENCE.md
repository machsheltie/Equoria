# Fable Fleet — Master Run Sequence (cross-epic coordination)

> **⚠ SUPERSEDED FOR RUN ORDER — 2026-07-06 (Day 5 review).** The canonical, dependency-ordered
> execution plan is **`HANDOFF.md`** (repo root). This document is retained for the overlap/dedup
> RATIONALE (the tables below) and history. Where any status or ordering here disagrees with
> HANDOFF.md or live `bd` state, **HANDOFF.md + `bd show` win.** The Day-5 adversarial review found
> this doc had accreted corrections without applying them to its operative sections; the operative
> sections below have been reconciled once (2026-07-06 evening), but they will not be maintained —
> HANDOFF.md will.

Governs the two remediation epics so they run in tandem where safe and serialize where they touch:

- **Round 1** — economy transaction-correctness (16 issues). Prompts: `FABLE_ROUND1_FLEET_PROMPTS.md`.
- **Round 2** — spec-vs-code / beta-readiness (`Equoria-oey96`, 68 issues). Prompts: `FABLE_ROUND2_AUDIT_FLEET_PROMPTS.md`.

**Do NOT merge the two epics.** Keep them separately tracked. This doc is the single order that decides
what runs in parallel vs serial across both.

## The rule in one line

Fan out the disjoint-file work from BOTH epics to an agent team in parallel; force every issue that touches
a shared hot file or a shared invariant through the serial lanes below; land all commits one at a time
(Constitution §1 — never two `git push` at once).

---

## Cross-epic overlaps & dedup resolutions (do these BEFORE dispatch)

| #   | Overlap                                                                                                                     | Risk                                         | Resolution                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Show XP (`.4`) calls the XP writers R1 is hardening** (`wsj2i`,`geo1a`,`jvi3u`)                                           | Med — wiring the cron to buggy writers       | Land `wsj2i`/`geo1a`/`jvi3u` **before** `.4`. Different files, so no collision — pure prerequisite.                                                                                     |
| 2   | **gameIntegrity.mjs deleted in both** — R1 `d0qur` ↔ R2 `oey96.30` (corrected 2026-07-06: the near-dup is `.30`, NOT `.61`) | Med — file deletes once; half-deletes dangle | Merge `d0qur` → `.30` (see Reconciliation Update). `d0qur`↔`.61` is COMPLEMENTARY — disjoint SECURITY.md sections.                                                                      |
| 3   | **Roster caps** — R1 `n4m5j` (grooms) vs R2 `.8` (riders/trainers)                                                          | Low — same class, likely disjoint entities   | Same agent, back-to-back; `.8` copies `n4m5j`'s count-in-tx pattern. Verify neither scope covers the other's entities; if one does, close the redundant.                                |
| 4   | **gameIntegrity / resource-dedup middleware** (R2 decision) vs R1 tx-layer hardening                                        | Med — double/conflicting enforcement         | At the R2 decision gate, lean **delete the dead middleware**: R1 already enforces these invariants at the transaction layer (the correct place). Don't revive a coarser parallel layer. |
| 5   | **T8 stud service** reuses breeding guards from R1 `mhdul`                                                                  | Low — sequence, not dup                      | `mhdul` (self-cross/sex/cooldown) lands before the T8 build.                                                                                                                            |
| 6   | **Cooldown text correction owned by `d0qur`** (SECURITY.md breeding section), NOT `.61` (corrected 2026-07-06)              | Low                                          | `d0qur` carries the 30d→7d (1 game year, DAM-only) fix; `.61` never touches cooldown.                                                                                                   |

### Reconciliation Update — 2026-07-06 (Opus dedup pass, COMPLETE)

The pass ran; all non-destructive links/notes are applied and pushed to Dolt. Key results:

- **Most Round 1 work is already CLOSED** — `otii0`, `n4m5j`, `t7ywe`, `wsj2i`, `geo1a`, `mhdul`, `hduc5`,
  and (Day 4) `jvi3u`. ALL of `.4`'s XP-writer prerequisites are landed; `.4` carries
  `blockedBy jvi3u / geo1a / wsj2i` (all ✓ closed).
- **TRUE DUPLICATE — `v9s0r`:** ✅ EXECUTED — closed as duplicate of `oey96.8` (canonical; Lane B, blocks `.68`).
- **NEAR-DUPLICATE — `d0qur` → `oey96.30`:** ✅ EXECUTED — d0qur closed as merged. ⚠ Residue found by the
  Day-5 review: d0qur's absorbed SECURITY.md scope (breeding/training/transaction sections + the 30d→7d
  dam-cooldown text) was never copied into `.30`'s body — a note has been appended to `.30` (2026-07-06)
  carrying that scope so it isn't lost.
- **`.30` gameIntegrity decision → lean DELETE:** R1 already enforces every invariant the middleware
  claimed, at the correct tx layer (dedup→atomic claim + `@@unique`; stat-manip→`wsj2i`; breeding→`mhdul`;
  money→`debitMoneyOrThrow`). Delete leaves nothing unprotected — you confirm at the gate.
- **New orderings folded into the lanes:**
  - `oey96.45` (enterShow entry-tx maxEntries/slot guard) → Lane A, after `8pb6w`/`g8qg0`.
  - **`709qm` must land AFTER `.4`** — `.4` extracts award logic from `enterAndRunShow` into
    `competitionAwards.mjs`; `709qm` retires `enterAndRunShow`. Extract before delete, or `709qm` must
    preserve `calculateStatGains`/`awardCompetitionXp`.
  - **`oey96.15` before the SECURITY.md A04 rewrite** in `d0qur`/`.30` — `.15` proves `canTrain` is a
    partial false-green (missing age>20 + injury gates); land it first so the doc reflects reality.
- **Verify at `.4` build:** confirm the closed `geo1a` exposes a tx-aware `addXpToHorseCore(db,…)` callable
  inside `.4`'s tx. If it only has the public wrapper, file a small follow-up to extract the core.

### Day 4 decisions & updates — 2026-07-06 (user-approved)

- **`jvi3u` LANDED** → `oey96.4`'s XP-writer blockers are cleared; `.4` is runnable now (still verify
  `geo1a` exposes the tx-aware core; keep `.4` in Lane A after the showController money cluster). `wt42i`
  was already fixed by another commit (verify-and-close).
- **Migrations APPROVED to run** (final SQL/backfill review before any prod apply stays yours): `c7mx0`
  (2-col Show migration, after `8pb6w`), `icqqm` (weekKey unique index + dedupe/backfill), and `6lobd`
  **Fix A** (real Int column + backfill — not the raw-SQL CAST).
- **`oey96.30` / `hjnrc` → REMOVE + correct docs** (confirms the `.30` gate). Delete the unmounted
  `gameIntegrity.mjs` and the unmounted suspicious-activity/Sentry pipeline; fix the SECURITY.md claims.
  Round 1 enforces the invariants at the tx layer, so nothing is left unprotected.
- **`oey96.8` cap → SCALED by stable level** (not flat). Enforcement stays the count-in-tx guard; the cap
  scales with stable level — have the fleet/Fable propose the scaling curve for your sign-off before build.
- **Still pending your review** (each issue's validation note has the specifics): `.7` trainer-modifier
  formula, `.9` exotic-trigger conditions (NOT a schema — the no-schema decision is on the issue; you
  ratify the adjusted trigger-condition mapping), `ys186` (keep vs close), and `wt42i` (verify-close
  scope — the defect itself is confirmed fixed by d90f50c24). `ip8kk` is RESOLVED: the edit was adopted,
  landed as 73ca57f0b, and the issue is closed.

---

## Master run order

### Wave 0 — YOU / lead (gates that unblock the rest) — CORRECTED 2026-07-06

- **P0-1 is RESOLVED (2026-06-16)** — the v58ta prod migration was repaired then (fefh2.14, user-approved,
  91/91 clean). Do NOT run `migrate resolve`/`deploy` against prod. Remaining: a READ-ONLY prod
  `prisma migrate status` confirmation (yours) + the doc corrections (`Equoria-45222`).
- P0 authorizations that remain yours: master-gate exception removal (P0-2, steps 8–9 only), signoff (P0-4).
- Migration DESIGNS approved Day 4 (`icqqm`, `c7mx0`, `6lobd` Fix A, `e7tgc.1`): the executing agent posts
  the concrete SQL on the issue and STOPS for your review BEFORE the first canonical-DB run ("prod apply"
  includes the local canonical DB — c3kb6 discipline).
- The R2 `.9` gate is NOT a schema — the recorded decision is no-schema-change; the gate is your
  ratification of the adjusted trigger conditions on the issue.
- **Master-gate restoration (P0-2/P0-3):** `Equoria-ip8kk` LANDED (73ca57f0b, closed). The one remaining
  fleet fix is `Equoria-3ewqy` (stale retryableTransactionWrapping sentinel pin; 0.4s local repro; one-line
  count bump — Sonnet-high sized). After it lands and the gates go green, the LEAD executes diagnosis
  steps 3–7 (triage run → two consecutive green CI runs → three green local authoritative runs on a frozen
  HEAD → WS5 checklist → timed hook run) — **hold all other fleet pushes during the consecutive-green
  window** — and only **then YOU** execute the exception-removal (steps 8–9 of
  `docs/debugging-reports/2026-07-06-master-gate-diagnosis.md`, Principle 6). Treat the first post-fix run
  as a **triage run** — Coverage/E2E/Docker/Beta/Deploy gates were starved ~3 weeks and may surface backlog
  failures, not regressions; attribute any red by first reproducing at the pre-fleet baseline HEAD.

### Serial Lane A — money + show (`showController.mjs` + XP writers)

One agent, in this exact order across both epics:

```
R1 8sag0  (feed/craft JSONB)                # OPEN — fix one controller, file per-controller children
R1 otii0 ✓ → n4m5j ✓                        # closed
R1 wsj2i ✓ → geo1a ✓                        # closed (geo1a has NO core — the extraction is .4's step 1)
R1 jvi3u ✓                                   # CLOSED 2026-07-06 (e9a1e1582; addXpToUserCore exists)
R1 8pb6w → c7mx0 → 3k96w → g8qg0            # showController money cluster (c7mx0 dep wired)
R2 .45 (enterShow maxEntries/slot guard)     # after 8pb6w/g8qg0 — same entry tx (deps wired)
R2 .4  (show XP award)                       # prereqs all landed; extracts award → competitionAwards.mjs + addXpToHorseCore
R1 709qm (retire legacy writers)             # AFTER .4 (dep wired) — .4 extracts what 709qm retires
R2 xal4m (cron totalEarnings → Hall of Fame) # right after .4 (dep wired)
R2 .11 (full scorer)                         # AFTER .4 (dep wired); ek242 is its near-dup — user decides engine, one issue survives
R2 .14 (<2-entry cancel/refund)              # showController settlement — after c7mx0/8pb6w (deps wired)
R1 icqqm                                     # groomSalaryService + migration — own file; slot in this agent's run (SQL-review gate)
R1 gumnp                                     # ◐ IN_PROGRESS (claimed 2026-07-06 by another session) — do not dispatch without checking
R1 6lobd                                     # leaderboard Int migration (Fix A approved; SQL-review gate) — heads the leaderboard cluster
```

`icqqm`/`c7mx0`/`6lobd` migrations: design approved; concrete SQL posted for user review BEFORE the first
canonical-DB run. `g8qg0` = enforce brackets (decided), but the level(horseXp)→bracket formula needs a
one-line user pin — propose on the issue first.

### Serial Lane B — roster / staff

One agent (can be the same as Lane A if you're running a single money/staff agent):

```
R1 n4m5j            # groom cap (count-in-tx)   — landed in Lane A; .8 copies its pattern
R2 .8               # rider/trainer cap
R2 retired-staff-still-assignable
R2 .68              # PRD traceability — needs .8 + .26 (rider retirement, decided 104w)
```

### Parallel fan-out pool — agent team, disjoint files (run in tandem with the lanes)

Frontend "wire it up" (R2): `.2`, `.3`, `.6` (then its groom-panel chain `.20`→`.21`→`.22`, serialized —
shared files), DevelopmentTracker page, competition browser filters (`.12`→`.13`, same page), Create Show
UI, rider dismissal UI, NextActions/WhileYouWereGone. Plus R2 `.10` (a11y infra) and the P3
doc-reconciliation batch (EXCEPT SECURITY.md editors — Lane C). Each in its own worktree; the lead lands
one commit at a time. REMOVED from the pool (2026-07-06): `.5` (landed d90f50c24 — verify-and-close, plus
follow-up E2E `dyoyi`).

R1 `709qm` is NOT disjoint (corrected 2026-07-06) — it retires `enterAndRunShow`, which `.4` extracts award
logic from. Moved to Serial Lane A, after `.4`.

**Round 4 (Day 4 doc-drift / dead-code, 2026-07-06):** parallel-safe → `oierg`, `3khb1`, `2ghng`, `xbabf`,
`caqrq`, plus validated P1s `49bc2` / `4hra5` / `m54lr` / `r4cyk` (assign model per each issue's validation
note). See `FABLE_ROUND4_FLEET_PROMPTS.md`.

### Serial Lane C — SECURITY.md (added 2026-07-06; membership corrected same day)

These all edit `.claude/rules/SECURITY.md`; one agent, serial, to avoid conflicts: `3giol`, `wvf0z`,
`av27e` (◐ resume-and-finish — sweep complete, appendix + closure remain), the two REMOVE decisions
`oey96.30` (absorbed `d0qur`, incl. its breeding/training/transaction sections + 30d→7d cooldown text) +
`hjnrc`, **and `oey96.61`, `7rc1q`, `mi64z`, `nzhu8`** (same file; previously mis-pooled as parallel).
**Land `oey96.15` before `oey96.30`'s A04 section rewrite** — `.15` proves `canTrain` is a partial
false-green, so the rewritten doc must reflect it (bd dep wired). The stale no-op trio
`49dzc`/`pey97`/`xbir9` (content already documented) is NOT in the lane — user verify-and-close.

### Stud Service Lane — Epic Equoria-e7tgc (added 2026-07-06)

New feature, largely independent of the other lanes; one agent follows the build order. Decisions baked in:
same-breed-only (crossbreed stub), S1 migration APPROVED (review final SQL before prod), non-owner cancel =
404-shape.

```
S1 (e7tgc.1, migration — APPROVED) → S3 + S4 + S2 (parallel) → S5 → S6 → S7 → S8 → S9 + S10 (parallel) → S11
```

- **Public-stud fast path (not gated by S1):** S2/S3/S4/S5/S9 ship on their own. Private stud
  (S6/S7/S8/S10/S11) needs S1.
- Reuses `mhdul`'s breeding guards (closed) + the dam cooldown at `horseFoalingController.mjs:26`; follow-up
  `3sfys` unifies `createFoal` — coordinate if breeding/foaling code is touched elsewhere.
- Every concurrency sentinel must record a proven-to-FAIL run against a naive variant first.
- Full prompts: `FABLE_ROUND5_STUD_FLEET_PROMPTS.md`.

### Gated chains (start only when the upstream lands)

```
USER ratifies .9's trigger-condition mapping (no schema!) → R2 .9 (exotic triggers) → R2 .31 (Phoenix-Born)
R2 .16 (foal cadence, DECIDED 7-day game-year clock — decision note now on the issue) → .17 → .19 ; and → .18 / .46
T8 stud-service epic = Equoria-e7tgc (FILED; mhdul landed) → run per FABLE_ROUND5 / HANDOFF.md
```

### Decision gates still open (agent presents options, waits — no pre-decision)

Labs exposure (`oey96.37` — NOTE `20o40`'s "labs is dead code" premise is FALSE, labs IS mounted; `.37` is
canonical), conflict resolution (`.34`), task-panel scope (`.23`), rider-discovery stub (`.49`), scorer
engine (`.11` vs its near-dup `ek242` — pick one engine, close the other). RESOLVED gates: gameIntegrity
fate → REMOVE (2026-07-06, on `.30`/`hjnrc`).

---

## How to run it in practice

1. **You:** work the user-action list in HANDOFF.md (verify-and-close queue, decision gates, SQL reviews,
   exception removal at the end).
2. **One money/staff agent (Opus xhigh):** works Serial Lane A then Lane B in the order above.
3. **One agent team (mixed Opus/Sonnet):** chews the parallel fan-out pool concurrently; the lead serializes
   the pushes.
4. **One agent:** Serial Lane C (SECURITY.md).
5. Gated chains and the decision gates open up as their upstreams land.

The only hard invariants: nothing in a serial lane runs concurrently with another issue in the same lane,
`.4` never precedes the XP writers, and every push is serial regardless of how parallel the work was.
