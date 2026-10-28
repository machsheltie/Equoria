/**
 * A Horse Trader horse arrives in Excellent health and fully fed (Equoria-fd3f2).
 *
 * OWNER RULING 2026-10-28: at the moment of purchase from the Horse Trader, a
 * store horse is in Excellent health and fully fed. Old contract: the store
 * horse arrived unvetted (lastVettedDate cleared to null) and never fed, so
 * its vet health and hunger both read Bad and the hub told the player to take
 * a horse they had just bought to the vet and feed it.
 *
 * Buys through the real POST /api/v1/marketplace/store/buy route, then reads
 * the horse back through GET /api/v1/horses/:id (the derived health the horse
 * page shows) and GET /api/v1/next-actions (the care suggestions).
 *
 * Real app, real DB, no mocks. Cleanup is scoped to the rows this file creates.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { alreadyFedToday } from '../../../utils/horseHealth.mjs';

const ORIGIN = 'http://localhost:3000';

describe('POST /marketplace/store/buy: the horse arrives Excellent and fed (Equoria-fd3f2)', () => {
  const cleanup = createCleanupTracker();
  const createdHorseIds = [];
  let user;
  let token;
  let horseId;

  beforeAll(async () => {
    const breed = await prisma.breed.findUnique({ where: { name: 'Morgan USA' }, select: { id: true } });
    if (!breed) {
      throw new Error('Seeded breed "Morgan USA" is missing; run npm run seed:breeds.');
    }
    const tag = randomBytes(6).toString('hex');
    user = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `fd3f2-${tag}@test.com`,
        username: `fd3f2${tag}`,
        password: 'irrelevant-hash',
        firstName: 'Store',
        lastName: 'Arrival',
        money: 5000,
        settings: {},
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    const userId = user.id;
    // FK order: horses before their owner (Horse.userId is onDelete: Restrict).
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: userId } }), 'user');

    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/marketplace/store/buy')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ breedId: breed.id, sex: 'Mare' });
    expect(res.status).toBe(201);
    horseId = res.body.data.horse.id;
    createdHorseIds.push(horseId);
  }, 60000);

  afterAll(() => cleanup.run(), 30000);

  it('reads Excellent vet health, Excellent hunger and Excellent displayed health', async () => {
    const res = await request(app).get(`/api/v1/horses/${horseId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      vetHealth: 'Excellent',
      feedHealth: 'Excellent',
      displayedHealth: 'Excellent',
    });
  });

  it('has had today’s feeding: it is fully fed, not merely unfed-but-new', async () => {
    const stored = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { lastFedDate: true, lastVettedDate: true, healthStatus: true },
    });
    expect(stored.healthStatus).toBe('Excellent');
    expect(stored.lastVettedDate).not.toBeNull();
    expect(alreadyFedToday(stored.lastFedDate)).toBe(true);
  });

  it('is not suggested for a vet visit or a feeding', async () => {
    const res = await request(app).get('/api/v1/next-actions').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const careForThisHorse = res.body.data.actions.filter(
      a => a.horseId === horseId && (a.type === 'visit-vet' || a.type === 'feed'),
    );
    expect(careForThisHorse).toEqual([]);
  });
});
