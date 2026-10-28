/**
 * backfillTackRulings.integration.test.mjs (Equoria-cv3if, Equoria-k1p62)
 *
 * The one-off backfill after the owner's tack rulings of 2026-10-23 (q05, q32,
 * q33): scripts/backfill-tack-rulings.mjs rewrites User.settings.inventory and
 * Horse.tack once. Real test database, TestFixture- users and horses scoped by
 * id, fail-loud cleanup.
 *
 * Pins: the four deleted crafted items leave the inventory and the horse's
 * slot; tack that does not score loses its bonus text and is marked comingSoon;
 * a saddle or bridle gets the catalogue's label; the retired saddleBonus and
 * bridleBonus keys leave the horse; unknown records and unrelated settings keys
 * survive; a dry run writes nothing; a second run changes nothing; a failure
 * inside a user's rewrite rolls the whole user back.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../../packages/database/prismaClient.mjs';
import { createTestHorse } from '../../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  backfillTackRulings,
  deletedTackItemIds,
  rewriteHorseTack,
  rewriteInventory,
} from '../../../../scripts/backfill-tack-rulings.mjs';

const uid = () => randomBytes(6).toString('hex');
const cleanup = createCleanupTracker();
const userIds = [];
const horseIds = [];
cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horse');
cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'user');
afterAll(() => cleanup.run(), 60000);

const staleInventory = () => [
  // A saddle sold as multi-discipline: the label changes with the ruling.
  {
    id: 'inv-1',
    itemId: 'western-saddle',
    category: 'saddle',
    name: 'Western Saddle',
    bonus: '+5 in Western Pleasure, Reining, Barrel Racing, Cutting and Roping shows',
    quantity: 1,
    equippedToHorseId: null,
  },
  // Non-scoring shop tack with stale effect text.
  {
    id: 'inv-2',
    itemId: 'show-halter',
    category: 'halter',
    name: 'Show Halter',
    bonus: '+3 conformation score',
    quantity: 1,
  },
  // Non-scoring crafted blanket with stale effect text.
  {
    id: 'inv-3',
    itemId: 'crafted-overlay-saddle-pad',
    category: 'blanket',
    name: 'Artisan Saddle Pad',
    bonus: '+1 dressage score',
    isCosmetic: false,
    quantity: 1,
  },
  // The four deleted crafted items.
  ...deletedTackItemIds.map((itemId, index) => ({
    id: `inv-deleted-${index}`,
    itemId,
    category: index === 0 || index === 1 ? 'bridle' : 'saddle',
    name: itemId,
    bonus: '+2 all disciplines',
    quantity: 1,
  })),
  // A starter saddle already in the right wording, and a record the backfill does not know.
  {
    id: 'inv-starter',
    itemId: 'all-purpose-saddle',
    category: 'saddle',
    name: 'All Purpose Saddle',
    bonus: '+2 all disciplines',
    quantity: 1,
  },
  // The legacy All Purpose bridle id (Equoria-8apf).
  {
    id: 'inv-legacy',
    itemId: 'standard-bridle',
    category: 'bridle',
    name: 'All Purpose Bridle',
    bonus: '+2 all disciplines',
    quantity: 1,
  },
  { id: 'inv-feed', itemId: 'premium-feed', category: 'feed', name: 'Premium Feed', quantity: 3 },
];

async function makeUser(settings) {
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `cv3if-${uid()}@test.local`,
      username: `cv3${uid()}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'Tack',
      lastName: 'Backfill',
      money: 0,
      settings,
    },
  });
  userIds.push(user.id);
  return user;
}

const makeHorse = (ownerId, tack) =>
  createTestHorse(
    prisma,
    {
      name: `TestFixture-cv3if-${uid()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2018-01-01'),
      age: 7,
      userId: ownerId,
      tack,
    },
    horseIds,
  );

const settingsOf = async id => (await prisma.user.findUnique({ where: { id }, select: { settings: true } })).settings;
const tackOf = async id => (await prisma.horse.findUnique({ where: { id }, select: { tack: true } })).tack;

describe('rewriteInventory and rewriteHorseTack (pure)', () => {
  it('drops the four deleted items and rewrites effect fields from the catalogue and recipes', () => {
    const { inventory, removed, relabelled } = rewriteInventory(staleInventory());
    expect(removed).toBe(4);
    expect(relabelled).toBe(4);
    expect(inventory.map(r => r.id)).toEqual(['inv-1', 'inv-2', 'inv-3', 'inv-starter', 'inv-legacy', 'inv-feed']);
    const byId = Object.fromEntries(inventory.map(r => [r.id, r]));
    expect(byId['inv-1'].bonus).toBe('+5 in Western Pleasure shows');
    expect(byId['inv-2']).not.toHaveProperty('bonus');
    expect(byId['inv-2'].comingSoon).toBe(true);
    expect(byId['inv-3']).not.toHaveProperty('bonus');
    expect(byId['inv-3'].comingSoon).toBe(true);
    expect(byId['inv-starter'].bonus).toBe('+2 all disciplines');
    expect(byId['inv-legacy'].itemId).toBe('all-purpose-bridle');
    expect(byId['inv-feed']).toEqual({
      id: 'inv-feed',
      itemId: 'premium-feed',
      category: 'feed',
      name: 'Premium Feed',
      quantity: 3,
    });
  });

  it('removes the retired mirrors and clears slots that name a deleted item', () => {
    const result = rewriteHorseTack({
      saddle: 'crafted-event-saddle',
      bridle: 'dressage-bridle',
      saddleBonus: 7,
      bridleBonus: 5,
      decorations: ['show-ribbon'],
    });
    expect(result).toEqual({
      tack: { bridle: 'dressage-bridle', decorations: ['show-ribbon'] },
      changed: true,
      mirrorsRemoved: 2,
      slotsRewritten: 1,
    });
  });

  it('is a no-op on tack and inventories that are already clean', () => {
    const clean = { saddle: 'dressage-saddle', bridle: 'all-purpose-bridle' };
    expect(rewriteHorseTack(clean)).toEqual({ tack: clean, changed: false, mirrorsRemoved: 0, slotsRewritten: 0 });
    const once = rewriteInventory(staleInventory()).inventory;
    const twice = rewriteInventory(once);
    expect(twice).toEqual({ inventory: once, removed: 0, relabelled: 0 });
    expect(rewriteInventory(undefined)).toEqual({ inventory: [], removed: 0, relabelled: 0 });
  });
});

describe('backfillTackRulings against the real database', () => {
  it('dry run counts the work and writes nothing; the wet run rewrites once; a second run changes nothing', async () => {
    const settings = {
      inventory: staleInventory(),
      lastWeeklyClaimDate: '2026-10-19',
      craftingMaterials: { leather: 2 },
    };
    const user = await makeUser(settings);
    const stale = await makeHorse(user.id, {
      saddle: 'crafted-legacy-tack-set',
      bridle: 'standard-bridle',
      saddleBonus: 7,
      bridleBonus: 2,
    });
    const clean = await makeHorse(user.id, { saddle: 'dressage-saddle' });

    const dry = await backfillTackRulings({ dryRun: true, userIds: [user.id], quiet: true });
    expect(dry).toMatchObject({
      usersScanned: 1,
      usersChanged: 1,
      inventoryRecordsRemoved: 4,
      inventoryRecordsRelabelled: 4,
      horsesChanged: 1,
      mirrorKeysRemoved: 2,
      slotsRewritten: 2,
      failed: 0,
    });
    expect(await settingsOf(user.id)).toEqual(settings);
    expect((await tackOf(stale.id)).saddleBonus).toBe(7);

    const wet = await backfillTackRulings({ userIds: [user.id], quiet: true });
    expect(wet).toEqual(dry);

    const after = await settingsOf(user.id);
    expect(after.inventory.map(r => r.id)).toEqual([
      'inv-1',
      'inv-2',
      'inv-3',
      'inv-starter',
      'inv-legacy',
      'inv-feed',
    ]);
    expect(after.inventory[0].bonus).toBe('+5 in Western Pleasure shows');
    expect(after.inventory[1]).not.toHaveProperty('bonus');
    expect(after.inventory[1].comingSoon).toBe(true);
    // Unrelated settings keys survive.
    expect(after.lastWeeklyClaimDate).toBe('2026-10-19');
    expect(after.craftingMaterials).toEqual({ leather: 2 });
    expect(await tackOf(stale.id)).toEqual({ bridle: 'all-purpose-bridle' });
    expect(await tackOf(clean.id)).toEqual({ saddle: 'dressage-saddle' });

    const again = await backfillTackRulings({ userIds: [user.id], quiet: true });
    expect(again).toMatchObject({
      usersScanned: 1,
      usersChanged: 0,
      inventoryRecordsRemoved: 0,
      inventoryRecordsRelabelled: 0,
      horsesChanged: 0,
      mirrorKeysRemoved: 0,
      slotsRewritten: 0,
      failed: 0,
    });
    expect(await settingsOf(user.id)).toEqual(after);
  });

  it('leaves a user with no inventory, and a horse with no tack, alone', async () => {
    const user = await makeUser({ preferences: { theme: 'night' } });
    const horse = await makeHorse(user.id, {});
    const result = await backfillTackRulings({ userIds: [user.id], quiet: true });
    expect(result).toMatchObject({ usersScanned: 1, usersChanged: 0, horsesChanged: 0, failed: 0 });
    expect(await settingsOf(user.id)).toEqual({ preferences: { theme: 'night' } });
    expect(await tackOf(horse.id)).toEqual({});
  });

  it('rolls a user back as one unit when a horse write fails, and still rewrites the next user', async () => {
    const failingUser = await makeUser({ inventory: staleInventory() });
    const failingHorse = await makeHorse(failingUser.id, { saddle: 'crafted-event-saddle', saddleBonus: 5 });
    const healthyUser = await makeUser({ inventory: staleInventory() });
    const healthyHorse = await makeHorse(healthyUser.id, { bridle: 'crafted-dyed-bridle', bridleBonus: 2 });

    const summary = await backfillTackRulings({
      userIds: [failingUser.id, healthyUser.id],
      quiet: true,
      beforeHorseWrite: async horseId => {
        if (horseId === failingHorse.id) {
          throw new Error('simulated horse write failure');
        }
      },
    });

    expect(summary).toMatchObject({ usersScanned: 2, usersChanged: 1, failed: 1, horsesChanged: 1 });
    // The failing user's inventory rewrite was rolled back with the horse.
    expect((await settingsOf(failingUser.id)).inventory).toEqual(staleInventory());
    expect(await tackOf(failingHorse.id)).toEqual({ saddle: 'crafted-event-saddle', saddleBonus: 5 });
    // The next user was rewritten whole.
    expect((await settingsOf(healthyUser.id)).inventory.map(r => r.itemId)).not.toContain('crafted-dyed-bridle');
    expect(await tackOf(healthyHorse.id)).toEqual({});
  });
});
