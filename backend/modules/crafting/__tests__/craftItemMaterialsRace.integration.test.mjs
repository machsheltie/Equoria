/**
 * Crafting materials race (Equoria-cmvmy, child of Equoria-8sag0).
 *
 * Defect class: craftItem computes the materials deduction and the new
 * inventory from a `User.settings` snapshot read BEFORE its transaction. Two
 * crafts that both read the snapshot before either commits each pass the
 * materials check and, without a guard, each persist a crafted item — two
 * items for one material spend.
 *
 * The interleaving is forced with a real row lock (rowLockBarrier): the test
 * holds the fixture user's row, so both crafts read the pre-craft settings and
 * then queue on the debit's User-row UPDATE. Releasing lets them commit one
 * after the other on a stale read — the exact audited ordering. Real routes,
 * real auth + CSRF, real DB; nothing is stubbed.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  createBarrierClient,
  openRowLockBarrier,
  waitForBlockedSessions,
} from '../../../__tests__/helpers/rowLockBarrier.mjs';
import { CRAFTING_RECIPES } from '../data/craftingRecipes.mjs';

const ORIGIN = 'http://localhost:3000';
const FIXTURE_PREFIX = 'TestFixture-cmvmy-craft';
const RECIPE = CRAFTING_RECIPES.find(r => r.id === 'basic-halter');

const barrierClient = createBarrierClient();

async function craft(jwt) {
  const c = await fetchCsrf(app, { origin: ORIGIN, extraCookies: [`accessToken=${jwt}`] });
  return request(app)
    .post('/api/v1/crafting/craft')
    .set('Authorization', `Bearer ${jwt}`)
    .set('Origin', ORIGIN)
    .set('Cookie', c.cookieHeader)
    .set('X-CSRF-Token', c.csrfToken)
    .send({ recipeId: RECIPE.id });
}

describe('craftItem — one material spend can never yield two crafted items (Equoria-cmvmy)', () => {
  const cleanup = createCleanupTracker();
  let user;
  let token;

  beforeEach(async () => {
    const tag = randomBytes(6).toString('hex');
    user = await prisma.user.create({
      data: {
        email: `${FIXTURE_PREFIX}-${tag}@example.com`,
        username: `${FIXTURE_PREFIX}-${tag}`,
        password: 'irrelevant-hash',
        firstName: 'Craft',
        lastName: 'Materials',
        money: RECIPE.cost * 10,
        // Leather for exactly ONE halter; coins for ten.
        settings: {
          craftingMaterials: { leather: 1, cloth: 0, dye: 0, metal: 0, thread: 0 },
          inventory: [],
        },
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    const userId = user.id;
    cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId } }), 'ledger');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: userId } }), 'user');
  }, 60000);

  afterEach(() => cleanup.run(), 60000);
  afterAll(() => barrierClient.$disconnect());

  it('two crafts that both read the pre-craft materials produce exactly one item', async () => {
    const barrier = await openRowLockBarrier(
      barrierClient,
      tx => tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`,
    );
    let first;
    let second;
    try {
      first = craft(token).then(r => r);
      await waitForBlockedSessions(barrierClient, barrier.pid, 1);
      second = craft(token).then(r => r);
      await waitForBlockedSessions(barrierClient, barrier.pid, 2);
    } finally {
      await barrier.release();
    }
    const responses = await Promise.all([first, second]);

    const ok = responses.filter(r => r.status === 200);
    expect(ok).toHaveLength(1);
    const loser = responses.find(r => r.status !== 200);
    // The loser re-reads the materials under the User row lock and is told the
    // truth: the leather is gone. Not a 500, not a retry-me 409.
    expect(loser.status).toBe(400);
    expect(loser.body).toMatchObject({ success: false, message: 'Insufficient materials: need 1 leather' });

    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true, settings: true },
    });
    const crafted = (row.settings.inventory ?? []).filter(i => i.itemId === RECIPE.result);
    expect(crafted).toHaveLength(1);
    expect(row.settings.craftingMaterials.leather).toBe(0);
    // Coins: charged once, for the one item that exists.
    expect(Number(row.money)).toBe(RECIPE.cost * 9);
    const debits = await prisma.userTransaction.count({
      where: { userId: user.id, category: 'crafting' },
    });
    expect(debits).toBe(1);
  }, 60000);
});
