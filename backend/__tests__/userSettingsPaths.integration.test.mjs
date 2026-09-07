/**
 * `updateUserSettingsPaths` — real-DB behaviour (Finding 1, Equoria-6p398.1).
 *
 * The helper is the single mechanism every `User.settings` writer now uses, so
 * it needs its own proof that:
 *   - it rewrites ONLY the named top-level keys, leaving every other key (the
 *     weekly-claim marker above all) exactly as the database holds it;
 *   - a compare-and-swap precondition actually rejects a stale caller;
 *   - it reports 0 affected rows instead of throwing, so callers can decide.
 *
 * Real database, scoped fixtures, no mocks.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';

import prisma from '../../packages/database/prismaClient.mjs';
import { updateUserSettingsPaths } from '../utils/userSettingsPaths.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';

const FIXTURE_PREFIX = 'TestFixture-settingsPaths';
const MARKER = '2026-09-06T00:00:00.000Z';

describe('updateUserSettingsPaths', () => {
  const cleanup = createCleanupTracker();
  let userIds;
  let userId;

  beforeEach(async () => {
    userIds = [];
    const tag = randomBytes(6).toString('hex');
    const user = await prisma.user.create({
      data: {
        email: `${FIXTURE_PREFIX}-${tag}@example.com`,
        username: `${FIXTURE_PREFIX}-${tag}`,
        password: 'irrelevant-hash',
        firstName: 'Settings',
        lastName: 'Paths',
        money: 0,
        settings: {
          lastWeeklyClaimDate: MARKER,
          craftingMaterials: { leather: 3, cloth: 2, dye: 1, metal: 4, thread: 5 },
          inventory: [{ id: 'a', quantity: 1 }],
        },
      },
    });
    userId = user.id;
    userIds.push(user.id);
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
  }, 30000);

  afterEach(() => cleanup.run(), 30000);

  const settings = async () => {
    const row = await prisma.user.findUnique({ where: { id: userId }, select: { settings: true } });
    return row.settings;
  };

  it('rewrites only the named keys and leaves every other key untouched', async () => {
    const affected = await updateUserSettingsPaths(prisma, userId, {
      set: { inventory: [{ id: 'a', quantity: 2 }] },
    });

    expect(affected).toBe(1);
    const after = await settings();
    expect(after.inventory).toEqual([{ id: 'a', quantity: 2 }]);
    expect(after.lastWeeklyClaimDate).toBe(MARKER);
    expect(after.craftingMaterials).toEqual({
      leather: 3,
      cloth: 2,
      dye: 1,
      metal: 4,
      thread: 5,
    });
  }, 30000);

  it('creates a key that does not exist yet', async () => {
    const affected = await updateUserSettingsPaths(prisma, userId, {
      set: { milestones: { firstWin: MARKER } },
    });

    expect(affected).toBe(1);
    expect((await settings()).milestones).toEqual({ firstWin: MARKER });
    expect((await settings()).lastWeeklyClaimDate).toBe(MARKER);
  }, 30000);

  it('applies the compare-and-swap when the expected value still holds', async () => {
    const affected = await updateUserSettingsPaths(prisma, userId, {
      set: { inventory: [] },
      expect: { inventory: { equals: [{ id: 'a', quantity: 1 }], whenMissing: [] } },
    });

    expect(affected).toBe(1);
    expect((await settings()).inventory).toEqual([]);
  }, 30000);

  it('affects zero rows when the compare-and-swap no longer holds', async () => {
    // A concurrent writer changed `inventory` after the caller read it.
    await updateUserSettingsPaths(prisma, userId, { set: { inventory: [{ id: 'b' }] } });

    const affected = await updateUserSettingsPaths(prisma, userId, {
      set: { inventory: [{ id: 'a', quantity: 99 }] },
      expect: { inventory: { equals: [{ id: 'a', quantity: 1 }], whenMissing: [] } },
    });

    expect(affected).toBe(0);
    expect((await settings()).inventory).toEqual([{ id: 'b' }]);
  }, 30000);

  it('treats an absent key as `whenMissing` for the compare-and-swap', async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { settings: { lastWeeklyClaimDate: MARKER } },
    });

    const affected = await updateUserSettingsPaths(prisma, userId, {
      set: { inventory: [{ id: 'seeded' }] },
      expect: { inventory: { equals: [], whenMissing: [] } },
    });

    expect(affected).toBe(1);
    const after = await settings();
    expect(after.inventory).toEqual([{ id: 'seeded' }]);
    expect(after.lastWeeklyClaimDate).toBe(MARKER);
  }, 30000);

  it('treats a stored JSON null as `whenMissing` for the compare-and-swap', async () => {
    // `getInventoryFromSettings` and friends normalise a null/primitive
    // `inventory` to `[]`, so a caller's precondition is `[]`. Before the
    // NULLIF hardening, a document holding `"inventory": null` matched neither
    // the stored-null branch nor `[]`, and every guarded write to that row
    // failed forever (a permanent 409).
    await prisma.user.update({
      where: { id: userId },
      data: { settings: { lastWeeklyClaimDate: MARKER, inventory: null } },
    });

    const affected = await updateUserSettingsPaths(prisma, userId, {
      set: { inventory: [{ id: 'recovered' }] },
      expect: { inventory: { equals: [], whenMissing: [] } },
    });

    expect(affected).toBe(1);
    const after = await settings();
    expect(after.inventory).toEqual([{ id: 'recovered' }]);
    expect(after.lastWeeklyClaimDate).toBe(MARKER);
  }, 30000);

  it('affects zero rows for an unknown user instead of throwing', async () => {
    const affected = await updateUserSettingsPaths(prisma, 'no-such-user-id', {
      set: { inventory: [] },
    });
    expect(affected).toBe(0);
  }, 30000);

  it('runs inside an interactive transaction and rolls back with it', async () => {
    await expect(
      prisma.$transaction(async tx => {
        const affected = await updateUserSettingsPaths(tx, userId, {
          set: { inventory: [{ id: 'rolled-back' }] },
        });
        expect(affected).toBe(1);
        throw new Error('dependent write failed');
      }),
    ).rejects.toThrow('dependent write failed');

    expect((await settings()).inventory).toEqual([{ id: 'a', quantity: 1 }]);
  }, 30000);

  it('rejects a settings key that is not a plain identifier', async () => {
    await expect(updateUserSettingsPaths(prisma, userId, { set: { 'inventory"; DROP': 1 } })).rejects.toThrow(
      'unsafe settings key',
    );
  }, 30000);
});
