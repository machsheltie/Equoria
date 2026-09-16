/**
 * Groom Fee Basis — WHAT A GROOM COSTS, and how many horses one may take.
 *
 * Equoria-95yrv (the rate and the cap) and Equoria-bgdfb (what an unpaid week
 * becomes). Split out of groomSalaryService.mjs, which owns COLLECTING the fee and
 * reached its 600-line cap: this file is the basis itself — the numbers the ruling
 * fixed, the arithmetic over them, and the one rule that has to hold at assignment
 * time for the cap to mean anything. groomSalaryService re-exports all of it, so
 * every existing importer is unchanged.
 */

// Equoria-95yrv fix round 1 (F1): the ten-horse cap is enforced under the same
// transaction-scoped advisory lock the weekly fee pass uses.
import { jobNameToLockKey } from '../../../utils/cronLock.mjs';

/**
 * Equoria-95yrv, owner ruling 2026-09-14 10:23: "Charge the player per horse
 * assigned to a groom per week: $70 per horse per week, up to 10 horses per
 * groom."
 *
 * The fee no longer depends on WHO the groom is. The skill/specialty rate table
 * (50/75/100/150 plus 0/10/15) is gone with the per-groom-on-staff basis it
 * priced; a groom's skill still decides how WELL they work, never what they cost.
 */
export const FEE_PER_HORSE_PER_WEEK = 70;

/**
 * The most horses one groom may be working at a time. Enforced where assignments
 * are CREATED (groomAssignmentService.validateAssignmentEligibility and
 * groomSystem.assignGroomToFoal), which is the only place it can be enforced
 * without lying to a player about a roster they can see.
 */
export const MAX_HORSES_PER_GROOM = 10;

/**
 * Equoria-bgdfb, owner ruling 2026-09-14 10:23: "It's owed."
 *
 * A weekly fee that could not be taken is a DEBT, not a forgiven week. These are
 * the `GroomSalaryPayment.status` values that mean "this week is still owed":
 * the player had no money (`missed_insufficient_funds`, Equoria-ypb7d.3) or our own
 * collection threw (`missed_collection_error`, Equoria-2ti1j). Each such row carries
 * the amount of the week it records and is dated with that week's Monday, so the
 * outstanding debt is a sum over rows rather than a number stored anywhere — which
 * is why this needed no schema change.
 *
 * A row leaves the owed set exactly once, in one of two ways:
 *   ARREARS_SETTLED_STATUS     — collected with a later week's fee, in that week's
 *                                single debit. The row is never collected twice.
 *   ARREARS_WRITTEN_OFF_STATUS — the groom was released to the grooms-for-hire pool
 *                                for a full unpaid week. Losing the groom IS the
 *                                penalty; a debt for a groom the player no longer
 *                                has would be charging them for nothing.
 */
export const ARREARS_OWED_STATUSES = Object.freeze([
  'missed_insufficient_funds',
  'missed_collection_error',
]);
export const ARREARS_SETTLED_STATUS = 'arrears_settled';
export const ARREARS_WRITTEN_OFF_STATUS = 'arrears_written_off';

/**
 * The weekly fee for ONE groom: $70 for every horse they are currently working.
 *
 * Equoria-95yrv. A groom on no horses costs nothing — the ruling prices WORK, not
 * headcount, so an unassigned groom is no longer a sink and a groom on three
 * horses costs three times a groom on one.
 *
 * OVER-CAP ROWS ARE REPORTED, NOT TRUNCATED. `MAX_HORSES_PER_GROOM` is enforced
 * at assignment time; a groom that already exceeds it (data predating the cap)
 * is charged for the horses they actually have. Clamping here would quote a
 * player a fee that does not match the roster in front of them, which
 * PRODUCT.md principle 7 forbids — and it would make the excess free.
 *
 * @param {number} assignedHorses - the groom's ACTIVE assignment count
 * @returns {number} Weekly fee in whole currency units
 */
export function calculateWeeklyFee(assignedHorses) {
  const horses = Number(assignedHorses);
  if (!Number.isFinite(horses) || horses <= 0) {
    return 0;
  }
  return Math.trunc(horses) * FEE_PER_HORSE_PER_WEEK;
}

/**
 * Count the ACTIVE assignments of each groom in `groomIds`.
 *
 * One grouped read rather than a count per groom: the weekly pass walks every
 * groom on staff, and the fee is now a function of this number.
 *
 * @param {Object} client - Prisma client or transaction client
 * @param {number[]} groomIds
 * @returns {Promise<Map<number, number>>} groomId -> active assignment count
 */
export async function countActiveAssignments(client, groomIds) {
  const counts = new Map(groomIds.map(id => [id, 0]));
  if (groomIds.length === 0) {
    return counts;
  }
  const grouped = await client.groomAssignment.groupBy({
    by: ['groomId'],
    where: { groomId: { in: groomIds }, isActive: true },
    _count: { _all: true },
  });
  for (const row of grouped) {
    counts.set(row.groomId, row._count._all);
  }
  return counts;
}

/**
 * Serialize every writer that is about to seat a horse with THIS groom.
 *
 * Equoria-95yrv fix round 1 (F1). The cap was a count followed by a create, with
 * nothing between them: two `POST /api/grooms/assign` requests for a groom at nine
 * horses both counted nine, both passed, and both created — eleven active
 * assignments, billed at 11 x 70, and the over-cap path is deliberately unclamped
 * so nothing ever brought it back. The guard and the write it guards must be one
 * atomic act.
 *
 * WHY AN ADVISORY LOCK AND NOT A GUARDED `INSERT ... SELECT ... WHERE (COUNT) < 10`.
 * That shape is the first thing to reach for, and it does NOT hold here. The
 * campaign's atomic-path rule works because a conditional UPDATE takes a row lock on
 * the row it tests, so a second writer blocks on it. A COUNT over sibling rows takes
 * no lock and, under READ COMMITTED, cannot see an uncommitted sibling INSERT: two
 * transactions racing at nine would BOTH count nine inside their own snapshots and
 * both insert. It is the classic phantom, and a single statement does not cure it —
 * only SERIALIZABLE (which the app does not run) or a real lock does. There is no
 * row to guard and no unique constraint to lean on: expressing "at most ten rows in
 * this set" declaratively would need a slot column and a unique index, i.e. a schema
 * change.
 *
 * So: the same `pg_advisory_xact_lock` idiom the weekly fee pass already uses
 * (`groomEngagementService.acquirePayWeekLockTx`), keyed on the GROOM. The loser
 * WAITS for the winner's commit and then counts ten, so it refuses rather than
 * failing spuriously. Held for the length of the transaction, released by commit or
 * rollback. Different grooms take different keys and never contend.
 *
 * MUST be the first statement of the assignment transaction — the count below is
 * only race-safe while it is held.
 *
 * @param {Object} tx - Prisma transaction client
 * @param {number} groomId
 * @returns {Promise<void>}
 */
export async function acquireGroomRosterLockTx(tx, groomId) {
  const lockKey = jobNameToLockKey(`groomRoster:${groomId}`);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;
}

/**
 * Refuse an eleventh horse. Equoria-95yrv.
 *
 * Both doors that create a `GroomAssignment` call this — the service path
 * (groomAssignmentService.createAssignment) and groomSystem.assignGroomToFoal, which
 * had no limit at all. The message is written for a player: horses, not
 * "assignments", and a number they can count on their own roster.
 *
 * CALL IT ON A TRANSACTION CLIENT, AFTER `acquireGroomRosterLockTx`, AND CREATE THE
 * ASSIGNMENT ON THAT SAME CLIENT. On the autocommit client this is a read whose
 * answer is stale the moment it returns (fix round 1, F1). It is still called on the
 * autocommit client in ONE place — `validateAssignmentEligibility`, which reports
 * eligibility to a caller that is not writing anything — and that is a report, not a
 * guard: the guard is the in-transaction call in `createAssignment`.
 *
 * @param {Object} client - Prisma client or transaction client
 * @param {number} groomId
 * @param {string} groomName
 * @returns {Promise<void>} resolves when there is room; throws when there is not
 */
export async function assertGroomHasRoomForAnotherHorse(client, groomId, groomName) {
  const active = await client.groomAssignment.count({
    where: { groomId, isActive: true },
  });
  if (active >= MAX_HORSES_PER_GROOM) {
    throw new Error(atCapacityMessage(groomName));
  }
}

/** The player-facing refusal, in one place so both doors say the same thing. */
export function atCapacityMessage(groomName) {
  return (
    `${groomName} is already caring for ${MAX_HORSES_PER_GROOM} horses, which is as many as ` +
    'one groom can take. Free up a horse or assign a different groom.'
  );
}

export default {
  acquireGroomRosterLockTx,
  FEE_PER_HORSE_PER_WEEK,
  MAX_HORSES_PER_GROOM,
  ARREARS_OWED_STATUSES,
  ARREARS_SETTLED_STATUS,
  ARREARS_WRITTEN_OFF_STATUS,
  calculateWeeklyFee,
  countActiveAssignments,
  assertGroomHasRoomForAnotherHorse,
  atCapacityMessage,
};
