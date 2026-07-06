# Stud Service Economy — Implementation Spec

**Date:** 2026-07-06
**Status:** DESIGN — no implementation in this document's landing commit
**Epic:** `Equoria-e7tgc`; children `Equoria-e7tgc.1`–`.11` map 1:1 to S1–S11 in §10 (fleet-sized, one session each). Follow-ups: `Equoria-3sfys` (createFoal unification), `Equoria-t8v8t` (buyHorse → transferUserMoneyOrThrow)
**Migration gate:** the schema migration (child S1) is ADDITIVE but requires explicit user
approval before `prisma migrate dev` / `deploy` runs (Constitution §6; c3kb6 discipline).
**Scope:** cross-owner breeding via public stud (breed now, pay now) and private stud
(request → owner accepts/rejects, money moves only on accept).

---

## 0. What already exists (read before building)

| Piece                     | Where                                                                                                                        | State                                                                                                                                                                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stud listing set/unset    | `backend/modules/horses/controllers/horseStudController.mjs` + `routes/horseBreedingRoutes.mjs` (Equoria-q072)               | `POST/DELETE /api/v1/horses/:id/stud-listing` writes `Horse.studStatus` ('At Public Stud'/'Not at Stud') + `Horse.studFee`. **Nothing consumes the listing.** No private mode, no browse endpoint.                                          |
| Own-both-parents breeding | `POST /horses/foals` → `horseFoalingController.mjs#createFoal`                                                               | Full guard stack (self-cross, sex, min-age 3, dam cooldown, critical health, breed validation) + the Equoria-9gsxg atomic pregnancy claim. Dual ownership via `findOwnedResource` (CWE-639 404-shape).                                      |
| Dam cooldown decision     | `horseFoalingController.mjs:15-26` (user decision 2026-07-02)                                                                | `DAM_BREEDING_COOLDOWN_DAYS = 7` real days = 1 game year, **dam only**, anchored on `lastBredDate` (conception stamp), date-only UTC semantics via `backend/utils/horseAge.mjs` (Equoria-vdw5).                                             |
| Pregnancy record          | `Horse.inFoalSinceDate` / `pregnancySireId` / `pregnancyFeedingsByTier` / `pendingFoalName` / `pendingFoalBreedId` (Phase B) | The dam's in-foal columns ARE the breeding/pregnancy record. Foal materialises +7d via `foalingJob` → `foalingService.createFoalFromPregnancy()`. Unchanged by this feature.                                                                |
| Money movement            | `backend/modules/economy/services/financialLedgerService.mjs`                                                                | `debitMoneyOrThrow` (user→system, Equoria-hjzwt/kl16c), `recordTransactionTx` (tx-first ledger, Equoria-pqp69). User→user precedent: `marketplaceController.mjs#buyHorse` (Equoria-alei5/zz1ii/9hja2).                                      |
| Retryable tx wrapper      | `backend/utils/retryableTransaction.mjs#withRetryableTxMapping`                                                              | Wraps `$transaction` promises; maps serialization/deadlock retries to a friendly 503-style message.                                                                                                                                         |
| Notifications             | `backend/utils/notificationService.mjs#createNotification(userId, type, payload)`                                            | Free-form type strings; called AFTER tx commit (see buyHorse).                                                                                                                                                                              |
| Audit trail               | `backend/middleware/auditLog.mjs:472` `SENSITIVE_AUDIT_PREFIXES`                                                             | `breeding`/`breed` path prefixes are auto-audited for mutating verbs. **New endpoints mount under `/api/v1/breeding/…` so no allowlist change is needed.**                                                                                  |
| Crossbreed rules          | —                                                                                                                            | **Do not exist anywhere in the codebase** (grep for crossbreed/breedCompat/isCrossbreedAllowed: zero production hits; `modules/breeding/services/genetics/*` is genetic-quality scoring, not breed-pairing rules). See §1 product decision. |

## Named canonical patterns reused (2026-07-02 economy audit)

1. **`debitMoneyOrThrow`-in-tx conditional debit** — the `updateMany({ where: { id, money: { gte: amount } } })` + `count===0 → InsufficientFundsError` shape, run inside the parent `$transaction`. The stud fee is user→user, so the shape is reused via a new `transferUserMoneyOrThrow` helper (§6.1) rather than `debitMoneyOrThrow` itself (which structurally requires a SystemAccount counterparty per Equoria-kl16c).
2. **Conditional `updateMany` atomic claim for status transitions** — the Equoria-alei5 marketplace shape (`WHERE forSale=true AND userId != buyer`, `count!==1 → 409 before any money moves`). Reused for: the request `pending → accepted/rejected/cancelled` transitions, and the stallion listing-active guard.
3. **Atomic-claim for the "one active" invariant** — the Equoria-9gsxg pregnancy claim (`WHERE inFoalSinceDate: null`, `count===0 → reject`). Reused verbatim for the mare pregnancy claim, and extended to the DB level with a **partial unique index** for the one-pending-request-per-mare invariant (§3).

---

## 1. Product decisions

### 1.1 REQUIRED FROM USER — crossbreed compatibility ruleset

No breed-pairing compatibility data or logic exists in the codebase. Per the design brief, we
do NOT invent one. The eligibility validator calls a pluggable hook:

```js
// backend/modules/breeding/services/breedCompatibility.mjs
export function isCrossbreedAllowed(breedA, breedB) { … }
```

- **Same breed** (`breedA.id === breedB.id`, both non-null) → always allowed.
- **Different breeds** → consult the ruleset. **Until the user supplies one, the hook
  fails closed: crossbreeds are rejected** with 400 `CROSSBREED_NOT_ALLOWED` ("These breeds
  cannot be crossed"). This is not a game rule we invented — it is the absence of a rule,
  surfaced honestly.
- **Either horse has `breedId: null`** (schema allows it) → fail closed with 400
  `BREED_UNKNOWN`. A breedless horse cannot pass a breed-compatibility check we can't evaluate.
- When the user provides the ruleset (e.g. a JSONB/config allow-list of breed-id pairs, or a
  registry-based rule), only this module changes; both breeding paths pick it up automatically
  because they share the validator (§5).

**User must decide:** the crossbreed allow-list (or "same breed only, permanently"), and the
policy for `breedId: null` horses.

> **DECISION 2026-07-06 (beta scope):** ship **fail-closed, same-breed only** exactly as the
> hook's default behavior above; `breedId: null` → rejected (`BREED_UNKNOWN`). The permanent
> crossbreed allow-list (and the D7 stallion max-age question) remain OPEN product decisions,
> tracked as a bd decision issue (see §11) so they resurface — the beta decision does not
> close them.

### 1.2 Decisions made in this spec (flag if you disagree)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                   | Rationale / alternative considered                                                                                                                                                                                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Listing stays on `Horse` columns** (`studStatus` gains a third value `'At Private Stud'`; `studFee` unchanged). No new `StudListing` table.                                                                                                                                                                                                              | The listing is 1:1 with the stallion; the q072 endpoints already write these columns; a second table would be a dual source of truth (drift risk) and the fee snapshot inside the breeding tx reads the same row we lock anyway. _Alternative:_ a `StudListing` table with history — rejected; listing history is derivable from the ledger rows' metadata. |
| D2  | **Private accept charges the submit-time fee snapshot**, stored on the request row.                                                                                                                                                                                                                                                                        | The requester consented to that exact price. Owner raising the fee after submission must not raise the charge (bait-and-switch); owner accepting IS consent to the snapshot. _Alternative:_ charge current listing fee at accept — rejected: charges the requester an amount they never agreed to.                                                          |
| D3  | **Unlisting (or leaving private mode) auto-rejects all pending requests** on that stallion, in the same tx, no money moves, `resolutionReason: 'listing_removed'`, requester notified.                                                                                                                                                                     | The invariant "pending requests exist only against an actively-private-listed stallion" keeps accept-time validation simple and frees mares from purgatory. _Alternative:_ leave them pending and fail accept — rejected: strands mares behind a dead listing.                                                                                              |
| D4  | **Accept-time re-validation failures split permanent vs transient.** Permanent (mare pregnant / sold / aged out / crossbreed no longer allowed / stallion sold) → the request auto-transitions `pending → rejected` with the failure code; transient (`INSUFFICIENT_FUNDS`) → the request STAYS pending and the accepter gets 409 "requester lacks funds". | Auto-rejecting on a momentary empty wallet is hostile; leaving a permanently-dead request pending strands the mare.                                                                                                                                                                                                                                         |
| D5  | **A requester cannot use this economy against their own stallion** (400 `OWN_STALLION`).                                                                                                                                                                                                                                                                   | Paying yourself creates ledger noise and a conservation-test blind spot; the free own-both-parents path (`POST /horses/foals`) already exists for that.                                                                                                                                                                                                     |
| D6  | **Zero-fee listings are legal** (existing validation allows `studFee: 0`). Fee 0 → no debit, no credit, no ledger rows; breeding proceeds.                                                                                                                                                                                                                 | The ledger helpers reject `amount <= 0` by design; skipping money ops at fee 0 is explicit, tested behavior — not an error path.                                                                                                                                                                                                                            |
| D7  | **Mare breeding age window is 3–20 game years inclusive** (`3 <= getHorseAgeYears(dob) <= 20`). Stallion keeps the existing min-3 rule with **no max** (brief specifies the window for the mare only).                                                                                                                                                     | Flag to user: if stallions should also cap at 20, it is a one-line change in the shared validator + tests.                                                                                                                                                                                                                                                  |
| D8  | **Critical-health gate (Equoria-2e7e) applies to both parents**, same as own-horse breeding.                                                                                                                                                                                                                                                               | Not in the brief's criteria list, but it is an existing breeding invariant; cross-owner breeding must not be a bypass around it.                                                                                                                                                                                                                            |
| D9  | **Horse FKs on `BreedingRequest` use `onDelete: Cascade`;** `requesterId` FK cascades too; `stallionOwnerId` is a soft snapshot (no FK).                                                                                                                                                                                                                   | Pending requests are meaningless without their horses and hold no money; the ledger keeps the durable financial history. Restrict would force `deleteHorseService`/GDPR to learn about requests.                                                                                                                                                            |
| D10 | **Fee changes take effect immediately for public stud** (a racing breed pays the fee committed at its in-tx read; the listing-active guard (§6.2) locks the stallion row for the tx duration, so an unlist cannot interleave).                                                                                                                             | Same semantics as marketplace price edits racing `buyHorse`.                                                                                                                                                                                                                                                                                                |

---

## 2. Feature overview

**Public stud:** stallion owner lists at public stud with a fee → any player breeds their mare
to it immediately; one transaction charges the fee, credits the owner, starts the pregnancy,
stamps the dam cooldown.

**Private stud:** stallion owner lists at private stud with a fee → mare owners submit a
request (validated, no money moves) → stallion owner accepts (atomically re-validates
everything and executes the same charge+breed transaction) or rejects; requester may cancel.
A mare has at most ONE pending request at any time (DB-enforced).

Request state machine (terminal states are immutable):

```
            ┌──────────► accepted   (money moves here, exactly once)
pending ────┼──────────► rejected   (owner action, accept-revalidation permanent failure,
            │                        or listing removed — never charges)
            └──────────► cancelled  (requester action — never charges)
```

---

## 3. Data model (child S1 — user-gated migration)

### 3.1 `Horse` — no new columns

`studStatus` (existing `String?`) gains a third canonical value. New constants module:

```js
// backend/modules/breeding/constants/studStatus.mjs
export const STUD_STATUS_NONE = 'Not at Stud'; // existing default
export const STUD_STATUS_PUBLIC = 'At Public Stud'; // existing (q072)
export const STUD_STATUS_PRIVATE = 'At Private Stud'; // NEW
export const STUD_LISTED_STATUSES = [STUD_STATUS_PUBLIC, STUD_STATUS_PRIVATE];
```

No migration needed for this (String column). All code references go through the constants —
no new magic strings (the two existing literals in `horseStudController.mjs` migrate to the
constants in child S2).

### 3.2 `BreedingRequest` (new table)

```prisma
model BreedingRequest {
  id                 Int       @id @default(autoincrement())
  stallionId         Int
  mareId             Int
  /// Mare owner at submit time; the payer. FK → User (Cascade).
  requesterId        String
  /// Stallion owner at submit time. SOFT SNAPSHOT for display/history only —
  /// authorization and payee are always re-derived from stallion.userId
  /// inside the accept tx (the stallion may have been sold). No FK.
  stallionOwnerId    String
  /// Fee snapshot the requester consented to at submit (D2). Charged verbatim on accept.
  studFee            Int
  /// pending | accepted | rejected | cancelled  (CHECK-constrained; see migration SQL)
  status             String    @default("pending")
  /// Machine-readable close reason: 'accepted', 'rejected_by_owner', 'listing_removed',
  /// 'cancelled_by_requester', 'ineligible:<VALIDATOR_CODE>' (accept-revalidation failure)
  resolutionReason   String?
  /// Requester's foal intent, stamped onto the mare's pending* columns on accept.
  pendingFoalName    String?
  pendingFoalBreedId Int?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  resolvedAt         DateTime?

  stallion  Horse @relation("StudRequestStallion", fields: [stallionId], references: [id], onDelete: Cascade)
  mare      Horse @relation("StudRequestMare", fields: [mareId], references: [id], onDelete: Cascade)
  requester User  @relation("StudRequests", fields: [requesterId], references: [id], onDelete: Cascade)

  @@index([stallionId, status])   // incoming inbox: requests on my stallions
  @@index([requesterId, status])  // outgoing: my requests
  @@index([mareId, status])
  @@map("breeding_requests")
}
```

### 3.3 Migration SQL beyond what Prisma generates

Prisma cannot express partial indexes or CHECK constraints in the schema; append to the
generated `migration.sql`:

```sql
-- THE one-active-request-per-mare invariant, enforced by the database itself.
-- Two concurrent submits for the same mare: exactly one insert wins; the loser
-- gets a unique-violation (Prisma P2002) mapped to HTTP 409.
CREATE UNIQUE INDEX "breeding_requests_one_pending_per_mare"
  ON "breeding_requests" ("mareId")
  WHERE status = 'pending';

-- Defense-in-depth: illegal states are unrepresentable.
ALTER TABLE "breeding_requests"
  ADD CONSTRAINT "breeding_requests_status_check"
  CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled'));
ALTER TABLE "breeding_requests"
  ADD CONSTRAINT "breeding_requests_stud_fee_nonneg_check"
  CHECK ("studFee" >= 0);
```

This is the codebase's first partial unique index (verified: no
`CREATE UNIQUE INDEX … WHERE` in any existing migration). The fresh-DB replay sentinel
(`backend/__tests__/scripts/freshDbMigrationReplay.sentinel.test.mjs`) exercises it
automatically; S1 must confirm the replay passes.

**Gate:** additive-only; the user approves before any `prisma migrate` command runs, and it
is applied to dev/local only in this epic — prod deploy rides the normal release path
(currently blocked by P0-1, which is unrelated to this feature).

---

## 4. API surface

All new routes mount under **`/api/v1/breeding`** so the existing
`SENSITIVE_AUDIT_PREFIXES` `breeding` matcher (auditLog.mjs:472) audits every mutation with
zero middleware change. All routes: `authenticateToken`, `mutationRateLimiter` /
`queryRateLimiter`, `rejectPollutedRequest`, express-validator + `handleValidationErrors`,
per the `horseBreedingRoutes.mjs` house style. Ownership failures use the CWE-639
404-shape convention (identical body for not-found vs not-owned) where the resource id is
caller-supplied; 403 where the resource is a request row the caller can legitimately see.

### Listing management (extends existing q072 endpoints, in place)

| Method + path                            | Auth                                | Behavior                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/horses/:id/stud-listing`   | owner (`requireOwnership('horse')`) | Body `{ studFee: int >= 0, mode: 'public' \| 'private' }`. Sets `studStatus` to the mode's constant + `studFee`. Sex guard (Stallion) + min-age-3 guard at listing time. Editing an existing listing = same endpoint (idempotent upsert of the two columns). **Leaving private mode (unlist, or switch to public) cascade-rejects pending requests (D3) in the same tx.** |
| `DELETE /api/v1/horses/:id/stud-listing` | owner                               | Resets to `Not at Stud` / fee 0 + the same cascade-reject (D3).                                                                                                                                                                                                                                                                                                           |

### Browse

| Method + path                        | Auth              | Behavior                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/v1/breeding/stud-listings` | any authenticated | Paginated stallions with `studStatus IN (public, private)`. Filters: `mode`, `breedId`, `minFee`/`maxFee`. Returns public display data only (id, name, breed, age-years, fee, mode, phenotype/color, key stats, owner username) — no owner-private fields. Needs composite index `@@index([studStatus, studFee])` on `Horse` (part of S1's migration). |

### Public stud

| Method + path                                  | Auth       | Behavior                                                                                                                                     |
| ---------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/breeding/stud/:stallionId/breed` | mare owner | Body `{ mareId: int, foalName?: string, foalBreedId?: int }`. Full tx of §6.2. 200 → pregnancy started + fee moved; 4xx/409 → nothing moved. |

### Private stud requests

| Method + path                                           | Auth                       | Behavior                                                                                                                                                                   |
| ------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/breeding/stud/:stallionId/requests`       | mare owner                 | Body `{ mareId, foalName?, foalBreedId? }`. Validates eligibility (advisory), inserts request. P2002 on the partial index → 409 `MARE_HAS_ACTIVE_REQUEST`. No money moves. |
| `POST /api/v1/breeding/stud-requests/:requestId/accept` | **current** stallion owner | Tx of §6.3. Money moves here, exactly once.                                                                                                                                |
| `POST /api/v1/breeding/stud-requests/:requestId/reject` | current stallion owner     | Atomic `pending → rejected`, `resolutionReason: 'rejected_by_owner'`. No money.                                                                                            |
| `POST /api/v1/breeding/stud-requests/:requestId/cancel` | requester                  | Atomic `pending → cancelled`, `resolutionReason: 'cancelled_by_requester'`. Frees the mare (partial index only counts `pending`). No money.                                |
| `GET /api/v1/breeding/stud-requests/outgoing`           | requester                  | My requests (all states, paginated, newest first).                                                                                                                         |
| `GET /api/v1/breeding/stud-requests/incoming`           | stallion owner             | Requests on stallions I **currently** own (join `stallion.userId = me`, not the snapshot column).                                                                          |

Route-ordering note (CONTRIBUTING §2): `stud-listings`, `stud/:stallionId/*` and
`stud-requests/*` are distinct literal prefixes on a NEW sub-router — register literal
segments before any future `/:id` catch-all on the same router.

---

## 5. Shared eligibility validator (child S4)

One module used by BOTH paths so the rules cannot drift (brief deliverable 3):

```js
// backend/modules/breeding/services/studEligibilityService.mjs
/**
 * Pure decision function over already-loaded rows. Does NOT query.
 * Callers load stallion/mare (+ requester money) with the client of their choice
 * (bare prisma for advisory submit-time checks; tx for authoritative in-tx checks).
 * Returns { ok: true } or { ok: false, code, httpStatus, message, permanent }.
 */
export function evaluateStudBreedingEligibility({
  stallion, mare, requesterId, requesterMoney, feeAmount, requiredStudStatus, now = new Date(),
})
```

Checks, in order (every failure names a stable `code`; `permanent` drives D4):

| Code                                            | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                       | HTTP | Permanent            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | -------------------- |
| `SELF_CROSS`                                    | `stallion.id !== mare.id` (CONTRIBUTING §4 — before any other work)                                                                                                                                                                                                                                                                                                                                                                        | 400  | yes                  |
| `SIRE_NOT_STALLION` / `DAM_NOT_MARE`            | sex guards                                                                                                                                                                                                                                                                                                                                                                                                                                 | 400  | yes                  |
| `OWN_STALLION`                                  | `stallion.userId !== requesterId` (D5)                                                                                                                                                                                                                                                                                                                                                                                                     | 400  | yes                  |
| `MARE_NOT_OWNED`                                | `mare.userId === requesterId` (callers map to 404-shape)                                                                                                                                                                                                                                                                                                                                                                                   | 404  | yes                  |
| `NOT_AT_STUD`                                   | `stallion.studStatus === requiredStudStatus` (public path requires public; submit+accept require private)                                                                                                                                                                                                                                                                                                                                  | 409  | yes                  |
| `BREED_UNKNOWN` / `CROSSBREED_NOT_ALLOWED`      | `isCrossbreedAllowed(stallionBreed, mareBreed)` (§1.1, fail-closed)                                                                                                                                                                                                                                                                                                                                                                        | 400  | yes                  |
| `FOAL_BREED_INVALID`                            | _(added 2026-07-06 review)_ if `foalBreedId` is supplied: the Breed row must EXIST (mirror `createFoal`'s guard, `horseFoalingController.mjs:158-179`) AND — under the same-breed-only decision — must equal the parents' shared breed. Never stamp a client-supplied id raw into `pendingFoalBreedId`: `foalingService` resolves it into the FK'd `Horse.breedId` at +7d, so a dangling id = paid pregnancy that crashes the foaling cron | 400  | yes                  |
| `MARE_UNDERAGE` / `MARE_OVERAGE`                | `3 <= getHorseAgeYears(mare.dateOfBirth, now) <= 20` (D7)                                                                                                                                                                                                                                                                                                                                                                                  | 400  | yes\*                |
| `SIRE_UNDERAGE`                                 | `getHorseAgeYears(stallion.dateOfBirth, now) >= 3`                                                                                                                                                                                                                                                                                                                                                                                         | 400  | yes\*                |
| `SIRE_CRITICAL_HEALTH` / `MARE_CRITICAL_HEALTH` | `getDisplayedHealth(h) !== 'critical'` (D8, Equoria-2e7e parity)                                                                                                                                                                                                                                                                                                                                                                           | 400  | no (health recovers) |
| `MARE_PREGNANT`                                 | `mare.inFoalSinceDate === null` (advisory; authoritative = claim WHERE §6.2)                                                                                                                                                                                                                                                                                                                                                               | 409  | yes                  |
| `MARE_ON_COOLDOWN`                              | `!mare.lastBredDate \|\| getHorseAgeDays(mare.lastBredDate, now) >= 7` — reuses `DAM_BREEDING_COOLDOWN_DAYS` (2026-07-02 decision), date-only UTC, null-checked FIRST (the `getHorseAgeDays(null) → 0` trap documented in `createFoal`)                                                                                                                                                                                                    | 409  | no (time passes)     |
| `INSUFFICIENT_FUNDS`                            | `requesterMoney >= feeAmount` (advisory; authoritative = conditional debit §6.1)                                                                                                                                                                                                                                                                                                                                                           | 400  | **no**               |

\* `MARE_UNDERAGE`/`SIRE_UNDERAGE` are permanent _for the pending request's practical
lifetime_ only in the OVERAGE direction; underage ages IN. For D4 classification:
`MARE_OVERAGE` → permanent; `MARE_UNDERAGE`/`SIRE_UNDERAGE` → transient (stays pending).
(An underage submit is rejected at submit time anyway; this only matters for edge fixtures.)

The `DAM_BREEDING_COOLDOWN_DAYS` and `MIN_BREEDING_AGE_YEARS` constants move from
`horseFoalingController.mjs` into a shared `backend/modules/breeding/constants/breedingRules.mjs`,
re-exported/imported by BOTH `createFoal` and this validator so the numbers cannot fork.
(`createFoal`'s own guard logic is otherwise untouched in this epic — refactoring it onto the
full shared validator is filed as a follow-up, not bundled: OPTIMAL_FIX_DISCIPLINE §3/§7.
Note `createFoal` deliberately has no breed-compat or max-age check today; unifying changes
its behavior and needs its own AC.)

Adding a new max-age constant: `MAX_MARE_BREEDING_AGE_YEARS = 20`.

---

## 6. Transaction & concurrency design

All money-moving flows: ONE `prisma.$transaction(async tx => …)` wrapped in
`withRetryableTxMapping`, 30s timeout (buyHorse precedent), notifications strictly
post-commit. **Lock acquisition order is identical in every flow** to avoid deadlocks:
**(1) request row → (2) stallion row → (3) mare row → (4) requester user row → (5) owner
user row.** Postgres would detect-and-abort a deadlock anyway (retried by the wrapper), but
consistent ordering keeps retries rare.

### 6.1 New ledger helper: `transferUserMoneyOrThrow` (child S3)

The stud fee is user→user. `debitMoneyOrThrow` cannot be used directly (it structurally
requires a SystemAccount counterparty — Equoria-kl16c). The buyHorse inline shape is correct
but copy-paste-per-callsite is how conservation bugs breed. New helper in
`financialLedgerService.mjs`, same doc-comment style:

```js
/**
 * Atomic user→user transfer. Reuses the debitMoneyOrThrow conditional-claim shape
 * (updateMany WHERE money >= amount; count===0 → InsufficientFundsError) and pairs
 * the payee credit + BOTH recordTransactionTx ledger rows in the SAME tx, so an
 * unpaired or double-booked user transfer is structurally impossible to express.
 * sum(User.money) is invariant across the call.
 */
export async function transferUserMoneyOrThrow(tx, {
  fromUserId, toUserId, amount,          // positive int; fromUserId !== toUserId enforced
  debitCategory, creditCategory,         // e.g. 'stud_fee_paid' / 'stud_fee_earned'
  description, metadata = {},
})
```

Internals (all on `tx`): conditional debit (`updateMany`, `money: { gte }`) → throw
`InsufficientFundsError` on `count===0` → payee `update({ money: { increment } })` → two
`recordTransactionTx` rows (debit then credit, shared metadata). Rejects `amount <= 0` and
`fromUserId === toUserId` synchronously.

**Adjacent-locations note (§3 no-bundling):** `buyHorse` keeps its inline copy in this epic;
migrating it onto the helper is filed as a separate follow-up issue.

### 6.2 Public breed (`POST /breeding/stud/:stallionId/breed`)

Shared executor `executeStudBreeding(tx, { stallion, mare, requesterId, feeAmount, foalName,
foalBreedId, mode, requestId? })` in
`backend/modules/breeding/services/studBreedingService.mjs` — used verbatim by 6.3 so the
two paths cannot drift. Controller flow:

```
prisma.$transaction(async tx => {
  1. Load stallion (tx.horse.findUnique) → 404 if missing.
  2. STALLION LISTING GUARD — conditional updateMany atomic claim (pattern 2):
       tx.horse.updateMany({
         where: { id: stallionId, studStatus: STUD_STATUS_PUBLIC },
         data:  { updatedAt: now },            // predicate-verifying touch; takes the row lock
       })
     count===0 → throw 409 NOT_AT_STUD. Holding this lock until commit means a racing
     unlist/fee-edit serializes against this breeding (D10).
  3. Re-read stallion inside tx (fee snapshot is now stable — we hold its lock).
     feeAmount := stallion.studFee ?? 0.
  4. Load mare via findOwnedResource-equivalent inside tx → 404-shape if not owned/missing.
  5. evaluateStudBreedingEligibility(...) → map {code, httpStatus} → throw; NO money moved.
  6. MARE PREGNANCY CLAIM — Equoria-9gsxg pattern (pattern 3), extended with the cooldown
     predicate so the claim itself is the authoritative gate for BOTH invariants:
       tx.horse.updateMany({
         where: {
           id: mare.id,
           userId: requesterId,                    // ownership re-checked atomically
           inFoalSinceDate: null,                  // not pregnant
           OR: [                                   // off cooldown (date-only UTC; lastBredDate
             { lastBredDate: null },               //  is @db.Date, stored at midnight UTC)
             { lastBredDate: { lte: utcDayMinus(now, DAM_BREEDING_COOLDOWN_DAYS) } },
           ],
         },
         data: {
           inFoalSinceDate: now, pregnancySireId: stallion.id,
           pregnancyFeedingsByTier: {}, lastBredDate: now,
           pendingFoalName: foalName ?? null, pendingFoalBreedId: foalBreedId ?? null,
         },
       })
     count===0 → throw 409 MARE_PREGNANT (a concurrent breed/accept won). The loser is
     NEVER charged: money has not moved yet.
  7. FEE PAYMENT — pattern 1, only if feeAmount > 0 (D6):
       transferUserMoneyOrThrow(tx, { fromUserId: requesterId, toUserId: stallion.userId,
         amount: feeAmount, debitCategory: 'stud_fee_paid', creditCategory: 'stud_fee_earned',
         description: `Stud fee — ${stallion.name} × ${mare.name}`,
         metadata: { stallionId, mareId, mode, requestId } })
     InsufficientFundsError → tx rolls back → the pregnancy claim in step 6 is undone.
     Exactly-once: the claim (6) and the payment (7) commit or roll back together.
})
// post-commit: createNotification × 2 ('stud_breeding_completed' to requester,
// 'stud_fee_received' to owner); 200 with { foalDueDate, feePaid, newBalance }.
```

`utcDayMinus(now, 7)`: mare bred on UTC day D is breedable from day D+7 00:00 UTC
(`horseFoalingController.mjs:20-25` semantics). Since `lastBredDate` is `@db.Date`
(midnight UTC), the predicate `lastBredDate <= startOfUtcDay(now) - 7 days` is exactly
`getHorseAgeDays(lastBredDate, now) >= 7`. Helper lives next to the validator; unit-tested
against `getHorseAgeDays` for agreement on the boundary day (sentinel: both flip on the same
UTC midnight).

### 6.3 Private accept (`POST /breeding/stud-requests/:requestId/accept`)

```
TX A: prisma.$transaction(async tx => {
  1. Load request (tx) → 404 if missing.
  2. AUTHZ: load stallion; stallion.userId === req.user.id (CURRENT owner, not the
     snapshot) → else 403. (The accepter is the payee — re-derived here, D9/§3.2.)
  3. REQUEST CLAIM — pattern 2:
       tx.breedingRequest.updateMany({
         where: { id: requestId, status: 'pending' },
         data:  { status: 'accepted', resolutionReason: 'accepted', resolvedAt: now },
       })
     count===0 → throw 409 REQUEST_NOT_PENDING (a racing cancel/reject/accept won —
     cancel-vs-accept is decided HERE, atomically, whichever transitions `pending` first).
  4. STALLION LISTING GUARD (as 6.2 step 2, but requiredStatus = PRIVATE).
  5. Load mare fresh (tx); load requester money (tx).
  6. evaluateStudBreedingEligibility(...) — authoritative re-validation (submit-time state
     is NOT trusted; mare may be pregnant/sold/aged-out, requester may be broke).
     Failure → throw typed error carrying { code, permanent } → TX A ROLLS BACK
     (request returns to pending; no money moved).
  7. executeStudBreeding(tx, …, feeAmount: request.studFee /* D2 snapshot */,
       foalName: request.pendingFoalName, foalBreedId: request.pendingFoalBreedId,
       mode: 'private', requestId)
     → mare pregnancy claim (authoritative; count===0 → throw { code: 'MARE_PREGNANT',
       permanent: true }) → transferUserMoneyOrThrow (payee = CURRENT stallion.userId).
})
// On TX A success: notifications ('stud_request_accepted' + 'stud_fee_received' /
//   'stud_fee_paid' sides), 200.
// On step-6/7 eligibility failure AND error.permanent === true → TX B (compensating close):
TX B: tx.breedingRequest.updateMany({
        where: { id: requestId, status: 'pending' },     // still atomic — a racing cancel wins harmlessly
        data: { status: 'rejected', resolutionReason: `ineligible:${code}`, resolvedAt: now },
      })
      + notification to requester; respond 409 { code } to the accepter.
// permanent === false (INSUFFICIENT_FUNDS, health, cooldown) → request STAYS pending;
//   respond 409 { code } to the accepter. (D4)
// Crash between TX A rollback and TX B: request remains pending — safe (no money moved);
//   the owner simply retries or rejects manually. Never the reverse order.
```

### 6.4 Submit request (`POST /breeding/stud/:stallionId/requests`)

No money moves → no multi-row invariants to hold → single insert; the DB is the arbiter:

```
1. Load stallion + mare (bare prisma) → 404/404-shape; require studStatus = PRIVATE.
2. evaluateStudBreedingEligibility(...) with requesterMoney from a fresh read (advisory
   funds check per the brief — real check happens at accept) → 4xx on failure.
3. prisma.breedingRequest.create({ stallionId, mareId, requesterId,
     stallionOwnerId: stallion.userId, studFee: stallion.studFee ?? 0,
     pendingFoalName, pendingFoalBreedId })
   catch Prisma P2002 on breeding_requests_one_pending_per_mare
     → 409 MARE_HAS_ACTIVE_REQUEST.   // pattern 3, enforced by the DB itself:
                                      // two concurrent submits → exactly one row
4. Notification to stallion owner ('stud_request_received'). 201 with the request.
```

The eligibility pre-check is advisory (a READ COMMITTED race window exists) — that is fine by
design: the request row holds no money and every criterion is re-validated atomically at
accept. The one invariant that MUST hold at submit — one pending per mare — is held by the
partial unique index, not by the pre-check.

### 6.5 Cancel / reject

Single conditional `updateMany` each (pattern 2), no tx needed beyond the single statement:

```
cancel:  updateMany({ where: { id, status: 'pending', requesterId: me },
                      data: { status: 'cancelled', resolutionReason: 'cancelled_by_requester', resolvedAt } })
reject:  authz first (current stallion owner via join), then
         updateMany({ where: { id, status: 'pending' },
                      data: { status: 'rejected', resolutionReason: 'rejected_by_owner', resolvedAt } })
```

`count===0` → disambiguate with a follow-up read: row missing or (cancel) not mine →
404-shape; row mine but already terminal → 409 `REQUEST_NOT_PENDING`. Cancelling frees the
mare instantly (partial index counts only `pending`). Post-commit notification to the
counterparty.

### 6.6 Unlist cascade (D3, in the listing endpoints)

```
prisma.$transaction(async tx => {
  1. tx.horse.update: studStatus := new value, studFee := new value   (owner-guarded route)
  2. If old mode was PRIVATE and new mode !== PRIVATE:
       tx.breedingRequest.updateMany({
         where: { stallionId, status: 'pending' },
         data: { status: 'rejected', resolutionReason: 'listing_removed', resolvedAt: now },
       })                                  // set-based, atomic; racing accepts lose their
})                                         // step-3 claim or this loses — either way exactly
                                           // one terminal transition per request
// post-commit: notify each affected requester.
```

An accept racing the unlist: both contend on the request row's `pending` predicate (and on
the stallion row lock via the listing guard) — exactly one wins; if the accept wins first,
the unlist still succeeds and simply cascades zero-or-fewer rows. Money can only have moved
if the accept fully committed. No stranded state exists.

---

## 7. Cross-cutting requirements

- **Audit trail:** all mutations are under `/api/v1/breeding/…` or `/api/v1/horses/…` —
  the `breeding`/`breed` sensitive prefix covers the new money-moving routes automatically.
  S5 adds one integration assertion: a public breed writes an `audit_logs` row.
- **GDPR (Equoria-s3rf):** `gdprAccountService.mjs` must (a) include the user's breeding
  requests (as requester) in `GET /account/export`, and (b) rely on the Cascade FKs for
  erasure — verified by extending the existing GDPR integration test. Lands in S6 with the
  request feature. `stallionOwnerId` is a soft snapshot; erasing that user leaves the string
  id in historical rows — same posture as `audit_logs` soft references (documented
  legitimate-interest exception), noted for the privacy policy.
  _(Added 2026-07-06 review — the ANONYMIZE branch:)_ when erasure takes the horse-preserving
  anonymize path (`gdprAccountService.mjs:519-538`: stallion has surviving external offspring →
  `userId: null`, `studStatus: 'Not at Stud'`, fee 0), the FK cascade does NOT fire, and pending
  requests against that stallion would strand — nobody can ever accept/reject them, violating
  D3's invariant. S6/S7 must run the D3 cascade-reject (`resolutionReason: 'listing_removed'`,
  requester notified) inside the anonymize transaction too, with a test: erase a stallion owner
  (anonymize branch) while a request is pending → the request ends `rejected`, mare freed, no
  money moved.
- **Prototype pollution:** new sub-router mounts inside the existing `/api/v1` pipeline;
  each mutating route also adds `rejectPollutedRequest` per house style (CONTRIBUTING §3).
- **Rate limiting:** `mutationRateLimiter` on all writes; `queryRateLimiter` on reads
  (matches `horseBreedingRoutes.mjs`).
- **Module boundaries (r9we2/pfe6x):** everything new lives in `backend/modules/breeding/`
  (controllers/services/routes/constants + co-located `__tests__/`);
  `backend/modules/breeding/index.mjs` barrel re-exports the public surface
  (`evaluateStudBreedingEligibility`, `isCrossbreedAllowed`, constants). The horses-module
  listing controller imports breeding constants through that barrel.
  `transferUserMoneyOrThrow` lives in the economy module's `financialLedgerService.mjs`
  next to its siblings; breeding imports it via `modules/economy` barrel.
- **File sizes:** every new source file ≤ 600 lines, tests ≤ 800 (urqic.7 ratchet — split
  test suites by flow rather than one god-suite).
- **ESM + naming conventions** per ES_MODULES_REQUIREMENTS / CONTRIBUTING (camelCase,
  `.mjs`, `.js`-suffixed imports).

---

## 8. Test plan

All backend tests: real DB, no mocks, `TestFixture-` prefixed names,
`createTestHorse`/`...fixtureColor()` fixtures, scoped cleanup (CONTRIBUTING fixture rules).
Concurrency sentinels use `Promise.all` of parallel requests against the real Express app
(supertest) — the exact shape of `foalNowConcurrentClaim.test.mjs` /
`vetBookConcurrentRace.integration.test.mjs`. **Each sentinel must be shown to FAIL against
a naive implementation** (EDGE_CASE §1: for each, the issue records the failing run against
a deliberately-naive variant — e.g. claim replaced by read-check-write — before the real
implementation lands).

### Concurrency sentinels (the brief's required set)

| #   | Race                                                                                                                                                                       | Assertion                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Two accepts of the SAME request in parallel                                                                                                                                | exactly one 200; other 409; requester debited EXACTLY once; owner credited exactly once; exactly 2 ledger rows; `sum(money)` both users conserved |
| C2  | Cancel racing accept                                                                                                                                                       | request ends in exactly ONE terminal state; if `cancelled` → zero money moved, zero ledger rows; if `accepted` → exactly-once payment; never both |
| C3  | Two submits for the same mare in parallel (different stallions)                                                                                                            | exactly one 201, one 409 `MARE_HAS_ACTIVE_REQUEST`; exactly one `pending` row exists (DB partial index is the arbiter)                            |
| C4  | Public breed racing private accept for the SAME mare (request on stallion A, public breed to stallion B)                                                                   | exactly one pregnancy (`pregnancySireId` names exactly one stallion); the loser is never charged; at most one fee moved                           |
| C5  | Unlist racing accept                                                                                                                                                       | either accept completed (money moved once, request `accepted`) or cascade won (request `rejected`, no money); never a charged-but-rejected state  |
| C6  | Two public breeds racing for the same mare: one mare owner fires two concurrent breed requests against two DIFFERENT publicly-listed stallions (different stallion owners) | exactly one pregnancy claim wins; loser 409, un-charged                                                                                           |

### Eligibility / no-charge rejections (each asserts: 4xx, mare unchanged, ZERO ledger rows, balances unchanged)

Pregnant mare · mare age 2 (underage) · mare age 21 (overage; age exactly 3 and exactly 20
pass — boundary tests) · insufficient funds (public path: claim rolled back too) ·
on-cooldown mare (bred 6 days ago fails, 7 days ago passes — date-only UTC boundary, dob/bred
timestamps at non-midnight offsets per the vdw5 trap) · self-cross · wrong sexes ·
crossbreed pair (fail-closed default) · `breedId: null` horse · own stallion (D5) ·
not-listed stallion · public-listed stallion via the private submit path (and vice versa) ·
critical-health parent.

### Money correctness

- Fee charged exactly once and conserved: pre/post `sum` of both users' money identical;
  exactly two `user_transactions` rows with correct categories, `balanceAfter` accurate
  (recordTransactionTx reads in-tx).
- Zero-fee listing: breeding succeeds, zero ledger rows (D6).
- Accept charges the SNAPSHOT fee after the owner raised the listing fee (D2).
- `transferUserMoneyOrThrow` unit-level: conservation, `InsufficientFundsError` on exact
  boundary−1, self-transfer rejection, amount≤0 rejection, rollback-with-parent sentinel
  (mirrors `debitMoneyOrThrowConservation.integration.test.mjs`).

### Access control (brief deliverable 6)

Non-owner accept → 403 · non-owner reject → 403 · non-requester cancel → 404-shape ·
public-breed with someone else's mare → 404-shape · submit with someone else's mare →
404-shape · listing set/unset by non-owner → 404-shape (existing q072 middleware) ·
stallion SOLD between submit and accept: old owner's accept → 403, new owner's accept →
200 with fee credited to the NEW owner.

### Lifecycle / cascade

Unlist cascade-rejects N pending requests, notifies each, moves no money · reject frees the
mare for a new submit · cancel frees the mare · accepted request's mare gets
`pendingFoalName`/`pendingFoalBreedId` stamped · accept-revalidation permanent failure
auto-rejects (D4) · transient failure (broke requester) leaves it pending (D4) ·
GDPR export contains requests; account erasure cascades them.

### Playwright E2E (real credentials, real backend, no bypasses)

1. Public flow: owner lists stallion public with fee → second user browses stud listings,
   breeds mare → sees pregnancy + balance drop; owner sees credit.
2. Private flow: list private → request → owner inbox shows it → accept → both sides see
   outcome; mare pregnant; fee moved.
3. Reject + cancel flows; the one-active-request rule surfaced in UI (submit button disabled
   with reason).
4. Ineligible mare (on cooldown) shows the honest blocking reason — no silent failure.

---

## 9. Frontend (children S9/S10)

React 19 + React Query per PATTERN_LIBRARY (staleTime: listings 1min/refetch-on-focus like
competition lists; requests 30s like balance-critical data). BaseModal for the breed/accept
confirmations (fee prominently displayed before confirm). Honest empty/error states only.

- **Stud marketplace page** (`/breeding/studs` or a tab on the existing marketplace page —
  UX call for the implementer): browse/filter listings, stallion card → breed-now modal
  (public) or request modal (private).
- **My stallion listing controls**: extend the existing horse-detail stud section with
  mode + fee editing (endpoints already exist, gaining `mode`).
- **Requests inbox/outbox**: incoming (accept/reject with confirm), outgoing (status +
  cancel). Mutations invalidate listing/request/balance queries.
- api-client methods + `useStudListings` / `useStudRequests` / mutation hooks; every
  component actually reachable from a rendered page (the audit's №1 false-closure pattern —
  wiring is part of the AC, not a follow-up).

---

## 10. bd epic & build order

Child issues (each one session, per Constitution §5). Dependencies in parentheses.

| ID  | Title                                                                                                           | Depends on                     | Migration-gated                                                           |
| --- | --------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------- |
| S1  | Schema: BreedingRequest + partial unique index + CHECKs + Horse `[studStatus, studFee]` index                   | —                              | **YES — user approves before `prisma migrate` runs**                      |
| S2  | Stud constants + listing `mode` (public/private) + browse endpoint                                              | — (cascade-reject lands in S7) | no                                                                        |
| S3  | `transferUserMoneyOrThrow` + conservation sentinels                                                             | —                              | no                                                                        |
| S4  | Shared eligibility validator + `isCrossbreedAllowed` (fail-closed) + shared rule constants                      | —                              | no                                                                        |
| S5  | Public stud breed endpoint (tx §6.2) + `executeStudBreeding` + race sentinels C6 + audit assertion              | S2, S3, S4                     | indirectly (needs S1's Horse index only for browse perf — hard dep: none) |
| S6  | Private requests: submit/cancel/outgoing/incoming + P2002 mapping + C3 + GDPR export/erasure                    | S1, S4                         | via S1                                                                    |
| S7  | Private accept/reject + D4 permanent/transient handling + unlist cascade (D3) + C1, C2, C5                      | S1, S3, S4, S5                 | via S1                                                                    |
| S8  | Cross-flow hardening: C4 (public-vs-accept same mare), full-lifecycle conservation audit, deadlock-order review | S5, S6, S7                     | via S1                                                                    |
| S9  | Frontend: browse page + listing controls + public breed flow                                                    | S2, S5                         | no                                                                        |
| S10 | Frontend: request inbox/outbox + accept/reject/cancel flows                                                     | S6, S7                         | no                                                                        |
| S11 | Playwright E2E (public + private + access-control + honest-blocking-reason)                                     | S9, S10                        | via S1                                                                    |

**Recommended build order:** S1 (user gate first — everything request-shaped needs the
table) → S3 + S4 + S2 in parallel → S5 → S6 → S7 → S8 → S9 + S10 in parallel → S11.
If the migration approval is delayed, S2/S3/S4/S5 (public stud MVP) can land first —
public stud has NO schema dependency and is shippable alone.

**Gated on schema-migration approval:** S1 itself, and transitively S6, S7, S8, S10, S11.
**Not gated:** S2, S3, S4, S5, S9 (the public-stud half).

## What was deliberately NOT done here (deferral channel, Constitution §5)

- Crossbreed ruleset content — **user product decision** (§1.1); the hook ships fail-closed.
- `createFoal` unification onto the shared validator (would change its behavior — no breed
  check / no max-age today) — follow-up bd issue, filed with the epic.
- `buyHorse` migration onto `transferUserMoneyOrThrow` — follow-up bd issue (§6.1).
- Stallion max-age cap (D7), listing history table (D1 alternative), stud-fee market
  analytics — not specced; file on demand.
