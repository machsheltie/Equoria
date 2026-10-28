/**
 * Retire outstanding staff check-in codes (STAFF-CR-01).
 *
 * A check-in code is bound to the account's security state at the moment it
 * was issued. Every path that changes that state — password change, password
 * reset, a verified-email change, promotion and demotion — calls this inside
 * its own transaction, so an earlier code can never finish a check-in after
 * the change commits.
 *
 * A retired code carries `retiredAt`, and check-in refuses any code that has
 * it, whatever the clock says (owner ruling q261, Equoria-8pzlg: a password or
 * email change cancels every code sent before it). Every unused code is
 * retired, expired or not, so a server clock set back can never revive one.
 * It is also marked expired (expiresAt = now) so the retention job deletes it
 * on the same schedule as any other expired code; `usedAt` stays the record of
 * a code that actually completed a check-in.
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
    where: { userId, usedAt: null, retiredAt: null },
    data: { retiredAt: now, expiresAt: now },
  });
  return count;
}

/**
 * Revoke the account's trusted staff devices (q261, Equoria-8pzlg). A password
 * change, a password reset and a verified-email change call this beside
 * retireStaffCheckinCodesTx: a device checked in before the change already
 * fails the passwordChangedAt comparison, and revoking it records that
 * durably, so a server clock set back cannot bring it back either.
 * Same lock order: after the transaction's User row write.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {string} userId
 * @param {Date} [now]
 * @returns {Promise<number>} how many devices were revoked
 */
export async function revokeStaffTrustedDevicesTx(tx, userId, now = new Date()) {
  const { count } = await tx.staffTrustedDevice.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now },
  });
  return count;
}
