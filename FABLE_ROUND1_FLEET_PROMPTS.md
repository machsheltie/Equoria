# Fable Round 1 — Fleet Hand-off Prompts (economy transaction-correctness audit, 2026-07-02)

Companion to `FABLE_SPRINT_PLAN.md`. One ready-to-paste prompt per issue from Fable's Day 1 audit, in the
dependency-ordered queue Fable produced. Hand these to the coding agent one at a time.

## How to use each block

1. Paste the **`/safe-ralph` line** (it enforces the `--completion-promise` required by
   `EDGE_CASE_FIX_DISCIPLINE §5a`).
2. Paste the **context block** underneath it. The agent reads the full issue itself via `bd show <id>`
   and inherits `CLAUDE.md`, so the block only carries what `bd` doesn't: the cluster fix template, the
   reference implementation to copy, the one sentinel test for that issue, and the specific trap to avoid.
3. When it returns failing-then-passing evidence, **you** review the diff and approve closure. The agent
   does not self-close.

## Model / effort per issue

`Opus 4.8 @ xhigh` for anything money-path or with a "template can go wrong here" trap. `Sonnet 5 @ high`
is fine for the genuinely mechanical ones. Tags are on each heading.

## Run order & status

| #   | Issue | Cluster     | Model       | Status (refreshed 2026-07-06 evening vs bd)                                                                                               |
| --- | ----- | ----------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 8sag0 | 4           | Opus xhigh  | **OPEN — Ready.** Split into per-controller child commits (file the children as bd issues so the remaining 3 controllers are schedulable) |
| 2   | otii0 | 1           | —           | ✅ CLOSED (landed 28d01bfbc)                                                                                                              |
| 3   | n4m5j | 2 (variant) | —           | ✅ CLOSED (landed ebd670e9c)                                                                                                              |
| 4   | t7ywe | 1           | —           | ✅ CLOSED (landed 28d01bfbc)                                                                                                              |
| 5   | wsj2i | 2           | —           | ✅ CLOSED (landed 10102eb14)                                                                                                              |
| 6   | geo1a | 3           | —           | ✅ CLOSED (landed e3373193b; NOTE: no addXpToHorseCore — the extraction is oey96.4's first step)                                          |
| 7   | jvi3u | 3           | —           | ✅ CLOSED (landed e9a1e1582; addXpToUserCore exists)                                                                                      |
| 8   | gumnp | 5           | Opus xhigh  | ◐ IN_PROGRESS (claimed 2026-07-06 by another session) — do NOT dispatch without checking with the user                                    |
| 9   | 8pb6w | 2           | Opus xhigh  | **OPEN — Ready.** Prerequisite for c7mx0 (bd dep wired)                                                                                   |
| 10  | 3k96w | 8           | Sonnet high | **OPEN — Ready**                                                                                                                          |
| 11  | mhdul | 8           | —           | ✅ CLOSED (landed 5b004a87c)                                                                                                              |
| 12  | icqqm | 6           | Opus xhigh  | **OPEN** — ✅ migration spec APPROVED 2026-07-06; user reviews the concrete SQL BEFORE the first canonical-DB run (see block below)       |
| 13  | c7mx0 | 7           | Opus xhigh  | **OPEN** — ✅ APPROVED same terms; run after 8pb6w (bd dep wired)                                                                         |
| 14  | 709qm | 8           | Sonnet high | **OPEN** — ⚠ AFTER oey96.4 (bd dep wired; extract-before-delete)                                                                          |
| 15  | g8qg0 | 8           | Opus xhigh  | **OPEN — Ready** — decision: ENFORCE brackets; land after 8pb6w in Lane A                                                                 |
| 16  | i8eoy | 8           | —           | ✅ CLOSED — superseded by epic Equoria-e7tgc (Round 5)                                                                                    |

---

## GLOBAL GUARDRAILS (apply to every issue below)

```
Apply these on every issue in this hand-off (they mirror CLAUDE.md, which you also inherit):
- Session start: git checkout master && git pull --rebase; bd show <id>; bd update <id> --status=in_progress.
- SENTINEL FIRST: write the test, run it, confirm it FAILS against current code, paste the failure —
  THEN write the fix (EDGE_CASE_FIX_DISCIPLINE §1). A test that can't fail first proves nothing.
- Real DB, no mocks. TestFixture- prefixed fixtures, id-scoped cleanup, Promise.all to drive races.
- After the fix, RE-RUN the suite for that area and paste the passing output (OPTIMAL_FIX §10) — not
  "no expected regressions."
- One issue = one or two commits = one push, on master. Do NOT bundle in an adjacent issue.
- Run the §9 self-critique pass before writing any "done" summary.
- Do NOT self-close. Post the evidence (failing→passing output, files, §8 checklist) on the issue and
  STOP for my closure approval (Principle 6 / COMPLETION_VERIFICATION_POLICY).
- PIN MAINTENANCE: if your fix adds, removes, or moves a `prisma.$transaction` site, update the pinned
  counts in `backend/__tests__/retryableTransactionWrapping.sentinel.test.mjs` in the SAME commit, and run
  that sentinel locally before pushing (sub-second). Commit 28d01bfbc broke master for 3 days by skipping
  exactly this. Same applies to any file listed in a structural sentinel's pin table.
- MIGRATIONS: "approved" means the DESIGN is approved. The user reviews the concrete migration SQL +
  dedupe/backfill statements BEFORE the first run against the canonical DB — the local dev DB IS the
  canonical DB with real player data ("prod apply" is NOT Railway-only; c3kb6 discipline).
- Push per the active exception: run `bash scripts/doctrine-checks/run-all.sh`, confirm exit 0, then
  `git push origin master --no-verify`.
```

---

## 1 — Equoria-8sag0 (Cluster 4) — Opus xhigh — FIX FIRST

> ✅ **LANDED 2026-07-07 (commit 51890c184, pushed cf9b7ce0a) — AWAITING USER CLOSURE.** Fixed the **feedShop** leg (debit-first row-lock → post-lock re-read → merge → write); concurrent-race red→green, feedShop 19 + sentinel 28 green. Per-controller children FILED: `Equoria-cmvmy` (crafting), `Equoria-q9nqm` (inventory/equip — the higher-severity item-dup), and `Equoria-a2xce` (tack, pre-existing). Do NOT re-dispatch 8sag0; the remaining legs are the 3 child issues. Lane A money/show chain (8pb6w→c7mx0→g8qg0→oey96.4→…) is now clear to proceed.

```
/safe-ralph Equoria-8sag0 fix the feed/crafting/tack/equip JSONB read-modify-write money-loss + dup; sentinel fails-first then passes; evidence on the issue; awaiting my closure
```

```
Read the full spec: bd show Equoria-8sag0. Apply the GLOBAL GUARDRAILS.

Cluster 4 — JSONB read-modify-write ordering. The rule: inside the tx, DEBIT FIRST (the row lock),
THEN read settings, THEN merge, THEN write — the debit's row lock serializes the read-modify-write.
Reference for single-key updates: bankController.claimWeeklyReward guarded jsonb_set (bankController.mjs:70-84).

Sentinel that must fail first: two concurrent feed purchases → both quantities present AND two debits
(current code loses one add).

Traps (from the audit):
- The equip/unequip leg has NO debit to supply the row lock. Acquire an explicit lock first (raw
  SELECT ... FOR UPDATE on the user row, or a guarded no-op updateMany) before the settings read.
- Crafting leg: keep the pre-tx deficit check as a fast-path 400, but the AUTHORITATIVE deficit check
  must re-run post-lock INSIDE the tx — otherwise you've only moved the race.
- This touches ~4 controllers (feedShop, crafting, inventory, tackShop) ≈ 4 commits. SPLIT into
  per-controller child issues rather than one oversized session (Constitution §5). File the children,
  fix one here, leave the rest queued.
- Shared-file note: tmjkw (existing P3) also edits marketplace controllers — coordinate if it's live.
```

---

## 2 — Equoria-otii0 (Cluster 1) — Opus xhigh

```
/safe-ralph Equoria-otii0 harden the groom direct-hire money debit to the in-tx debitMoneyOrThrow pattern; sentinel fails-first then passes; evidence on the issue; awaiting my closure
```

```
Read the full spec: bd show Equoria-otii0. Apply the GLOBAL GUARDRAILS.

Cluster 1 — un-hardened money debit (TOCTOU + off-ledger + unpaired burn). The hardened twin ALREADY
EXISTS in-repo — copy it, don't reinvent:
  Reference: trainerMarketplaceController.refreshTrainerMarketplace (trainerMarketplaceController.mjs:128-170,
  the t65fh/kl16c fix) and groomMarketplaceController.hireFromMarketplace (:226-272).
  Skeleton:
    await withRetryableTxMapping(prisma.$transaction(async tx => {
      await debitMoneyOrThrow(tx, { userId, amount, systemAccount: SYSTEM_ACCOUNT_BURN,
        category: '<sink>_burn', description, metadata });   // atomic predicate + paired credit
      /* ...the paid-for effect writes, same tx... */
      await recordTransactionTx(tx, { userId, type: 'debit', amount, category: '<sink>', ... });
    }), { message: '...busy...' });
    // catch: instanceof InsufficientFundsError -> 400

Sentinel that must fail first: two concurrent hires with a wallet for only one → exactly one 201, money
never negative, burn credited once.

Scope fence: otii0 unblocks n4m5j (same file, hireGroom). Do NOT also fix n4m5j this session.
```

---

## 3 — Equoria-n4m5j (Cluster 2, variant) — Opus xhigh — run after otii0

```
/safe-ralph Equoria-n4m5j enforce the groom roster cap under concurrency (count-in-tx after the row lock); sentinel fails-first then passes; evidence on the issue; awaiting my closure
```

```
Read the full spec: bd show Equoria-n4m5j. Apply the GLOBAL GUARDRAILS. Builds on otii0's tx restructure
(same file, groomRosterController.mjs) — otii0 must be landed first.

CRITICAL TRAP: the cap is a COUNT, not a column, so the Cluster 2 conditional-updateMany template CANNOT
express it. A fleet agent that pattern-matches the template onto a count will produce a guard that
compiles and silently does nothing. The correct form:
  1. debit first (row lock on the user), inside the tx,
  2. then tx.groom.count({ where: { userId } }) INSIDE the same tx,
  3. throw if the count is over MAX_GROOMS_PER_USER.
The user row lock is what serializes concurrent hires so the count is accurate.

Sentinel that must fail first: two concurrent hires at cap−1 → exactly one 201, final count == MAX.
```

---

## 4 — Equoria-t7ywe (Cluster 1) — Opus xhigh

```
/safe-ralph Equoria-t7ywe harden the groom-marketplace refresh money debit to the in-tx debitMoneyOrThrow pattern; sentinel fails-first then passes; evidence on the issue; awaiting my closure
```

```
Read the full spec: bd show Equoria-t7ywe. Apply the GLOBAL GUARDRAILS.

Cluster 1 — same fix as otii0. Copy the hardened twin:
  Reference: groomMarketplaceController.hireFromMarketplace (groomMarketplaceController.mjs:226-272) and
  trainerMarketplaceController.refreshTrainerMarketplace (:128-170).
  Skeleton: withRetryableTxMapping(prisma.$transaction(tx => debitMoneyOrThrow(tx, {..SYSTEM_ACCOUNT_BURN..})
  + effect writes + recordTransactionTx(tx, ...))); catch InsufficientFundsError -> 400.

Sentinel that must fail first: concurrent force-refreshes with a wallet for only one → one 400, money
never negative.

Shared-file note: tmjkw touches groomMarketplaceController.mjs — coordinate if it's live.
```

---

## 5 — Equoria-wsj2i (Cluster 2) — Opus xhigh — unblocks geo1a

```
/safe-ralph Equoria-wsj2i make stat-point allocation an atomic conditional claim; sentinel fails-first then passes; evidence on the issue; awaiting my closure
```

```
Read the full spec: bd show Equoria-wsj2i. Apply the GLOBAL GUARDRAILS. File: horseXpModelService.mjs.

Cluster 2 — read-check-write on a counter → atomic conditional claim.
  Reference: the conditional updateMany claim — buyHorse (marketplaceController.mjs:319-330), show claim
  (showController.mjs:476-487), pregnancy claim (horseFoalingController.mjs:158-168).
  Skeleton:
    const claim = await tx.<model>.updateMany({
      where: { id, availableStatPoints: { gte: needed } },
      data:  { availableStatPoints: { decrement: needed }, ...effects },
    });
    if (claim.count === 0) throw typed409or400;  // reject, never partial

Sentinel that must fail first: two concurrent allocations at 1 available point → exactly one success,
availableStatPoints == 0. (This is the "farmable free stats → competition prizes" path — get it right.)

Scope fence: wsj2i unblocks geo1a (same file). Do NOT also fix geo1a this session.
```

---

## 6 — Equoria-geo1a (Cluster 3) — Opus xhigh — run after wsj2i

```
/safe-ralph Equoria-geo1a make addXpToHorse increment-only with monotone level + in-tx event; sentinel fails-first then passes; evidence on the issue; awaiting my closure
```

```
Read the full spec: bd show Equoria-geo1a. Apply the GLOBAL GUARDRAILS. Same file as wsj2i
(horseXpModelService.mjs) — land wsj2i first.

Cluster 3 — absolute-write-from-stale-read on accumulators → increment-only rewrite.
  Skeleton:
    const updated = await tx.horse.update({ where: { id }, data: { xp: { increment: amount } } });
    const target = levelFor(updated.xp);
    await tx.horse.updateMany({ where: { id, level: { lt: target } }, data: { level: target } }); // monotone
    await tx.<xpEvent>.create({ ... });   // audit row in the SAME tx

TRAPS:
- Derive level/stat-points from the RETURNED post-increment value, NEVER a re-read (a fresh read re-creates
  the race). statPointsGained = f(newXp) − f(newXp − amount).
- The level write must be the conditional monotone form; a plain `level: target` quietly reintroduces
  regression.

TX-AWARE CORE (per the XP-award architecture spec on Equoria-oey96.4): also expose addXpToHorseCore(db, ...)
that performs the increment/level/event against a PASSED client, with the public addXpToHorse as a thin
transactional wrapper. The overnight-show cron (oey96.4) must call the core INSIDE its own outer
$transaction without opening a nested one — otherwise it deadlocks on the row lock the prize payout already
holds. This issue must LAND BEFORE oey96.4.

Sentinel that must fail first: 10 concurrent +5 XP → exactly +50; and an injected xpEvent-create failure
rolls back the XP increment.
```

---

## 7 — Equoria-jvi3u (Cluster 3) — Opus xhigh — must LAND BEFORE oey96.4

```
/safe-ralph Equoria-jvi3u make addXpToUser increment-only with monotone level + in-tx event, and expose a tx-aware core; sentinel fails-first then passes; evidence on the issue; awaiting my closure
```

```
Read the full spec: bd show Equoria-jvi3u. Apply the GLOBAL GUARDRAILS. File: userModelService.mjs.

Cluster 3 — same shape as geo1a:
  const updated = await tx.user.update({ where: { id }, data: { xp: { increment: amount } } });
  const target = levelFor(updated.xp);
  await tx.user.updateMany({ where: { id, level: { lt: target } }, data: { level: target } });
  await tx.<xpEvent>.create({ ... });  // same tx

TRAP: level must be derived from the RETURNED post-increment value, never a re-read; use the conditional
monotone level write, not a plain assignment.

TX-AWARE CORE (per the XP-award architecture spec on Equoria-oey96.4): expose addXpToUserCore(db, ...) that
runs against a PASSED client, with the public addXpToUser as a thin transactional wrapper. The overnight-show
cron (oey96.4) calls this core INSIDE its outer $transaction — if it opens its own tx it deadlocks on the
user-row lock the prize payout already holds. This issue must LAND BEFORE oey96.4.

Sentinel that must fail first: 10 concurrent +5 XP → exactly +50, level correct.
```

---

## 8 — Equoria-gumnp (Cluster 5) — Opus xhigh

```
/safe-ralph Equoria-gumnp pull createHorse into the purchase tx and delete the refund saga; sentinel fails-first then passes; evidence on the issue; awaiting my closure
```

```
Read the full spec: bd show Equoria-gumnp. Apply the GLOBAL GUARDRAILS. File: marketplaceController.mjs.

Cluster 5 — effect outside the money tx / compensation saga → pull it in.
  Reference: buyHorse — everything in one tx. createHorse already accepts a Prisma client; pass tx, then
  DELETE the refund saga (which also removes the statusCode-before-refund ordering bug appended to this
  issue: catch returns on err.statusCode before the coinDeducted refund check; err.nameCollision branch
  is dead code at marketplaceController.mjs:583,660,678,702).

TRAP: moving createHorse into the tx keeps the name-collision findFirst racy (no DB unique on horse name).
That's an acceptable residual — but generate the name BEFORE the tx to shrink tx time, and keep the 30s
timeout.

Sentinel that must fail first: an injected post-createHorse failure inside the tx → the horse AND the
charge both roll back.
```

---

## 9 — Equoria-8pb6w (Cluster 2) — Opus xhigh — prerequisite for c7mx0

```
/safe-ralph Equoria-8pb6w re-check status='open' in the entry tx and decrement (not zero) feeEscrow at settlement; sentinel fails-first then passes; evidence on the issue; awaiting my closure
```

```
Read the full spec: bd show Equoria-8pb6w. Apply the GLOBAL GUARDRAILS.
Files: showController.mjs (330-368, 766), competitionRouteQueries.mjs.

Cluster 2 — the entry tx never re-checks status='open', and settlement writes feeEscrow: 0 instead of
decrementing. Fix with the conditional-claim guard on the entry, and decrement feeEscrow at settlement.
  Reference: show claim (showController.mjs:476-487) for the status-predicate claim shape.

TRAP: the free-entry path (entryFee === 0) has NO feeEscrow increment to carry the status predicate — that
branch needs its own conditional status touch, or the guard silently fails to cover free shows.

Sentinel that must fail first: an entry racing the claim → wallet unchanged, no ShowEntry, 409; AND
settlement decrement preserves a concurrent increment.

Scope note: this is a prerequisite for c7mx0 (same file, functional dependency). Land it first.
Adjacent — do NOT fold in: wmwbr is a SEPARATE Lane A defect in the same executeClosedShows settlement
path (a failed entry-tx permanently stranding fee-escrow). Keep it out of this fix; it lands later in
Lane A, and oey96.4's Test C must not mask it.
```

---

## 10 — Equoria-3k96w (Cluster 8) — Sonnet high

```
/safe-ralph Equoria-3k96w reject non-integer prize/fee at the 400 boundary; sentinel fails-first then passes; evidence on the issue; awaiting my closure
```

```
Read the full spec: bd show Equoria-3k96w. Apply the GLOBAL GUARDRAILS. File: showController.mjs (createShow).

Cluster 8 — boundary validation. Add Number.isInteger checks at the 400 boundary so a non-integer
prize/fee returns 400, not a 500.

Sentinel that must fail first: createShow with prize: 100.5 → 400 (currently 500).

Scope note: touches createShow — a DIFFERENT function from 8pb6w/c7mx0/g8qg0 in the same file. Slotted
here to avoid rebasing across those. Keep the change to createShow only.
```

---

## 11 — Equoria-mhdul (Cluster 8) — Sonnet high

```
/safe-ralph Equoria-mhdul add self-cross + sex guards to breeding and wire the 7-real-day dam cooldown; sentinel fails-first then passes; evidence on the issue; awaiting my closure
```

```
Read the full spec: bd show Equoria-mhdul. Apply the GLOBAL GUARDRAILS.
Files: horseFoalingController.mjs, horseFoalRoutes.mjs.

Cluster 8 — missing server-side rule enforcement. Two parts:
- Self-cross + sex guards (mechanical, land now): reject sireId === damId and wrong-sex parents with 400
  BEFORE any DB work. Canonical form: self-cross guard at horseGeneticsController.mjs:318-323
  (CONTRIBUTING §4 — guard before any prisma.* call).
- Cooldown (USER DECISION 2026-07-02; anchor confirmed 2026-07-06): dam-only, 7 REAL DAYS = 1 game year,
  CONCEPTION-ANCHORED on `lastBredDate` (already exists — stamped once at conception; NO new column).
  Guard: getHorseAgeDays(dam.lastBredDate, now) < 7 → 400; stallions unrestricted. Compute via
  backend/utils/horseAge.mjs (UTC date-only), never ms-delta. SECURITY.md's "30 days" is superseded.
  ⚠ TRAP: getHorseAgeDays(null) returns 0 — the null / never-bred check MUST come first, or every
  never-bred mare is blocked. Semantics: this enforces one-conception-per-game-year and blocks the
  early-foaling insta-re-breed path (NOT a post-foaling rest year).

Sentinel that must fail first: sireId === damId → 400, dam row unstamped (no DB mutation).
```

---

## 12 — Equoria-icqqm (Cluster 6) — Opus xhigh — ✅ APPROVED 2026-07-06 (design)

```
/safe-ralph Equoria-icqqm add the weekKey idempotency column + unique index with dedupe/backfill and make the salary cron re-run-safe; sentinel fails-first then passes; SQL posted for user review BEFORE any canonical-DB run; evidence on the issue; awaiting my closure
```

```
✅ APPROVED 2026-07-06 — the migration DESIGN. GATE THAT REMAINS: write the concrete migration SQL +
dedupe/backfill statements, POST THEM ON THE ISSUE, and STOP for the user's SQL review BEFORE the first
run against the canonical DB (the local dev DB IS real player data — c3kb6 discipline; "prod apply" is
not Railway-only). After sign-off, apply locally, then the user runs/authorizes the prod apply.
```

```
Read the full spec: bd show Equoria-icqqm. Apply the GLOBAL GUARDRAILS. File: groomSalaryService.mjs + migration.

Cluster 6 — missing per-period idempotency key.
  Add a weekKey column + unique (userId, groomId, weekKey, paymentType); create the payment rows in the
  SAME tx as the debit; treat a P2002 unique violation as "already paid this week, skip."
  Reference backstop pattern: ShowEntry @@unique([showId, horseId]).
  Also lock the currently-unlocked manual trigger (Constitution advisory-lock pattern).

TRAP: the unique constraint will FAIL to apply if historical double-pay rows already exist. The migration
must dedupe first, or use a partial index (WHERE "weekKey" IS NOT NULL). Inspect real salary data before
writing the migration (this is what Day 2 produces).

Sentinel that must fail first: run the salary job twice in the same week → exactly one debit per user;
the second run reports the rows skipped.
```

---

## 13 — Equoria-c7mx0 (Cluster 7) — Opus xhigh — ✅ APPROVED 2026-07-06 (design) — run after 8pb6w

```
/safe-ralph Equoria-c7mx0 add claimedAt + persisted scored-ordering and a stale-claim reaper so a crashed executing show is re-driven exactly once; sentinel fails-first then passes; SQL posted for user review BEFORE any canonical-DB run; evidence on the issue; awaiting my closure
```

```
✅ APPROVED 2026-07-06 — the migration DESIGN (additive claimedAt + persisted scored-ordering columns).
Run after 8pb6w lands (bd dep wired). Same SQL-review gate as icqqm: post the concrete migration SQL on
the issue and STOP for user review BEFORE the first canonical-DB run.
```

```
Read the full spec: bd show Equoria-c7mx0. Apply the GLOBAL GUARDRAILS.
Files: showController.mjs + a nightly reaper job + migration.

Cluster 7 — unrecoverable intermediate state → stale-claim reaper + idempotent re-drive. A show that
crashes between the 'executing' claim and 'completed' currently freezes the full prize + all entry fees
in escrow forever. Add a reaper that re-drives stuck 'executing' shows exactly once.
  Nearest kin: the koodu claim-then-process ordering + the @@unique result-row backstop that makes
  "skip entries that already have a competitionResult row" a safe re-drive predicate.

TRAPS:
- Prize shares depend on placement across ALL entries, and rider assignments can change between crash and
  re-drive → re-scoring is NOT deterministic. Persist the scored ordering AT CLAIM TIME (inside the claim
  tx) so payout is a pure replay.
- NEVER re-pay an entry that already has a competitionResult row (user.update increment is not idempotent
  on its own).

Sentinel that must fail first: a simulated stuck 'executing' show → the reaper pays exactly once; a
second reaper run is a no-op.
```

---

## 14 — Equoria-709qm (Cluster 8) — Sonnet high — ⚠ AFTER oey96.4

```
/safe-ralph Equoria-709qm deprecate the legacy non-ledger money writers with a throw + doctrine grep sentinel; sentinel fails-first then passes; evidence on the issue; awaiting my closure
```

```
Read the full spec: bd show Equoria-709qm. Apply the GLOBAL GUARDRAILS.
Files: userUpdates.mjs, horseUpdates.mjs, competitionController.mjs.

Cluster 8 — the legacy non-ledger money writers are still importable, a re-wiring hazard. Add a
deprecation-throw so they can't be used in production paths, plus a doctrine grep sentinel that fires if
any production code imports them (mirror the module-barrel ESLint enforcement pattern).

Sentinel that must fail first: a planted production import of updateUserMoney → the doctrine sentinel
fires (and passes when the import is removed).

⚠ ORDERING (2026-07-06 reconciliation): 709qm also retires enterAndRunShow, which oey96.4 extracts its
award logic FROM. Land AFTER .4 (extract before delete). If it must go first, it MUST preserve
calculateStatGains / awardCompetitionXp so .4 can still extract them. Otherwise files are disjoint.
```

---

## 15 — Equoria-g8qg0 (Cluster 8) — Opus xhigh — decision: ENFORCE

```
/safe-ralph Equoria-g8qg0 enforce competition level brackets server-side; sentinel fails-first then passes; evidence on the issue; awaiting my closure
```

```
Read the full spec: bd show Equoria-g8qg0. Apply the GLOBAL GUARDRAILS.
Files: showController / competitionRoutes.

USER DECISION 2026-07-02: ENFORCE the level brackets (do NOT remove them). A horse may only enter the
competition bracket matching its level. Add the server-side validation + sentinel test.

Sentinel that must fail first: an out-of-bracket entry → 400, wallet unchanged.

Shared-file note: shares showController with 8pb6w (different function/concern) — land after 8pb6w to
avoid a rebase, and keep the change to the eligibility path.
```

---

## 16 — Equoria-i8eoy — NOT a simple fix — build from the T8 epic

```
Do NOT run a one-off fix on Equoria-i8eoy. USER DECISION 2026-07-02: BUILD & SHIP the stud service as a
real feature (public + private modes). It is spec'd in FABLE_SPRINT_PLAN.md as the "T8 — Stud Service
feature spec" session; Fable will file a bd EPIC with fleet-sized child issues. Build from those child
issues, not from this one-line placeholder. Once the T8 epic exists, mark i8eoy superseded by it.
```
