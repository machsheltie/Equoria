/**
 * Login sighting retention (Equoria-w47x7, owner ruling q102) — real DB.
 *
 * Login IP and device records are kept 90 days, counted from the last time the
 * account signed in from that address and device, and cleared nightly. Each
 * boundary is checked from both sides with a fixed clock, then the purge is
 * rerun to prove it is idempotent, and the nightly job is run through the
 * cron registry.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import cronJobService from '../../../services/cronJobs.mjs';
import retentionJob from '../../../services/jobs/staffCheckinRetentionJob.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { loginSightingRetentionMs, purgeStaleStaffCheckinRecords } from '../services/staffCheckinRetentionService.mjs';
import { createUserFactory, uid } from './helpers/staffFixtures.mjs';

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('sightret');

beforeAll(() => {
  // Sightings go with their users (ON DELETE CASCADE).
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }), 'users');
});

afterAll(() => cleanup.run(), 60_000);

const at = (now, offsetMs) => new Date(now.getTime() + offsetMs);
const sighting = (userId, lastSeenAt) =>
  prisma.loginSighting
    .create({
      data: { userId, ipAddress: '198.51.100.7', deviceHash: `${uid()}${uid()}`, firstSeenAt: lastSeenAt, lastSeenAt },
    })
    .then(row => row.id);
const remaining = ids =>
  prisma.loginSighting
    .findMany({ where: { id: { in: ids } }, select: { id: true } })
    .then(rows => rows.map(r => r.id).sort());

describe('Login sighting retention (q102)', () => {
  it('keeps the window at 90 days', () => {
    expect(loginSightingRetentionMs).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it('deletes sightings last seen more than 90 days ago and nothing sooner, idempotently', async () => {
    const player = await makeUser('user');
    const now = new Date();
    const edge = -loginSightingRetentionMs;
    const ids = {
      past: await sighting(player.id, at(now, edge - 1)),
      exactly: await sighting(player.id, at(now, edge)),
      within: await sighting(player.id, at(now, edge + 1)),
      recent: await sighting(player.id, now),
    };

    const first = await purgeStaleStaffCheckinRecords(now);
    expect(first.sightingsDeleted).toBeGreaterThanOrEqual(1);
    expect(await remaining(Object.values(ids))).toEqual([ids.exactly, ids.within, ids.recent].sort());
    expect(await purgeStaleStaffCheckinRecords(now)).toMatchObject({ sightingsDeleted: 0 });

    // One millisecond later the exact-edge row is past the window too.
    await purgeStaleStaffCheckinRecords(at(now, 1));
    expect(await remaining(Object.values(ids))).toEqual([ids.within, ids.recent].sort());
  });

  it('is cleared by the nightly job through the cron registry', async () => {
    const player = await makeUser('user');
    const stale = await sighting(player.id, new Date(Date.now() - loginSightingRetentionMs - 60_000));
    const summary = await retentionJob.run(cronJobService);
    expect(summary.sightingsDeleted).toBeGreaterThanOrEqual(1);
    expect(await remaining([stale])).toEqual([]);
  });
});
