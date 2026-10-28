/**
 * Tack and feed items carry their category's word beside the code (Equoria-no441).
 *
 * Owner rulings 2026-10-28 q164/q165: the data a player receives carries names,
 * not stored codes. The tack shop catalogue, the player's inventory and a
 * horse's equippable list sent each item's category as its stored code
 * (saddle_pad); only the shop sent a group-heading map. The code stays (the
 * screens group and route by it) and every item now carries categoryLabel.
 *
 * Real app, real DB.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../../app.mjs';
import prisma from '../../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../../tests/helpers/authHelper.mjs';
import { fixtureColor } from '../../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../../../utils/gameTime.mjs';
import { allTackItems } from '../../index.mjs';

// The stored code the catalogue gives a saddle pad (a two-word category).
const padCategory = allTackItems().find(item => item.id === 'basic-saddle-pad').category;

const fixturePrefix = 'TestFixture-no441-tack';
const record = (id, itemId, category) => ({
  id,
  itemId,
  category,
  name: itemId,
  bonus: null,
  quantity: 1,
  equippedToHorseId: null,
});

describe('tack and feed items carry their category word', () => {
  const cleanup = createCleanupTracker();
  const run = randomBytes(6).toString('hex');
  let user;
  let token;
  let horse;

  beforeAll(async () => {
    cleanup.add(() => (horse ? prisma.horse.deleteMany({ where: { id: horse.id } }) : null), 'horse');
    cleanup.add(() => (user ? prisma.user.deleteMany({ where: { id: user.id } }) : null), 'user');
    user = await prisma.user.create({
      data: {
        emailVerified: true,
        username: `${fixturePrefix}-${run}`.slice(0, 30),
        email: `${fixturePrefix}-${run}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Tack',
        lastName: 'Words',
        money: 1000,
        settings: {
          inventory: [
            record(`inv-${run}-pad`, 'basic-saddle-pad', padCategory),
            { ...record(`inv-${run}-feed`, 'basic', 'feed'), quantity: 3 },
          ],
        },
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${fixturePrefix}-${run}`,
        sex: 'Mare',
        dateOfBirth: gameCalendarDate(new Date(), -6 * 365),
        age: 6,
        userId: user.id,
      },
    });
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  const get = path => request(app).get(path).set('Authorization', `Bearer ${token}`);

  it('the tack shop catalogue names every item category', async () => {
    const res = await get('/api/v1/tack-shop/inventory');
    expect(res.status).toBe(200);
    const pad = res.body.data.items.find(item => item.id === 'basic-saddle-pad');
    expect(pad.categoryLabel).toBe('Saddle Pad');
    for (const item of res.body.data.items) {
      expect({
        id: item.id,
        labelled: typeof item.categoryLabel === 'string' && item.categoryLabel !== 'Tack',
      }).toEqual({
        id: item.id,
        labelled: true,
      });
    }
  });

  it("the player's inventory names each item's category", async () => {
    const res = await get('/api/v1/inventory');
    expect(res.status).toBe(200);
    const byId = Object.fromEntries(res.body.data.items.map(item => [item.id, item.categoryLabel]));
    expect(byId).toEqual({ [`inv-${run}-pad`]: 'Saddle Pad', [`inv-${run}-feed`]: 'Feed' });
  });

  it("a horse's equippable tack names its category", async () => {
    const res = await get(`/api/v1/horses/${horse.id}/equippable`);
    expect(res.status).toBe(200);
    expect(res.body.data.tack.map(item => [item.id, item.categoryLabel])).toEqual([[`inv-${run}-pad`, 'Saddle Pad']]);
  });
});
