/**
 * At most four accounts per player (Equoria-x5n89, owner ruling 2026-10-23).
 *
 * The guardrail reads the conduct system's own records: the equoriaDevice cookie
 * hash and the login sightings it already keeps for 90 days. A device that has
 * signed in to four accounts in that time cannot create a fifth. Only the device
 * counts: a shared internet address (a household, a school, a phone network)
 * never blocks a signup on its own.
 *
 * Signups from one device are serialised by a transaction-scoped advisory lock,
 * so two signups racing from a device with three accounts cannot both pass the
 * count. The new account's sighting is written in the same transaction, which is
 * what the next signup counts.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { jobNameToLockKey } from '../../../utils/cronLock.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
import { deviceHashFor, requestIp } from './conductEnforcementService.mjs';
import { loginSightingRetentionMs } from './staffCheckinRetentionService.mjs';

export const accountsPerDeviceLimit = 4;

export const accountLimitRefusal = {
  status: 403,
  body: {
    success: false,
    status: 'error',
    code: 'accountLimitReached',
    message:
      'This device already has four Equoria accounts, which is the most one player may have.',
  },
};

/** The advisory-lock key every signup from this device takes. */
export const signupDeviceLockKey = deviceHash => jobNameToLockKey(`signupDevice:${deviceHash}`);

/**
 * Claim a signup slot on this device inside `tx`. Takes the device's signup lock
 * (held until the transaction ends), then counts the accounts seen on the device
 * within the sighting retention window.
 * MUST be the first statement of the transaction.
 * @param {object} tx Prisma transaction client
 * @param {string} deviceHash
 * @param {Date} [now]
 * @returns {Promise<boolean>} true when another account may be created here
 */
export async function claimSignupSlotTx(tx, deviceHash, now = new Date()) {
  // $executeRaw: pg_advisory_xact_lock returns void, which $queryRaw cannot read.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${signupDeviceLockKey(deviceHash)}::bigint)`;
  const seen = await tx.loginSighting.findMany({
    where: {
      deviceHash,
      lastSeenAt: { gte: new Date(now.getTime() - loginSightingRetentionMs) },
    },
    distinct: ['userId'],
    select: { userId: true },
  });
  return seen.length < accountsPerDeviceLimit;
}

/**
 * Create an account through `createUser(tx)` only when this device has room, and
 * record the new account's sighting in the same transaction.
 * @param {object} req
 * @param {object} res
 * @param {(tx: object) => Promise<{ id: string }>} createUser
 * @returns {Promise<object|null>} the created user, or null when the device is full
 */
export async function createAccountWithinDeviceLimit(req, res, createUser) {
  const deviceHash = deviceHashFor(req, res);
  const ipAddress = requestIp(req);
  return withRetryableTxMapping(
    prisma.$transaction(async tx => {
      if (!(await claimSignupSlotTx(tx, deviceHash))) {
        return null;
      }
      const user = await createUser(tx);
      await tx.loginSighting.create({ data: { userId: user.id, ipAddress, deviceHash } });
      return user;
    }),
  );
}
