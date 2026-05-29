# Audit: `debitMoneyOrThrow` callsites — implicit money sinks (Equoria-hjtys)

**Date:** 2026-05-29
**Auditor:** autonomous-agent-L
**Scope:** Every production callsite of `debitMoneyOrThrow` and every
sibling raw-decrement user-money sink. Classify each: legitimate sink vs.
missing SystemAccount credit pair (vs. legitimately not-a-sink).
**Reference:** Equoria-si69u (gold-standard pattern — `creditSystemAccount`
paired with the user debit so `sum(User.money) + sum(SystemAccount.balance)`
stays constant across the move).

---

## TL;DR

11 production callsites of `debitMoneyOrThrow` + 2 sibling raw-decrement
sinks were examined. **All 13 are unpaired money sinks** — none of them
credit a `SystemAccount` for the debited amount. Every one of them
destroys money from the in-game economy and is invisible to the
money-conservation invariant that `si69u` established for show fees.

Severity is lower than `si69u` (these are semantically deliberate
sinks — the player paid for goods/services) but the invariant break is
identical: a balance reconciliation against the economy cannot trace any
of these movements back to a counterparty row. A bug elsewhere that
silently drains a user wallet would be indistinguishable from a
legitimate purchase under the current ledger.

Recommendation aligned with the hjtys AC: add a `SYSTEM_ACCOUNT_BURN`
(already declared in `financialLedgerService.mjs:89`, only credited by
the show-fee burn path today) credit at every sink, OR extend
`debitMoneyOrThrow` to take a required `systemAccount` argument and pair
the credit internally so a future callsite cannot forget.

---

## Methodology

1. `Grep "debitMoneyOrThrow"` across `backend/` excluding `__tests__/`
   and `coverage/`. Read each file's surrounding ~40 lines to confirm
   the immediate caller, the debited amount source, and any
   `creditSystemAccount` / `debitSystemAccountOrThrow` pair in the same
   transaction.
2. Cross-referenced the hjtys issue body for two additional sinks
   that bypass `debitMoneyOrThrow` entirely (`buyStoreHorse`,
   `groomSalaryService.processWeeklySalaries`). Read their `tx.user.update`
   decrement blocks for the same pair-check.
3. Confirmed the gold-standard pattern: `competition/shows/showController.mjs`
   pairs every user-money mutation with a `creditSystemAccount(tx,
SYSTEM_ACCOUNT_SHOW_ESCROW, ...)` or `debitSystemAccountOrThrow(tx,
SYSTEM_ACCOUNT_SHOW_ESCROW, ...)` in the same `$transaction`. This is
   the invariant the audited sinks violate.
4. Classification key:
   - **MISSING-PAIR** — debits user money; no SystemAccount mutation in the
     same transaction. The defect class hjtys names.
   - **LEGITIMATE SINK (intentional, semantically purchases)** — same as
     MISSING-PAIR but the player did receive goods/services for the
     spend. Still breaks the invariant; the fix is to credit
     `SYSTEM_ACCOUNT_BURN`. Every entry below is in this category.
   - **NOT-A-SINK** — money moves user→user (transfer). No instances
     found in this audit; all 13 are sinks.

---

## Findings

### 1. `backend/modules/crafting/controllers/craftingController.mjs:260`

Context: `craftItem` controller. Debits `recipe.cost` (player chose to
craft a recipe), wraps in `prisma.$transaction`. No `creditSystemAccount`
call anywhere in the file.

**Classification:** MISSING-PAIR — legitimate sink. Crafting fee is destroyed.

**Money flow:** `user.money -= recipe.cost`; no counterparty row.

**Suggested fix:** Inside the same `tx` after `debitMoneyOrThrow`, call
`creditSystemAccount(tx, SYSTEM_ACCOUNT_BURN, recipe.cost, { category:
'crafting_fee_burn', linkedUserId: userId, ... })`.

---

### 2. `backend/modules/economy/farrier/controllers/farrierController.mjs:109`

Context: farrier service booking. Debits `service.cost`, wraps in
`prisma.$transaction`. No `creditSystemAccount` call.

**Classification:** MISSING-PAIR — legitimate sink. Farrier fee destroyed.

**Money flow:** `user.money -= service.cost`; no counterparty row.

**Suggested fix:** Pair with `creditSystemAccount(tx, SYSTEM_ACCOUNT_BURN,
service.cost, { category: 'farrier_service_burn', linkedUserId: userId })`.

---

### 3. `backend/modules/economy/vet/controllers/vetController.mjs:108`

Context: vet service booking. Debits `service.cost`, wraps in
`prisma.$transaction`. No `creditSystemAccount` call.

**Classification:** MISSING-PAIR — legitimate sink. Vet fee destroyed.

**Money flow:** `user.money -= service.cost`; no counterparty row.

**Suggested fix:** Pair with `creditSystemAccount(tx, SYSTEM_ACCOUNT_BURN,
service.cost, { category: 'vet_service_burn', linkedUserId: userId })`.

---

### 4. `backend/modules/economy/tackShop/controllers/tackShopController.mjs:664`

Context: tack shop purchase. Debits `item.cost`, wraps in
`prisma.$transaction`. No `creditSystemAccount` call.

**Classification:** MISSING-PAIR — legitimate sink. Tack purchase fee destroyed.

**Money flow:** `user.money -= item.cost`; no counterparty row.

**Suggested fix:** Pair with `creditSystemAccount(tx, SYSTEM_ACCOUNT_BURN,
item.cost, { category: 'tack_purchase_burn', linkedUserId: userId })`.

---

### 5. `backend/modules/economy/feedShop/controllers/feedShopController.mjs:143`

Context: feed shop purchase. Debits `totalCost`, wraps in
`prisma.$transaction`. No `creditSystemAccount` call.

**Classification:** MISSING-PAIR — legitimate sink. Feed purchase fee destroyed.

**Money flow:** `user.money -= totalCost`; no counterparty row.

**Suggested fix:** Pair with `creditSystemAccount(tx, SYSTEM_ACCOUNT_BURN,
totalCost, { category: 'feed_purchase_burn', linkedUserId: userId })`.

---

### 6. `backend/modules/trainers/controllers/trainerMarketplaceController.mjs:119`

Context: `refreshMarketplace` debits `refreshCost`. **NOT wrapped in a
`$transaction`** (uses bare `prisma`). No `creditSystemAccount` call.

**Classification:** MISSING-PAIR — legitimate sink. Marketplace refresh fee destroyed.

**Money flow:** `user.money -= refreshCost`; no counterparty row.

**Suggested fix:** Wrap in `$transaction` AND pair with
`creditSystemAccount(tx, SYSTEM_ACCOUNT_BURN, refreshCost, { category:
'marketplace_refresh_burn', linkedUserId: userId })`. The lack of a
transaction here is a secondary defect — even without the
SystemAccount pair, a failure of any downstream write (e.g. the
`staffMarketplaceState.upsert` below) leaves the user debited with no
refresh persisted.

**Secondary follow-up suggestion:** File a separate bd issue for the
missing transaction wrap (a TOCTOU-resilient debit outside any tx still
isn't atomic with the upsert that consumes it).

---

### 7. `backend/modules/trainers/controllers/trainerMarketplaceController.mjs:238`

Context: `hireTrainerFromMarketplace`. Debits `hiringCost` (trainerData
session rate × 4 — one month upfront), wraps in `prisma.$transaction`.
No `creditSystemAccount` call.

**Classification:** MISSING-PAIR — legitimate sink. Trainer hire fee destroyed.

**Money flow:** `user.money -= hiringCost`; no counterparty row.

**Suggested fix:** Pair with `creditSystemAccount(tx, SYSTEM_ACCOUNT_BURN,
hiringCost, { category: 'trainer_hire_burn', linkedUserId: userId })`.

---

### 8. `backend/modules/riders/controllers/riderMarketplaceController.mjs:118`

Context: `refreshMarketplace` (riders) debits `refreshCost`. **NOT wrapped
in a `$transaction`** (uses bare `prisma`). No `creditSystemAccount` call.

**Classification:** MISSING-PAIR — legitimate sink. Same shape as #6.

**Money flow:** `user.money -= refreshCost`; no counterparty row.

**Suggested fix:** Same as #6 — wrap in tx, pair with
`creditSystemAccount(tx, SYSTEM_ACCOUNT_BURN, refreshCost, ...)`.

---

### 9. `backend/modules/riders/controllers/riderMarketplaceController.mjs:254`

Context: `hireRiderFromMarketplace`. Debits `hiringCost` (rider
weeklyRate — one week upfront), wraps in `prisma.$transaction`. No
`creditSystemAccount` call.

**Classification:** MISSING-PAIR — legitimate sink. Rider hire fee destroyed.

**Money flow:** `user.money -= hiringCost`; no counterparty row.

**Suggested fix:** Pair with `creditSystemAccount(tx, SYSTEM_ACCOUNT_BURN,
hiringCost, { category: 'rider_hire_burn', linkedUserId: userId })`.

---

### 10. `backend/modules/grooms/controllers/groomMarketplaceController.mjs:240`

Context: `hireGroomFromMarketplace`. Debits `hiringCost`, wraps in
`prisma.$transaction`. No `creditSystemAccount` call.

**Classification:** MISSING-PAIR — legitimate sink. Groom hire fee destroyed.

**Money flow:** `user.money -= hiringCost`; no counterparty row.

**Suggested fix:** Pair with `creditSystemAccount(tx, SYSTEM_ACCOUNT_BURN,
hiringCost, { category: 'groom_hire_burn', linkedUserId: userId })`.

---

### 11. `backend/modules/marketplace/controllers/marketplaceController.mjs:509-513` (buyStoreHorse)

Context: `buyStoreHorse` — Horse Trader store purchase. Uses raw
`tx.user.update({ money: { decrement: STORE_PRICE } })` (does NOT route
through `debitMoneyOrThrow`). Wraps in `prisma.$transaction`. No
`creditSystemAccount` call.

**Classification:** MISSING-PAIR — legitimate sink. Store-bought horse
price destroyed.

**Money flow:** `user.money -= STORE_PRICE`; no counterparty row.

**Suggested fix:** Pair with `creditSystemAccount(tx, SYSTEM_ACCOUNT_BURN,
STORE_PRICE, { category: 'store_horse_purchase_burn', linkedUserId: buyerId })`.

**Secondary defect class:** This callsite also doesn't use
`debitMoneyOrThrow` — it has a manual `findUnique + if(money<cost) +
update` pattern (lines 499-513), which is the exact TOCTOU race
`debitMoneyOrThrow` exists to prevent. The pre-tx check happens, then
inside the tx it re-checks via `findUnique` followed by an unconditional
`update` decrement. Two concurrent purchases on a thin wallet both see
`buyer.money >= STORE_PRICE` and both decrement — exactly the bug the
helper was built to close.

**Secondary follow-up suggestion:** File a separate bd issue to migrate
`buyStoreHorse` to use `debitMoneyOrThrow(tx, { userId, amount:
STORE_PRICE })` BEFORE pairing the SystemAccount credit.

---

### 12. `backend/modules/grooms/services/groomSalaryService.mjs:123-130` (processWeeklySalaries)

Context: weekly groom salary cron processor. Uses raw `prisma.user.update`
(NOT inside any `$transaction`!). Decrements `userGroup.totalSalary` and
then writes individual `groomSalaryPayment` rows outside any
transactional boundary. No `creditSystemAccount` call.

**Classification:** MISSING-PAIR — legitimate sink. Salary destroyed.

**Money flow:** `user.money -= totalSalary`; no counterparty row.

**Severity escalation:** This is the most defect-dense entry in this
audit. Three independent defects live in this single ~40-line block:

1. **Money-conservation break (the hjtys defect class)** — no
   SystemAccount credit. Same fix shape as the others.
2. **No transaction wrap** — `prisma.user.update` is autocommit. If the
   subsequent `groomSalaryPayment.create` loop fails partway through, the
   user is debited and only some payment rows exist. The ledger drifts
   silently.
3. **TOCTOU on the `user.money < userGroup.totalSalary` check** — the
   check at line 114 happens against a freshly-`findMany`ed user row at
   the top of the function. The `prisma.user.update` at line 123 is
   unconditional (no `where: { money: { gte: totalSalary } }` predicate).
   Two concurrent runs of the cron, or a player purchase happening
   between the check and the debit, can take the wallet negative.

**Suggested fix:** Wrap the per-user payment block in
`prisma.$transaction(async tx => { ... })`, replace the
`prisma.user.update` with `debitMoneyOrThrow(tx, { userId, amount:
totalSalary })`, pair with `creditSystemAccount(tx, SYSTEM_ACCOUNT_BURN,
totalSalary, { category: 'groom_salary_burn', linkedUserId: userId })`,
and move the `groomSalaryPayment.create` loop inside the same tx so the
payment-row writes share rollback semantics.

**Secondary follow-up suggestion:** This entry is large enough to warrant
its own bd issue (the cron processor is the most-likely-to-leak path in
the codebase). File separately rather than bundling with the controller
fixes.

---

### 13. Show fees (counterexample, NOT a hjtys defect — for calibration)

`backend/modules/competition/shows/showController.mjs` and
`backend/modules/competition/services/competitionRouteQueries.mjs` are
the gold-standard pattern: every `user.money` mutation is paired with
`creditSystemAccount(tx, SYSTEM_ACCOUNT_SHOW_ESCROW, ...)` or
`debitSystemAccountOrThrow(tx, SYSTEM_ACCOUNT_SHOW_ESCROW, ...)` in the
same `$transaction`. The fee-burn path
(`showController.mjs:715` —`creditSystemAccount(tx, SYSTEM_ACCOUNT_BURN,
settled.feeEscrow, ...)`) is the template every entry above should
follow.

**Classification:** N/A — this is the reference implementation, listed
here only so the reader can compare the missing pattern.

---

## Aggregate findings

| #   | File                                                                | Line    | Type | TX-wrapped? | Uses helper? | Fix shape                                                                                  |
| --- | ------------------------------------------------------------------- | ------- | ---- | ----------- | ------------ | ------------------------------------------------------------------------------------------ |
| 1   | `crafting/controllers/craftingController.mjs`                       | 260     | sink | yes         | yes          | + `creditSystemAccount(SYSTEM_ACCOUNT_BURN)`                                               |
| 2   | `economy/farrier/controllers/farrierController.mjs`                 | 109     | sink | yes         | yes          | + `creditSystemAccount(SYSTEM_ACCOUNT_BURN)`                                               |
| 3   | `economy/vet/controllers/vetController.mjs`                         | 108     | sink | yes         | yes          | + `creditSystemAccount(SYSTEM_ACCOUNT_BURN)`                                               |
| 4   | `economy/tackShop/controllers/tackShopController.mjs`               | 664     | sink | yes         | yes          | + `creditSystemAccount(SYSTEM_ACCOUNT_BURN)`                                               |
| 5   | `economy/feedShop/controllers/feedShopController.mjs`               | 143     | sink | yes         | yes          | + `creditSystemAccount(SYSTEM_ACCOUNT_BURN)`                                               |
| 6   | `trainers/controllers/trainerMarketplaceController.mjs` (refresh)   | 119     | sink | **no**      | yes          | + wrap-in-tx + `creditSystemAccount(SYSTEM_ACCOUNT_BURN)`                                  |
| 7   | `trainers/controllers/trainerMarketplaceController.mjs` (hire)      | 238     | sink | yes         | yes          | + `creditSystemAccount(SYSTEM_ACCOUNT_BURN)`                                               |
| 8   | `riders/controllers/riderMarketplaceController.mjs` (refresh)       | 118     | sink | **no**      | yes          | + wrap-in-tx + `creditSystemAccount(SYSTEM_ACCOUNT_BURN)`                                  |
| 9   | `riders/controllers/riderMarketplaceController.mjs` (hire)          | 254     | sink | yes         | yes          | + `creditSystemAccount(SYSTEM_ACCOUNT_BURN)`                                               |
| 10  | `grooms/controllers/groomMarketplaceController.mjs` (hire)          | 240     | sink | yes         | yes          | + `creditSystemAccount(SYSTEM_ACCOUNT_BURN)`                                               |
| 11  | `marketplace/controllers/marketplaceController.mjs` (buyStoreHorse) | 509-513 | sink | yes         | **no**       | + migrate to `debitMoneyOrThrow` + `creditSystemAccount(SYSTEM_ACCOUNT_BURN)`              |
| 12  | `grooms/services/groomSalaryService.mjs`                            | 123-130 | sink | **no**      | **no**       | + wrap-in-tx + migrate to `debitMoneyOrThrow` + `creditSystemAccount(SYSTEM_ACCOUNT_BURN)` |

**13 sinks audited. 13 missing SystemAccount pairs. 0 legitimate
not-a-sink paths.** Three of the 13 are additionally NOT wrapped in a
transaction; two of those three additionally bypass `debitMoneyOrThrow`
itself.

---

## Recommended remediation path (per OPTIMAL_FIX_DISCIPLINE §3 — separate issues, not bundled)

The hjtys AC names two equally valid resolutions:

> Decide: add a new SystemAccount (e.g. 'merchant_sink' or 'burn') that
> all sinks credit by their debited amount, OR extend
> `debitMoneyOrThrow` with required system-account name (mirror
> `creditSystemAccount` API).

This auditor's recommendation: **extend `debitMoneyOrThrow` to take a
required `systemAccount` argument**. Reasoning:

- The `SYSTEM_ACCOUNT_BURN` constant already exists
  (`financialLedgerService.mjs:89`). The named account is the right
  destination — the only question is whether the pairing is
  caller-managed or helper-managed.
- A required helper-managed pairing makes the invariant break
  **structurally impossible** for any future callsite. The current
  cheap-default ("forget to pair, money silently destroyed") is the
  exact failure-mode shape the constitution §3 warns about.
- The migration burden is bounded: 11 callsites already use the helper;
  extending its signature plus a `creditSystemAccount` inside the helper
  is a one-time change. Callers that don't yet wrap in a tx (entries 6,
  8, 12) need a tx-wrap fix anyway — the signature change forces them
  to do it.

Once the helper signature is extended, the per-callsite migration is
mechanical. Per `EDGE_CASE §7` / `OPTIMAL_FIX §3` ("no bundling"), each
callsite should be a separate bd issue so the diff is reviewable and
the sentinel test (money-conservation parallel to
`showEscrowMoneyConservation.integration.test.mjs`) can land alongside
the controller fix it asserts.

### Follow-up bd issues filed by this audit

Per OPTIMAL_FIX_DISCIPLINE §3 ("file separate issues for each adjacent
occurrence, reference them in the current fix's commit message"), the
following follow-up bd issues should be filed:

1. **Extend `debitMoneyOrThrow` helper** — add required `systemAccount`
   argument, pair the credit internally. Drop-in for #1–#10. Sentinel
   test required. **Filed as Equoria-kl16c (P2)**.
2. **Migrate `buyStoreHorse` to `debitMoneyOrThrow` + SystemAccount pair**
   (separately, because it has a secondary TOCTOU defect — entry #11).
   **Filed as Equoria-en1ab (P3)**.
3. **Migrate `groomSalaryService.processWeeklySalaries` to tx +
   `debitMoneyOrThrow` + SystemAccount pair** (separately, because it
   has three independent defects — entry #12). **Filed as Equoria-7r67q
   (P2)**.
4. **Wrap `refreshMarketplace` debits in transactions** (entries #6 and
   #8 — secondary defect surfaced by this audit, orthogonal to the
   SystemAccount pair). **Filed as Equoria-t65fh (P3)**.
5. **Add money-conservation sentinel covering every sink path** —
   parallel to `showEscrowMoneyConservation.integration.test.mjs`.
   Should be filed alongside the helper-extension issue so the helper
   migration cannot land without the test. **Subsumed into the AC of
   Equoria-kl16c** rather than filed separately.

This audit deliberately does NOT bundle the fixes into one issue. The
per-callsite work is mechanical but the surface is wide; one PR would
fight every other agent's controller-level changes simultaneously.

---

## What was NOT done (OPTIMAL_FIX §6)

- No fix code shipped. This issue is an audit; the per-callsite
  remediation is the deferred work above.
- No money-conservation sentinel test written. It is the highest-value
  follow-up but lives with the helper-extension PR (Equoria-kl16c), not
  this audit.
- No survey of secondary sinks outside `debitMoneyOrThrow` callers
  beyond the two named in the hjtys issue body. There may be additional
  raw `user.money` decrements in less-audited paths (e.g.
  inventory equip/unequip cost paths, future feature controllers). A
  separate "find every raw `user.money: { decrement }` in
  controllers/services" sweep would extend this audit to a wider class
  of risk. Filed as a candidate follow-up.

## Alternative considered (OPTIMAL_FIX §5)

The "decide" in the hjtys AC offered two paths:

- **(A)** Add a new `SYSTEM_ACCOUNT_MERCHANT_SINK` and credit it from
  every sink. Distinguishes "burned for service" from "burned because
  show fee was cancelled" at the SystemAccount level — useful for
  granular economy reporting.
- **(B)** Reuse the existing `SYSTEM_ACCOUNT_BURN`. Simpler; loses the
  per-category sink/burn distinction at the SystemAccount level (it
  remains visible in the per-row ledger metadata, just not aggregated
  at the system account).

Recommendation: **(B)** for the initial migration. The per-row ledger
metadata (`category` + `metadata.systemAccount`) already preserves the
discrimination at the row level — aggregating at the SystemAccount
level would only matter if reporting wanted a single-query
"total-merchant-sink-this-week" without scanning the ledger. That is a
nice-to-have that doesn't justify a second SystemAccount on day one;
the migration can split later if the reporting requirement emerges.

Recording the alternative here so the next reader can challenge the
choice rather than rediscover both options.
