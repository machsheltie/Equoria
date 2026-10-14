/**
 * Staff check-in retention (STAFF-CR-18) — real DB.
 *
 * Codes are deleted 1 day after they were used or expired; trusted devices 30
 * days after they expired or were revoked. Every boundary is checked from
 * both sides with a fixed clock, then the purge is rerun to prove it is
 * idempotent, and the nightly job is run through the cron registry.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import cronJobService from '../../../services/cronJobs.mjs';
import { CRON_JOB_REGISTRY } from '../../../services/jobs/index.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  CHECKIN_CODE_RETENTION_MS,
  TRUSTED_DEVICE_RETENTION_MS,
  purgeStaleStaffCheckinRecords,
} from '../services/staffCheckinRetentionService.mjs';
import { createUserFactory, uid } from './helpers/staffFixtures.mjs';

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('stretain');

beforeAll(() => {
  const scope = () => ({ in: createdUserIds });
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');
});

afterAll(() => cleanup.run(), 60_000);

const MINUTE = 60 * 1000;
const at = (now, offsetMs) => new Date(now.getTime() + offsetMs);

async function code(userId, { createdAt, expiresAt, usedAt = null }) {
  const row = await prisma.staffCheckinCode.create({
    data: { userId, codeHash: 'not-a-hash', createdAt, expiresAt, usedAt },
  });
  return row.id;
}

async function device(userId, { createdAt, expiresAt, revokedAt = null }) {
  const row = await prisma.staffTrustedDevice.create({
    data: { userId, tokenHash: `retention-${uid()}${uid()}`, createdAt, expiresAt, revokedAt },
  });
  return row.id;
}

const remainingCodes = ids =>
  prisma.staffCheckinCode
    .findMany({ where: { id: { in: ids } }, select: { id: true } })
    .then(r => r.map(x => x.id).sort());
const remainingDevices = ids =>
  prisma.staffTrustedDevice
    .findMany({ where: { id: { in: ids } }, select: { id: true } })
    .then(r => r.map(x => x.id).sort());

describe('Staff check-in retention (STAFF-CR-18)', () => {
  it('deletes codes 1 day after use or expiry and devices 30 days after expiry or revocation, and nothing sooner', async () => {
    const mod = await makeUser('moderator');
    const now = new Date();
    const codeEdge = -CHECKIN_CODE_RETENTION_MS;
    const deviceEdge = -TRUSTED_DEVICE_RETENTION_MS;
    const old = at(now, deviceEdge - 60 * MINUTE);

    const codes = {
      usedPastDay: await code(mod.id, {
        createdAt: old,
        expiresAt: at(now, codeEdge + 5 * MINUTE),
        usedAt: at(now, codeEdge - 1),
      }),
      usedWithinDay: await code(mod.id, {
        createdAt: old,
        expiresAt: at(now, codeEdge + 5 * MINUTE),
        usedAt: at(now, codeEdge + 1),
      }),
      expiredPastDay: await code(mod.id, { createdAt: old, expiresAt: at(now, codeEdge - 1) }),
      expiredExactlyADay: await code(mod.id, { createdAt: old, expiresAt: at(now, codeEdge) }),
      expiredWithinDay: await code(mod.id, { createdAt: old, expiresAt: at(now, codeEdge + 1) }),
      live: await code(mod.id, { createdAt: at(now, -MINUTE), expiresAt: at(now, 9 * MINUTE) }),
    };
    const devices = {
      revokedPast30: await device(mod.id, {
        createdAt: old,
        expiresAt: at(now, 20 * MINUTE),
        revokedAt: at(now, deviceEdge - 1),
      }),
      revokedWithin30: await device(mod.id, {
        createdAt: old,
        expiresAt: at(now, 20 * MINUTE),
        revokedAt: at(now, deviceEdge + 1),
      }),
      expiredPast30: await device(mod.id, { createdAt: old, expiresAt: at(now, deviceEdge - 1) }),
      expiredExactly30: await device(mod.id, { createdAt: old, expiresAt: at(now, deviceEdge) }),
      expiredWithin30: await device(mod.id, { createdAt: old, expiresAt: at(now, deviceEdge + 1) }),
      active: await device(mod.id, { createdAt: at(now, -MINUTE), expiresAt: at(now, 29 * 24 * 60 * MINUTE) }),
    };

    const first = await purgeStaleStaffCheckinRecords(now);
    expect(first.codesDeleted).toBeGreaterThanOrEqual(2);
    expect(first.devicesDeleted).toBeGreaterThanOrEqual(2);
    expect(first.codeCutoff).toBe(at(now, codeEdge).toISOString());
    expect(first.deviceCutoff).toBe(at(now, deviceEdge).toISOString());

    expect(await remainingCodes(Object.values(codes))).toEqual(
      [codes.usedWithinDay, codes.expiredExactlyADay, codes.expiredWithinDay, codes.live].sort(),
    );
    expect(await remainingDevices(Object.values(devices))).toEqual(
      [devices.revokedWithin30, devices.expiredExactly30, devices.expiredWithin30, devices.active].sort(),
    );

    // Idempotent: the same clock finds nothing more to delete.
    expect(await purgeStaleStaffCheckinRecords(now)).toMatchObject({ codesDeleted: 0, devicesDeleted: 0 });

    // One millisecond later the exact-boundary rows are past their window.
    await purgeStaleStaffCheckinRecords(at(now, 1));
    expect(await remainingCodes(Object.values(codes))).toEqual(
      [codes.usedWithinDay, codes.expiredWithinDay, codes.live].sort(),
    );
    expect(await remainingDevices(Object.values(devices))).toEqual(
      [devices.revokedWithin30, devices.expiredWithin30, devices.active].sort(),
    );
  });

  it('runs nightly at 03:50 through the cron registry and purges stale rows', async () => {
    const job = CRON_JOB_REGISTRY.find(j => j.jobName === 'staffCheckinRetention');
    expect(job).toMatchObject({ schedule: '50 3 * * *', applyLock: true });

    const mod = await makeUser('moderator');
    const now = Date.now();
    const stale = await code(mod.id, {
      createdAt: new Date(now - 3 * CHECKIN_CODE_RETENTION_MS),
      expiresAt: new Date(now - 2 * CHECKIN_CODE_RETENTION_MS),
    });
    const staleDevice = await device(mod.id, {
      createdAt: new Date(now - 2 * TRUSTED_DEVICE_RETENTION_MS),
      expiresAt: new Date(now - TRUSTED_DEVICE_RETENTION_MS - MINUTE),
    });

    const summary = await job.run(cronJobService);
    expect(summary.codesDeleted).toBeGreaterThanOrEqual(1);
    expect(summary.devicesDeleted).toBeGreaterThanOrEqual(1);
    expect(await remainingCodes([stale])).toEqual([]);
    expect(await remainingDevices([staleDevice])).toEqual([]);
  });
});
