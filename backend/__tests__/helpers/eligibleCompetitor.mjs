/**
 * Test fixtures for a horse that may enter a ridden show (Equoria-576c0 B9).
 *
 * Entry rules (owner rulings 2026-10-15/16): age 3-20 game years, and C10, an
 * active rider assignment whose rider is not retired and is employed by the
 * horse's owner. These helpers build exactly that through real rows; they
 * never touch the eligibility code.
 *
 *   const riderIds = [];
 *   const horse = await createTestHorse(prisma, { ...,
 *     dateOfBirth: competitionDateOfBirth(), userId }, horseIds);
 *   await giveEligibleRider(prisma, { horseId: horse.id, userId }, riderIds);
 *   // cleanup: riders before their employer user (RiderAssignment cascades
 *   // with the horse and with the rider)
 *   cleanup.add(() => prisma.rider.deleteMany({ where: { id: { in: riderIds } } }), 'riders');
 */

import { birthDateForAge } from '../../utils/horseAge.mjs';

/**
 * A dateOfBirth that reads `years` game years today on the Eastern calendar.
 * @param {number} [years=7]
 * @returns {Date}
 */
export function competitionDateOfBirth(years = 7) {
  return birthDateForAge(years);
}

/**
 * Horse fields for a horse in good health: a real band and fed today, so its
 * displayed health is not critical (bad health refuses entry - owner ruling
 * 2026-10-22, Equoria-0d4wa).
 * @returns {{ healthStatus: string, lastFedDate: Date }}
 */
export function healthyAndFed() {
  return { healthStatus: 'Excellent', lastFedDate: new Date() };
}

/**
 * Create a rider employed by `userId` and actively assign it to `horseId`.
 *
 * @param {object} db - prisma client
 * @param {{ horseId: number, userId: string, rider?: object, assignment?: object }} input
 *   `rider` / `assignment` override fields (e.g. `{ retired: true }`,
 *   `{ userId: otherUser }`, `{ isActive: false }`).
 * @param {number[]|{add: Function}} [cleanupOrIds] - an id collector array, or a
 *   failLoudCleanup tracker that gets the rider's delete registered (deleting the
 *   rider cascades its assignment)
 * @returns {Promise<{ rider: object, assignment: object }>}
 */
export async function giveEligibleRider(
  db,
  { horseId, userId, rider = {}, assignment = {} },
  cleanupOrIds,
) {
  const created = await db.rider.create({
    data: {
      firstName: 'TestFixture',
      lastName: `Rider-${horseId}`,
      personality: 'gentle',
      userId,
      ...rider,
    },
  });
  if (Array.isArray(cleanupOrIds)) {
    cleanupOrIds.push(created.id);
  } else if (cleanupOrIds && typeof cleanupOrIds.add === 'function') {
    cleanupOrIds.add(
      () => db.rider.deleteMany({ where: { id: created.id } }),
      `rider ${created.id}`,
    );
  }
  const createdAssignment = await db.riderAssignment.create({
    data: { riderId: created.id, horseId, userId, isActive: true, ...assignment },
  });
  return { rider: created, assignment: createdAssignment };
}
