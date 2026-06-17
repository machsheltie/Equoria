/**
 * Horse Feed Service (feed-system redesign 2026-04-29, Equoria-l5kf,
 * parent: Equoria-3gqg).
 *
 * Provides the daily feed action: transactional inventory decrement,
 * lastFedDate set, and stat-boost RNG roll. Single source of truth for
 * feed-action pre-conditions — the controller is a thin HTTP shim around
 * `feedHorse()`.
 *
 * Pre-conditions (all checked inside the transaction):
 *   - horse exists (404 if not)
 *   - horse belongs to caller (404, NOT 403, for CWE-639 disclosure
 *     resistance — see commit 892fc812 / requireOwnership middleware in
 *     backend/middleware/ownership.mjs:14-15). This branch is unreachable
 *     when the route is wired with requireOwnership('horse'), but
 *     defense-in-depth still warrants the check.
 *   - age < 21 (else returns { skipped: 'retired' }, no inventory mutation)
 *   - equippedFeedType is set (else 400)
 *   - alreadyFedToday returns false (else 400)
 *   - inventory has >= 1 unit of equipped tier (else 400 + auto-clear
 *     equippedFeedType per spec §6.2 step 6a)
 *
 * RNG is injectable for deterministic service-level tests (Task A9).
 */

import prisma, { Prisma } from '../../../../packages/database/prismaClient.mjs';
import { FEED_CATALOG } from '../../economy/feedShop/controllers/feedShopController.mjs';
import { alreadyFedToday, startOfUtcDay } from '../../../utils/horseHealth.mjs';

// 12-stat boost pool. Names match Horse schema fields exactly.
const STATS = [
  'precision',
  'strength',
  'speed',
  'agility',
  'endurance',
  'intelligence',
  'stamina',
  'balance',
  'boldness',
  'flexibility',
  'obedience',
  'focus',
];

const TIER_BY_ID = Object.fromEntries(FEED_CATALOG.map(t => [t.id, t]));

// Equoria-zvp4 / Equoria-lnblu: the optimistic-claim UPDATE interpolates the
// stat-boost column name as a raw identifier (`Prisma.raw`) — a parameterized
// tagged template binds VALUES, not IDENTIFIERS, so a column name cannot be a
// bound parameter. That interpolation is only safe because the name can ONLY be
// one of these 12 hardcoded literals — `rollStatBoost()` returns
// `STATS[Math.floor(rng()*STATS.length)]`, never user input. This Set is the
// belt-and-braces assertion that the value about to be interpolated is a
// known column; an unrecognised name throws rather than reaching SQL. All
// VALUES (lastFedDate, tier id, horse id, start-of-today) are bound via ${}.
const STAT_COLUMN_WHITELIST = new Set(STATS);

/**
 * Equoria-55m83: classify a thrown error as a TRANSIENT, RETRYABLE Prisma
 * interactive-transaction timeout (vs. a genuine fault).
 *
 * feedHorse() runs an interactive `prisma.$transaction`. Under heavy
 * concurrent contention on one horse row + a slow host + a small connection
 * pool, that transaction can fail two retryable ways, BOTH surfaced by Prisma
 * as `PrismaClientKnownRequestError` code `P2028` ("Transaction API error"):
 *   - "Unable to start a transaction in the given time." (maxWait pool-acquire)
 *   - "Transaction already closed: … the timeout for this transaction was
 *     5000 ms, however N ms passed …" (interactive timeout exceeded)
 * Both mean "the server was momentarily too busy to complete the transaction"
 * — a retryable condition that should map to HTTP 503, NOT 500 (500 wrongly
 * signals a permanent fault and tells clients not to retry). The CI Load
 * Contention advisory job surfaced exactly these (run 27682539878).
 *
 * The classifier MUST stay narrow: genuine pre-condition errors (404/400) and
 * other Prisma faults (e.g. P2002) MUST return false so they keep surfacing as
 * their own status / 500 — masking a real bug behind a 503 is the failure mode
 * this guard must never introduce (CLAUDE.md §3). Primary signal is the P2028
 * code; the message regex is a belt-and-braces fallback for the two known
 * timeout phrasings in case a driver/version surfaces them without the code.
 *
 * @param {unknown} err
 * @returns {boolean} true iff `err` is a retryable transaction-timeout error
 */
export function isRetryableTxError(err) {
  if (!err || typeof err !== 'object') {
    return false;
  }
  if (err.code === 'P2028') {
    return true;
  }
  const message = typeof err.message === 'string' ? err.message : '';
  return /unable to start a transaction|transaction already closed|transaction api error/i.test(
    message,
  );
}

function getInventory(settings) {
  if (!settings || typeof settings !== 'object') {
    return [];
  }
  return Array.isArray(settings.inventory) ? settings.inventory : [];
}

/**
 * Roll for a stat boost based on the tier's statRollPct.
 *
 * Calls `rng()` twice — once for the threshold check, once for the stat
 * selection — so deterministic tests can drive both outcomes by seeding
 * the rng with a sequence of known values.
 *
 * @param {string} feedTier - Tier id (one of FEED_CATALOG ids)
 * @param {() => number} [rng=Math.random] - 0..1 random function
 * @returns {{ stat: string, amount: number } | null}
 */
export function rollStatBoost(feedTier, rng = Math.random) {
  const tier = TIER_BY_ID[feedTier];
  if (!tier || tier.statRollPct === 0) {
    return null;
  }
  if (rng() * 100 >= tier.statRollPct) {
    return null;
  }
  const stat = STATS[Math.floor(rng() * STATS.length)];
  return { stat, amount: 1 };
}

/**
 * Feed a horse. Transactional. Validates pre-conditions, decrements the
 * pooled inventory by 1 unit of the equipped tier, sets lastFedDate, rolls
 * a stat boost, and (when inventory hits 0 for that tier) prunes the
 * inventory row AND clears horse.equippedFeedType.
 *
 * @param {{ userId: string, horseId: number|string, rng?: () => number }} args
 * @returns {Promise<
 *   | { skipped: 'retired', horse: object }
 *   | {
 *       horse: object,
 *       feed: { tier: string, name: string },
 *       remainingUnits: number,
 *       statBoost: { stat: string, amount: number } | null,
 *       equippedFeedClearedDueToEmpty: boolean,
 *     }
 * >}
 * @throws {Error & { status: number }} 400/404 on pre-condition failures
 */
export async function feedHorse({ userId, horseId, rng = Math.random }) {
  // Out-of-feed strategy: do the auto-clear (spec §6.2 step 6a) INSIDE the
  // transaction so it commits atomically with the rest of the read state,
  // then return a discriminator and have the OUTER scope throw the 400.
  // Throwing inside the txn would roll back the clear; throwing outside,
  // after the txn has committed, preserves the clear. This is atomic with
  // the surrounding reads — no race window between commit and clear.
  //
  // Concurrency model (Equoria-zvp4 — optimistic concurrency, NO row lock):
  //   The pre-checks below (alreadyFedToday, inventory) are advisory — they
  //   produce friendly 400s on the COMMON path. They do NOT close the
  //   lost-update race on their own, because under READ COMMITTED two
  //   concurrent feeds of the same horse can both read the stale
  //   lastFedDate and both pass `alreadyFedToday()`. The race is actually
  //   closed by the ATOMIC GUARDED UPDATE further down: a single
  //   `UPDATE "horses" … WHERE lastFedDate-is-not-today` whose affected-row
  //   count must be exactly 1. The first feed to commit flips lastFedDate to
  //   today; the loser's WHERE clause then matches 0 rows, so it neither
  //   sets lastFedDate AGAIN, nor applies a second stat boost, nor bumps the
  //   pregnancy counter twice — and crucially the inventory decrement is
  //   gated on that count===1, so it cannot double-decrement.
  //
  //   This replaces the removed SELECT…FOR-UPDATE lock (Equoria-5g5k) that
  //   caused Prisma transaction timeouts under test-pool pressure: the
  //   optimistic UPDATE takes only the ordinary row write-lock for the
  //   duration of the statement (no SELECT…FOR-UPDATE lock-wait), so it is
  //   both race-safe AND timeout-free. The FOR-UPDATE-absence sentinel
  //   (feedHorseService.test.mjs) stays green by construction — no row lock
  //   is reintroduced. (Prose deliberately hyphenates "FOR-UPDATE" so the
  //   broadened sentinel regex /FOR\s+UPDATE/i can't trip on this comment.)
  const result = await prisma
    .$transaction(async tx => {
      const horse = await tx.horse.findUnique({ where: { id: Number(horseId) } });
      if (!horse) {
        const e = new Error('Horse not found');
        e.status = 404;
        throw e;
      }
      // CWE-639 disclosure resistance: cross-user access returns 404 (not 403)
      // so authenticated attackers cannot enumerate horse IDs. Mirrors the
      // pattern from requireOwnership middleware (backend/middleware/ownership.mjs).
      // Defense-in-depth — the route already wires requireOwnership('horse').
      if (horse.userId !== userId) {
        const e = new Error('Horse not found');
        e.status = 404;
        throw e;
      }
      if (horse.age !== null && horse.age !== undefined && horse.age >= 21) {
        return { kind: 'retired', horse };
      }
      if (!horse.equippedFeedType) {
        const e = new Error(
          'No feed currently selected. Please purchase feed from the feed store and equip it to your horse.',
        );
        e.status = 400;
        throw e;
      }
      if (alreadyFedToday(horse.lastFedDate)) {
        const e = new Error('Already fed today. Try again tomorrow.');
        e.status = 400;
        throw e;
      }

      const tier = TIER_BY_ID[horse.equippedFeedType];
      if (!tier) {
        const e = new Error(`Unknown feed tier: ${horse.equippedFeedType}`);
        e.status = 400;
        throw e;
      }

      const dbUser = await tx.user.findUnique({
        where: { id: userId },
        select: { settings: true },
      });
      const settings =
        dbUser?.settings && typeof dbUser.settings === 'object' ? dbUser.settings : {};
      const inventory = getInventory(settings).map(i => ({ ...i }));
      const idx = inventory.findIndex(i => i.id === `feed-${tier.id}`);

      if (idx < 0 || !Number.isFinite(inventory[idx].quantity) || inventory[idx].quantity < 1) {
        // Auto-clear equippedFeedType atomically with the rest of the txn
        // so the clear isn't visible only after a second round-trip. Then
        // signal the out-of-feed case so the outer scope can throw the 400.
        await tx.horse.update({
          where: { id: horse.id },
          data: { equippedFeedType: null },
        });
        return { kind: 'outOfFeed', tier };
      }

      inventory[idx].quantity -= 1;
      let equippedFeedClearedDueToEmpty = false;
      if (inventory[idx].quantity <= 0) {
        inventory.splice(idx, 1);
        equippedFeedClearedDueToEmpty = true;
      }

      const statBoost = rollStatBoost(tier.id, rng);

      // ── ATOMIC OPTIMISTIC CLAIM (Equoria-zvp4) ──────────────────────────
      // A single guarded UPDATE on the horse row is the linearisation point
      // for "I am today's feed". Everything that must happen exactly once per
      // feed-day rides on this ONE statement so none of it can be lost to a
      // concurrent feed:
      //   - lastFedDate := now          (the claim itself)
      //   - <stat> := <stat> + 1        (stat boost, when rolled)
      //   - equippedFeedType := NULL    (when inventory hit 0)
      //   - pregnancyFeedingsByTier[tier] += 1  (when in-foal — JSONB increment)
      //
      // The WHERE clause encodes the precondition (lastFedDate IS NULL OR
      // lastFedDate < start-of-today-UTC), matching `alreadyFedToday()`'s
      // UTC-calendar-day semantics. Postgres evaluates the WHERE against the
      // COMMITTED row at statement time, so the loser of a race sees the
      // winner's already-committed lastFedDate=today and matches 0 rows.
      //
      // affected === 1 → we won; proceed to decrement inventory.
      // affected === 0 → a concurrent feed already won. We must NOT
      //   double-decrement inventory, NOT re-apply a boost, NOT bump the
      //   counter — reject with the same "already fed today" 400 the
      //   advisory pre-check uses. (Fail-closed: a conflict rejects, it never
      //   silently double-applies.)
      //
      // No SELECT…FOR-UPDATE: this is a plain UPDATE taking only the ordinary
      // per-row write lock for the statement's duration — race-safe and
      // timeout-free (the FOR-UPDATE-absence sentinel stays green).
      const startOfTodayUtc = startOfUtcDay(new Date());

      // Equoria-lnblu: migrated off `tx.$executeRawUnsafe` (allowlisted unsafe
      // raw SQL) to the parameterized `tx.$executeRaw(Prisma.sql\`…\`)` form.
      // Every VALUE is bound via ${} (Prisma binds, never string-splices); the
      // ONLY raw interpolation is the stat-column identifier, which cannot be a
      // bound parameter and is provably one of the 12 STATS (whitelist-checked
      // below). The pregnancy JSONB bump uses jsonb_set on a COALESCE'd base so a
      // NULL/absent counter starts at 0 then becomes 1.
      const setFragments = [Prisma.sql`"lastFedDate" = ${new Date()}`];

      if (equippedFeedClearedDueToEmpty) {
        setFragments.push(Prisma.sql`"equippedFeedType" = NULL`);
      }

      if (statBoost) {
        if (!STAT_COLUMN_WHITELIST.has(statBoost.stat)) {
          // Unreachable in practice (rollStatBoost only returns STATS members),
          // but fail-closed rather than interpolate an unvetted identifier.
          const e = new Error(`Refusing to apply boost to unknown stat column: ${statBoost.stat}`);
          e.status = 500;
          throw e;
        }
        // Safe identifier interpolation: statBoost.stat is provably one of the 12
        // STATS. Column identifiers cannot be bound parameters, so Prisma.raw is
        // the documented mechanism for trusted (non-user-input) identifiers.
        const statCol = Prisma.raw(`"${statBoost.stat}"`);
        setFragments.push(Prisma.sql`${statCol} = ${statCol} + 1`);
      }

      if (horse.inFoalSinceDate) {
        // pregnancyFeedingsByTier[tier.id] += 1, atomically, on the column's
        // committed value at statement time (NOT a stale read-modify-write).
        // tier.id is a FEED_CATALOG id (basic/performance/…); bound as a param.
        setFragments.push(
          Prisma.sql`"pregnancyFeedingsByTier" = jsonb_set(COALESCE("pregnancyFeedingsByTier", '{}'::jsonb), ARRAY[${tier.id}], to_jsonb(COALESCE(("pregnancyFeedingsByTier" ->> ${tier.id})::int, 0) + 1), true)`,
        );
      }

      const affected = await tx.$executeRaw(Prisma.sql`
      UPDATE "horses" SET ${Prisma.join(setFragments, ', ')}
      WHERE "id" = ${horse.id}
      AND ("lastFedDate" IS NULL OR "lastFedDate" < ${startOfTodayUtc})`);

      if (affected === 0) {
        // A concurrent feed already claimed today. Reject — do NOT decrement
        // inventory or apply any side-effect. Mirrors the advisory pre-check's
        // message/status so the loser sees the same 400 as a sequential repeat.
        const e = new Error('Already fed today. Try again tomorrow.');
        e.status = 400;
        throw e;
      }

      // We won the claim: now (and only now) decrement the inventory. Because
      // the horse-row claim already committed-or-conflicted atomically, this
      // user-settings write can never run for a losing feed.
      await tx.user.update({
        where: { id: userId },
        data: { settings: { ...settings, inventory } },
      });

      // Re-read the horse to return the post-update state (stat boost + counter
      // applied) in the spec shape. Within the same txn this reflects our write.
      const updatedHorse = await tx.horse.findUnique({ where: { id: horse.id } });

      const remainingUnits = equippedFeedClearedDueToEmpty ? 0 : inventory[idx].quantity;

      return {
        kind: 'fed',
        horse: updatedHorse,
        feed: { tier: tier.id, name: tier.name },
        remainingUnits,
        statBoost,
        equippedFeedClearedDueToEmpty,
      };
    })
    .catch(err => {
      // Equoria-55m83: a transient Prisma transaction-timeout (P2028 — maxWait
      // pool-acquire OR interactive-timeout exceeded) is RETRYABLE. Map it to a
      // 503 so the controller returns "busy, retry shortly" instead of a 500 that
      // wrongly signals a permanent fault. Genuine faults (the 404/400 thrown
      // inside the txn, other Prisma codes, logic errors) are NOT retryable and
      // rethrow UNCHANGED so they keep surfacing as their own status / 500 —
      // masking a real bug behind a 503 is the failure mode this guard must never
      // introduce (CLAUDE.md §3, OPTIMAL_FIX_DISCIPLINE.md §2).
      if (isRetryableTxError(err)) {
        const e = new Error('Feeding is busy right now, please retry in a moment.');
        e.status = 503;
        throw e;
      }
      throw err;
    });

  // Out-of-feed: auto-clear already happened inside the txn. Throw the 400
  // here so the txn's clear stays committed (a throw inside the txn would
  // have rolled it back).
  if (result.kind === 'outOfFeed') {
    const e = new Error(`Out of ${result.tier.name}. Purchase more from the feed shop.`);
    e.status = 400;
    throw e;
  }

  if (result.kind === 'retired') {
    return { skipped: 'retired', horse: result.horse };
  }

  // result.kind === 'fed' — strip the discriminator and return the spec shape
  const { kind: _kind, ...fedResult } = result;
  return fedResult;
}
