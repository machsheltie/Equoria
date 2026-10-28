/**
 * Equoria-bvddn.7 — players never create grooms.
 *
 * OWNER RULING (2026-10-21): trainers, riders and grooms are game-generated NPCs.
 * POST /api/v1/grooms/hire contradicted that: it built a brand-new groom from a
 * player's chosen name, speciality, skill level and experience (1-20, at no extra
 * cost). The frontend never used it; players hire the game's grooms through
 * POST /api/v1/groom-marketplace/hire. The player-built door is unmounted, so it
 * answers 404 to a signed-in player and writes nothing.
 *
 * Real DB, real HTTP, real auth, real CSRF. One scoped user, removed fail-loud.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const fixturePrefix = 'TestFixture-bvddn7-groom';
// Above the dearest marketplace offer (master tier, top experience: 90/session,
// one week upfront = 630), so the marketplace hire is never refused for money.
const startingMoney = 10000;

describe('Equoria-bvddn.7 — the player-built groom hire is retired', () => {
  const cleanup = createCleanupTracker();
  let user;
  let token;
  let csrf;

  beforeAll(async () => {
    const suffix = randomBytes(6).toString('hex');
    user = await prisma.user.create({
      data: {
        username: `${fixturePrefix}-${suffix}`,
        email: `${fixturePrefix}-${suffix}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Bvddn7',
        lastName: 'Hire',
        money: startingMoney,
        settings: {},
      },
    });
    cleanup.add(() => prisma.groomEngagement.deleteMany({ where: { userId: user.id } }), 'engagements');
    cleanup.add(() => prisma.groom.deleteMany({ where: { userId: user.id } }), 'grooms');
    cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: user.id } }), 'ledger rows');
    cleanup.add(() => prisma.staffMarketplaceState.deleteMany({ where: { userId: user.id } }), 'marketplace state');
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: [`accessToken=${token}`] });
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  const authed = req =>
    req
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

  it('POST /grooms/hire answers 404 to a signed-in player and creates no groom or charge', async () => {
    const res = await authed(request(app).post('/api/v1/grooms/hire')).send({
      name: `${fixturePrefix}-built-${randomBytes(3).toString('hex')}`,
      speciality: 'foalCare',
      skill_level: 'master',
      personality: 'gentle',
      experience: 20,
    });

    expect(res.status).toBe(404);
    expect(await prisma.groom.count({ where: { userId: user.id } })).toBe(0);
    const after = await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } });
    expect(Number(after.money)).toBe(startingMoney);
  });

  it('the marketplace hire still hires one of the game-generated grooms', async () => {
    const market = await authed(request(app).get('/api/v1/groom-marketplace'));
    expect(market.status).toBe(200);
    const [offer] = market.body.data.grooms;
    expect(offer).toBeDefined();

    const res = await authed(request(app).post('/api/v1/groom-marketplace/hire')).send({
      marketplaceId: offer.marketplaceId,
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const groom = await prisma.groom.findUnique({
      where: { id: res.body.data.groom.id },
      select: { userId: true, name: true, experience: true },
    });
    expect(groom.userId).toBe(user.id);
    // The groom is the offered one, not anything the player described.
    expect(groom.name).toBe(`${offer.firstName} ${offer.lastName}`);
    expect(groom.experience).toBe(offer.experience);
  }, 30000);
});
