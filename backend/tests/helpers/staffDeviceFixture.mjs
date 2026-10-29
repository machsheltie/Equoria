/**
 * A checked-in browser for an existing staff account (Equoria-n256i).
 *
 * Since owner ruling q289 every admin route also needs the emailed staff
 * check-in. Suites whose subject is an admin tool, not the check-in, use this
 * to hold a valid trusted-device row exactly as POST /api/v1/staff/checkin/verify
 * leaves one (only the sha256 of the raw token stored, 30 days), so the real
 * requireStaffCheckin guard reads a real record. The check-in flow itself is
 * proven over HTTP in modules/staff/__tests__/staffCheckinMfa*.integration.test.mjs
 * and __tests__/integration/security/adminRoutesCheckinRequired.integration.test.mjs.
 *
 * Device rows cascade when their user row is deleted.
 */

import crypto from 'node:crypto';
import prisma from '../../../packages/database/prismaClient.mjs';
import {
  hashDeviceToken,
  staffDeviceCookie,
  trustedDeviceTtlMs,
} from '../../modules/staff/services/staffCheckinService.mjs';

/**
 * Create a trusted device for `userId` and return its Cookie header pair
 * (`staff_device=<raw>`).
 * @param {string} userId
 * @returns {Promise<string>}
 */
export async function checkedInDeviceCookie(userId) {
  const rawToken = crypto.randomBytes(32).toString('base64url');
  await prisma.staffTrustedDevice.create({
    data: {
      userId,
      tokenHash: hashDeviceToken(rawToken),
      expiresAt: new Date(Date.now() + trustedDeviceTtlMs),
    },
  });
  return `${staffDeviceCookie}=${rawToken}`;
}
