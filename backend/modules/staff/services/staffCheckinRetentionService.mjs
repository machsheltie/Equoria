/**
 * Staff check-in retention (STAFF-CR-18).
 *
 * Check-in codes and trusted-device rows are short-lived secrets (a bcrypt
 * code hash, a sha256 device-token hash). Once dead they have no use, so they
 * are deleted; the permanent record of each check-in is its StaffActionLog
 * entry, which is never purged.
 *
 * Rule (docs/features/staff-foundation.md, "Staff check-in (2FA)"):
 * - a check-in code is deleted 1 day after it was used or expired (a code
 *   retired by a newer code or a security change is expired at that moment);
 * - a trusted device is deleted 30 days after it expired or was revoked.
 *
 * Fixed windows, not env-tunable: they are part of the security contract.
 * Each delete is scoped by an indexed timestamp and strictly older than its
 * cutoff, so a rerun with the same clock deletes nothing more (idempotent).
 * Runs nightly through the cron registry (jobs/staffCheckinRetentionJob.mjs).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';

export const CHECKIN_CODE_RETENTION_MS = 24 * 60 * 60 * 1000;
export const TRUSTED_DEVICE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * @param {Date} [now]
 * @returns {Promise<{ codesDeleted: number, devicesDeleted: number,
 *   codeCutoff: string, deviceCutoff: string }>}
 */
export async function purgeStaleStaffCheckinRecords(now = new Date()) {
  const codeCutoff = new Date(now.getTime() - CHECKIN_CODE_RETENTION_MS);
  const deviceCutoff = new Date(now.getTime() - TRUSTED_DEVICE_RETENTION_MS);

  const codes = await prisma.staffCheckinCode.deleteMany({
    where: { OR: [{ usedAt: { lt: codeCutoff } }, { expiresAt: { lt: codeCutoff } }] },
  });
  const devices = await prisma.staffTrustedDevice.deleteMany({
    where: { OR: [{ revokedAt: { lt: deviceCutoff } }, { expiresAt: { lt: deviceCutoff } }] },
  });

  return {
    codesDeleted: codes.count,
    devicesDeleted: devices.count,
    codeCutoff: codeCutoff.toISOString(),
    deviceCutoff: deviceCutoff.toISOString(),
  };
}
