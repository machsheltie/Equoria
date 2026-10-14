/**
 * Retire outstanding staff check-in codes (STAFF-CR-01).
 *
 * A check-in code is bound to the account's security state at the moment it
 * was issued. Every path that changes that state — password change, password
 * reset, a verified-email change, promotion and demotion — calls this inside
 * its own transaction, so an earlier code can never finish a check-in after
 * the change commits.
 *
 * A retired code is marked expired (expiresAt = now), not used: `usedAt` stays
 * the record of a code that actually completed a check-in. The retention job
 * deletes retired codes on the same schedule as any other expired code.
 *
 * LOCK ORDER: call this AFTER the transaction's User row write. Check-in takes
 * the User row (`SELECT … FOR UPDATE`) before it touches a code row, so every
 * transaction that writes both must take User first, then codes.
 *
 * Leaf module: Prisma transaction client in, no other imports, so the auth
 * module can reach it through the staff barrel without an import cycle.
 */

/**
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {string} userId
 * @param {Date} [now]
 * @returns {Promise<number>} how many live codes were retired
 */
export async function retireStaffCheckinCodesTx(tx, userId, now = new Date()) {
  const { count } = await tx.staffCheckinCode.updateMany({
    where: { userId, usedAt: null, expiresAt: { gt: now } },
    data: { expiresAt: now },
  });
  return count;
}
