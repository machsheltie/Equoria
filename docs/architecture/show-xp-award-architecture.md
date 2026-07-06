# Show-Cron XP & Progression Award Architecture (P1-3 / Equoria-oey96.4)

**Date:** 2026-07-06
**Author:** Fable (design session — DESIGN ONLY, no implementation in this commit)
**Implements:** PRD-03 §2.1 award table; Epic BACKEND-A BA.4 steps 4–5
**Consumes:** `Equoria-oey96.4` (the implementation issue), `Equoria-jvi3u` (prerequisite)
**Status:** Ready for implementation — all design decisions resolved below; the implementer should need zero new decisions.

---

## 1. Problem

`executeClosedShows` (backend/modules/competition/shows/showController.mjs:418) is the **only live competition path** (legacy instant path is 410 Gone). Per entry it creates a `competitionResult`, pays prize money from escrow, updates rider stats, sets the `firstWin` milestone, fires notifications, and awards **rider** XP — but never awards **horse XP**, **user XP**, or **stat gains**. Competing therefore produces zero player/horse progression, and it is the only progression path from competition.

### The authoritative award table (PRD-03 §2.1, verified 2026-07-06 at docs/product/PRD-03-Gameplay-Systems.md:141-146)

| Placement | Prize share | Horse XP | User XP | Stat-gain chance |
| --------- | ----------- | -------- | ------- | ---------------- |
| 1st       | 50%         | 30       | 20      | 10%              |
| 2nd       | 30%         | 27       | 15      | 5%               |
| 3rd       | 20%         | 25       | 10      | 3%               |
| **4th+**  | 0%          | **20**   | 0       | 0%               |

**AC3 contradiction check — resolved, no STOP needed:** the legacy constants agree with the PRD exactly. `awardCompetitionXp` (horseXpModelService.mjs:314) = 20 base + 10/7/5 bonus = 30/27/25, default 20 for other placements; `enterAndRunShow` user XP switch = 20/15/10; `calculateStatGains` (utils/competitionRewards.mjs:47) = 0.10/0.05/0.03. One improvement over legacy behavior: legacy only awarded inside `if (simResult.placement)` so 4th+ never got their 20 participation XP; the PRD says they should. **This design awards per the PRD table: every entrant gets horse XP; only top-3 get user XP and a stat-gain roll.**

---

## 2. Current state (verified line references)

### The executor (target)

Per show: atomic claim `updateMany({where:{id, status:'open'}, data:{status:'executing'}})` (line 476, Equoria-dyj3y — the multi-replica mutex), score entries, mark show `completed` **before** entry processing (line 580, Equoria-koodu claim-then-process), then `Promise.all` over per-entry ops (line 592-719). Each entry gets ONE interactive `prisma.$transaction` (line 597) containing: `competitionResult.create` (unique `[showId, horseId]` backstop) → escrow debit + `user.money` increment → firstWin milestone → rider stat increments. Fail-soft OUTSIDE the tx: `awardRiderCompetitionXP`, placement notifications. Placement is stored as a **numeric string** (`` `${placement}` `` — "1"/"2"/"3"…, line 602).

### The legacy award block (source of truth for semantics, competitionController.mjs:372-460)

`updateHorseRewards(horseId, prizeWon, statGains)` (earnings + stat), `addXpToUser(horse.userId, 20|15|10)` + separate `logXpEvent`, `awardCompetitionXp(horseId, '1st'|'2nd'|'3rd', discipline)`. Placement is an **ordinal label**. Do not resurrect this controller; it stays 410 and untouched (its header governs; oey96.4 trap list).

### The writers

- `addXpToHorse` (horseXpModelService.mjs:47, Equoria-geo1a): **atomic and correct**, but it opens **its own** `prisma.$transaction` internally.
- `addXpToUser` (userModelService.mjs:202): **read-modify-write with absolute writes** — the open lost-update/level-regression bug `Equoria-jvi3u`. `logXpEvent` writes the `XpEvent` audit row in a separate, un-transacted statement (drift hazard).
- `calculateStatGains(placement, discipline, _rngFn = Math.random)`: already **RNG-injectable** — use this for deterministic tests; do not invent a new hook.

---

## 3. The two constraints that shape the design

### 3.1 Prisma cannot nest interactive transactions

oey96.4 AC5 requires awards **inside the per-entry `$transaction`**. Calling the existing `addXpToHorse`/`awardCompetitionXp` from inside that tx would open a _second, independent_ transaction on a _separate connection_. Because the outer tx already holds the winner's `users` row lock (the prize `money: {increment}}` at line 640), an inner tx touching the same user row (user XP) **blocks on the outer's lock while the outer awaits the inner — a guaranteed self-deadlock** that surfaces as P2028 tx-timeouts and rolls back the whole prize payout whenever `prize > 0`. Naive reuse of the existing writers is therefore not an implementation shortcut but a correctness bug.

**Resolution: tx-aware writer cores.** Every writer the awards path touches is refactored into a core that takes a Prisma client (tx **or** root) as its first argument, with the existing public function becoming a thin wrapper that opens its own transaction around the core. Public contracts do not change; existing callers and tests are untouched.

### 3.2 Exactly-once under multi-replica cron

`showScheduler` is a plain per-process `setInterval` (no advisory lock); N replicas each poll every 10 min. Existing protections and how XP rides them:

- **Cross-replica double-execution:** the atomic `open → executing` claim is the per-show mutex. The losing replica skips the show entirely — XP inherits this for free.
- **Duplicate per-entry processing (any future retry/repair path, or a bypassed claim):** `competitionResult` `@@unique([showId, horseId])`. **Ordering rule: `competitionResult.create` MUST remain the first write in the per-entry tx** (it already is — keep it that way). Any duplicate processing then aborts the entire tx with P2002 _before any XP statement executes_. The unique constraint is the idempotency token for the whole per-entry unit: result ⇔ prize ⇔ XP ⇔ stat-gain all-or-nothing.
- **Crash mid-show:** claim-then-process (status already `completed`) means unprocessed entries lose result+prize+XP **together** — a bounded, _consistent_ loss (absence of the result row = absence of every award). A future repair job can re-drive missing (showId,horseId) pairs safely because of the ordering rule above. (Building that repair job is explicitly out of scope — same posture as Equoria-koodu.)
- **Lost-update-free counters:** all XP/stat/level mutations are relative `{increment}` or guarded `updateMany` — no read-modify-write anywhere in the awards path.

---

## 4. Design

### 4.1 New module: `backend/modules/competition/services/competitionAwards.mjs`

Two exports, no `prisma.$transaction` anywhere in this file (it always receives a client):

```js
// Pure. Single source of the PRD-03 §2.1 table. Freeze it.
export function computePlacementAwards(placementNumber) {
  // 1 → { horseXp: 30, userXp: 20, statGainChance: 0.10, ordinal: '1st' }
  // 2 → { horseXp: 27, userXp: 15, statGainChance: 0.05, ordinal: '2nd' }
  // 3 → { horseXp: 25, userXp: 10, statGainChance: 0.03, ordinal: '3rd' }
  // >=4 (and any non-finite/invalid input) → { horseXp: 20, userXp: 0, statGainChance: 0, ordinal: `${n}th` }
}

// Tx-aware. Performs ALL progression writes for one placed entry.
// `db` is the interactive-tx client from executeClosedShows.
export async function awardPlacementProgression(
  db,
  { horseId, ownerId, placementNumber, discipline, horseName, showName, rng = Math.random }
) {
  const awards = computePlacementAwards(placementNumber);
  // 1. Horse XP (all entrants):
  await addXpToHorseCore(
    db,
    horseId,
    awards.horseXp,
    `Competition: ${awards.ordinal} place in ${discipline}`
  );
  // 2. User XP (top-3 only):
  if (awards.userXp > 0) {
    await addXpToUserCore(
      db,
      ownerId,
      awards.userXp,
      `${awards.ordinal} place with horse ${horseName} in ${discipline}`
    );
  }
  // 3. Stat gain (top-3 only, chance-gated):
  const statGain =
    awards.statGainChance > 0
      ? calculateStatGains(awards.ordinal, discipline, rng) // existing injectable fn, ordinal-keyed
      : null;
  if (statGain) {
    // Cap-safe atomic +1: no-op at the 0-100 stat ceiling instead of exceeding it.
    await db.horse.updateMany({
      where: { id: horseId, [statGain.stat]: { lt: 100 } },
      data: { [statGain.stat]: { increment: statGain.gain } },
    });
  }
  return { awards, statGain }; // for logging + notification payloads by the caller
}
```

Decisions encoded here:

- **Placement normalization** lives in `computePlacementAwards` (number in → ordinal out). The executor's numeric placements never touch the ordinal-keyed legacy functions directly. `calculateStatGains` keeps its ordinal keys (it is shared with legacy code paths and tests).
- **Stat cap:** guarded `updateMany` (`lt: 100`) — atomic, cap-safe, no read. `updateHorseRewards`/`updateHorseStat` are NOT reused (separate un-transacted writes, and they bundle earnings — see §7 adjacent issue).
- **RNG:** thread the existing `_rngFn` seam. `executeClosedShows` passes nothing (production `Math.random`); unit tests pass `() => 0` (always gains) and `() => 0.999` (never gains). No new test hook is invented and no production RNG behavior changes.
- The helper does **not** log or notify — the caller owns side channels (keeps the helper pure-ish and the tx short).

### 4.2 Writer refactors (tx-aware cores, public contracts unchanged)

**`horseXpModelService.mjs`** — extract the body of geo1a's transaction callback into `export async function addXpToHorseCore(db, horseId, amount, reason)` (increment horseXp → derive `statPointsGained` from post/pre values → conditional `availableStatPoints` increment → `horseXpEvent.create`, all on `db`). Public `addXpToHorse` becomes `prisma.$transaction(tx => addXpToHorseCore(tx, ...))` plus its existing validation/logging/return shape. `awardCompetitionXp` is untouched (legacy-only caller). The geo1a invariants (row-lock serialization, `Horse.horseXp == SUM(HorseXpEvent.amount)`) are preserved verbatim — the core IS geo1a's callback.

**`userModelService.mjs` + `xpLogModelService.mjs`** — this is **`Equoria-jvi3u`'s fix, landed first** (Serial Lane A order in FABLE_MASTER_SEQUENCE.md already mandates jvi3u before oey96.4). Its fix spec, made tx-aware so oey96.4 can consume it:

```js
export async function addXpToUserCore(db, userId, amount, reason) {
  const updated = await db.user.update({
    where: { id: userId },
    data: { xp: { increment: amount } }, // atomic; row lock serializes competitors
    select: { xp: true, level: true },
  });
  let targetLevel = updated.level;
  while (updated.xp >= xpThreshold(targetLevel + 1)) targetLevel++;
  if (targetLevel > updated.level) {
    // Conditional raise: a stale concurrent writer can never LOWER level.
    await db.user.updateMany({
      where: { id: userId, level: { lt: targetLevel } },
      data: { level: targetLevel },
    });
  }
  // Audit row commits/rolls back WITH the counter (closes the User.xp ≠ SUM(XpEvent) drift).
  await db.xpEvent.create({ data: { userId, amount, reason } });
  return { xpAfter: updated.xp, leveledUp: targetLevel > updated.level, newLevel: targetLevel };
}
```

Public `addXpToUser(userId, amount)` wraps the core in its own `$transaction` and keeps its exact current return shape (`success/currentXP/currentLevel/leveledUp/levelsGained/xpGained`) and the `invalidateCache` call **after** commit. Callers that today pair `addXpToUser` + separate `logXpEvent` (the legacy controller) are not migrated in this work — the core takes `reason` so _new_ callers get the in-tx audit row by construction. jvi3u's sentinel test (10 concurrent awards → exactly base+50) runs against the public wrapper.

**Level derivation note:** `leveledUp` is computed against this award's own post-increment value; under concurrency the `updateMany` guard makes the level write monotone. `XpEvent.reason` gains competition context (matches legacy reason strings, e.g. `"1st place with horse Star in Racing"`).

### 4.3 Wiring into `executeClosedShows`

Inside the existing per-entry `$transaction` (line 597), **after** the rider-stat update (last current statement, ~line 677) and **never before `competitionResult.create`**:

```js
const progression = await awardPlacementProgression(tx, {
  horseId: entry.horseId,
  ownerId: entry.userId, // already on the entry row; no getHorseById round-trip
  placementNumber: placement, // the numeric 1-based index, NOT the string
  discipline: show.discipline,
  horseName: entry.horse?.name ?? null,
  showName: show.name,
});
```

Placement-at-the-end preserves the tx's existing lock-acquisition order (SystemAccount → show → user → rider → horse), which all concurrent per-entry txs share — consistent ordering means no deadlock cycles among the `Promise.all` siblings (the shared escrow/show-row locks already serialize the top-3 txs today; this does not change that).

After the tx (outside, fail-soft, alongside the existing notification block): log the award summary; optionally include `progression.statGain` in the existing `competition_placement` notification payload — **do not** add a new notification type (the legacy `competition_stat_gain` type exists; wiring it here is allowed if and only if the existing notification tests pass unchanged; otherwise leave payload as-is and note it).

**Tx-budget check:** adds 3–5 statements per entry (horse XP increment, maybe stat-points bump, horseXpEvent, maybe user XP + level + xpEvent, maybe stat increment) to a tx that currently runs 4–7. Well inside the 5s interactive default observed in this suite; no timeout config change. The executor's per-entry tx stays in `KNOWN_UNWRAPPED` (server-side path, no client to 503) — **no change to `retryableTransactionWrapping.sentinel` pins** (`showController.mjs` stays `wrapped: 2, totalTx: 4`; `competitionAwards.mjs` contains no `$transaction` so it never enters the pin table; `horseXpModelService.mjs`/`userModelService.mjs` keep exactly one `$transaction` each inside the public wrappers and are not in the pin table).

### 4.4 What is explicitly NOT changed

- `enterAndRunShow` / `competitionController.mjs` — untouched (410 Gone; do not re-route, do not refactor its call sites).
- Rider XP (`awardRiderCompetitionXP`) — untouched, stays outside the tx (existing fail-soft contract). Tests must assert it is not double-awarded.
- Scoring formula, prize math, escrow flow, firstWin, notifications' delivery semantics — untouched (scoring is the separate P2-1 decision issue).
- `showScheduler` cadence/locking — untouched (the claim is the mutex; adding a cron advisory lock is a separate concern, not needed for correctness here).

---

## 5. Test design (ATDD — write these failing FIRST at implementation time)

All real-DB (CLAUDE.md §3: no mocks), fixtures via `createTestHorse` + `TestFixture-` naming + scoped cleanup. Location: `backend/modules/competition/__tests__/showExecutionProgression.integration.test.mjs` (module co-location; cross-module XP writers are exercised through the real path). Unit-style table/helper tests may live beside it as `competitionAwards.test.mjs`.

### A. Acceptance — awards happen (the red test proving today's gap)

**Given** a TestFixture user, 4 eligible horses entered in a fixture show whose `closeDate` has passed (build the Show row directly with `prizeEscrow` funded or 0 — both payout branches exist; pick funded to exercise the escrow leg), known base `horseXp`/`xp`/`level` values;
**When** `executeClosedShows({ body: { showIds: [show.id] } }, null)` runs (the existing test-scoping filter — use it; never run unscoped against the shared DB);
**Then** for the placement order actually recorded in `competitionResult` rows: horses gained exactly 30/27/25/20 `horseXp`; matching `HorseXpEvent` rows exist with ordinal reason strings; owners gained exactly 20/15/10/0 `xp` with matching `XpEvent` rows; `User.level` reflects `xpThreshold` for the new xp; rider XP counters unchanged vs. a pre-captured baseline unless a rider fixture was attached (assert **no double-award**: with one rider attached, rider XP is awarded exactly once).
**Red proof:** this fails on current master with all deltas = 0. Paste the failure (oey96.4 AC1).

### B. Exactly-once — concurrent executor invocations

**Given** the same fixture shape;
**When** two `executeClosedShows` calls race on the same showIds (`Promise.all([run(), run()])`);
**Then** exactly one set of `competitionResult` rows exists (unique-constraint count check), each horse's XP delta equals the table value exactly once, each owner's XP delta exactly once, `SUM(HorseXpEvent.amount)` deltas equal the horseXp deltas, and `SUM(XpEvent.amount)` deltas equal the user xp deltas. (The claim makes the loser a no-op; this test pins that XP inherited the mutex.)

### C. Atomicity — no partial award unit

**Given** a fixture where the per-entry tx must fail after result-creation would occur — force it via a pre-inserted conflicting `competitionResult` row for (showId, horseId) so `create` throws P2002 inside the tx;
**Then** that entry has NO new XP, NO XpEvent/HorseXpEvent rows, NO stat change, NO money change (all-or-nothing proof), while other entries of the show processed normally (bounded-blast-radius proof).

### D. Stat-gain determinism — unit tests on the helper (no probability in CI)

Drive `awardPlacementProgression(prismaTestTx, { ..., rng: () => 0 })` → stat gain applied, +1 on a discipline-relevant stat, and with a horse at stat=100 → no change (cap guard, sentinel-positive for the `lt: 100` clause). `rng: () => 0.999` → no gain. 4th place with `rng: () => 0` → still no gain (chance 0 — table teeth). Plus `computePlacementAwards` table test pinning all four rows of §1 (this is the sentinel that fires if anyone edits the constants away from the PRD).

### E. Concurrency sentinel for the jvi3u core (owned by jvi3u, listed for completeness)

10 concurrent `addXpToUser(userId, 5)` → final xp exactly base+50, level exactly `xpThreshold`-derived, 10 XpEvent rows. Must FAIL against current read-modify-write code (red proof for jvi3u).

**Test-trap notes:** never assert on which horse places where (scores are random) — derive expectations from the recorded `competitionResult` placements; use `--runInBand` semantics of a single suite (no cross-suite fixture visibility assumptions); the executor writes numeric-string placements ("1") — assert against those, not ordinals.

---

## 6. Implementation sequencing (matches FABLE_MASTER_SEQUENCE Lane A)

1. `Equoria-jvi3u` — land `addXpToUserCore` + wrapper + concurrency sentinel (red→green). _(wsj2i, geo1a already landed.)_
2. `Equoria-oey96.4` — this design: `competitionAwards.mjs` + `addXpToHorseCore` extraction + executor wiring + tests A–D. Failing-test-first per EDGE_CASE §1; one issue, 1–2 commits.
3. Adjacent issues (§7) — separately, never bundled.

## 7. Adjacent findings (filed separately, not bundled — OPTIMAL_FIX §3)

- **Horse.totalEarnings never updated by the cron executor** (legacy `updateHorseEarnings` is unreached from the live path; Hall-of-Fame/leaderboard queries against `totalEarnings` starve for all post-410 results). Filed as **`Equoria-xal4m`** (dep-wired to land after oey96.4) — same defect family, different invariant (money-stats vs XP), and it belongs INSIDE the same per-entry tx when fixed (`totalEarnings: { increment: prize }` beside the money leg).
- **Conformation-show executor parity** — oey96.4 step 5 already mandates the grep during implementation; file separately if the gap exists there.

## 8. Alternatives considered (OPTIMAL_FIX §5)

- **Fail-soft XP outside the tx (like rider XP):** rejected — oey96.4 explicitly traps it ("partial awards on crash are a player-facing integrity bug"); rider XP's fail-soft is a pre-existing contract, not a precedent.
- **Reuse `awardCompetitionXp`/`updateHorseRewards` as-is:** rejected — nested-tx self-deadlock (§3.1) and un-transacted multi-statement writes.
- **Sequence numbers / idempotency table for exactly-once:** rejected — the `[showId, horseId]` unique constraint + result-first ordering already provides the idempotency token at zero schema cost.
- **Advisory lock around the whole cron tick:** rejected for this issue — the per-show claim is sufficient and already proven (Equoria-dyj3y); a global lock adds a single point of contention without closing any gap the claim leaves open.
