/**
 * A revealed trait glows once, the first time its owner views it (Equoria-lylhb;
 * owner rulings 2026-10-16 and 2026-10-19).
 *
 * GET /traits/horse/:id marks each visible trait `isNew` until the owner's
 * "seen" marker (private, in User.settings) covers it; POST
 * /traits/horse/:id/seen writes that marker. Hidden traits stay unnamed
 * everywhere: they are never marked, never sent.
 *
 * Real routes, real app, real test database.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';

const HIDDEN = ['legendaryBloodline'];

describe('first-view glow marker (Equoria-lylhb)', () => {
  const tag = () => randomBytes(4).toString('hex');
  let owner;
  let ownerToken;
  let ownerCsrf;
  let stranger;
  let strangerToken;
  let strangerCsrf;
  let breed;
  let horse;

  const get = (path, token = ownerToken) => request(app).get(path).set('Authorization', `Bearer ${token}`);
  const post = (path, token = ownerToken, csrf = ownerCsrf) =>
    request(app)
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});
  const traitsOf = res => [...res.body.data.traits.positive, ...res.body.data.traits.negative];

  beforeAll(async () => {
    const a = await createTestUser({ role: 'user' });
    owner = a.user;
    ownerToken = a.token;
    ownerCsrf = await fetchCsrf(app, { extraCookies: [`accessToken=${ownerToken}`] });
    const b = await createTestUser({ role: 'user' });
    stranger = b.user;
    strangerToken = b.token;
    strangerCsrf = await fetchCsrf(app, { extraCookies: [`accessToken=${strangerToken}`] });
    breed = await prisma.breed.create({ data: { name: `GlowBreed ${tag()}_${tag()}` } });
    horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `GlowFoal ${tag()}`,
        sex: 'filly',
        dateOfBirth: gameCalendarDate(new Date(), -3),
        breed: { connect: { id: breed.id } },
        user: { connect: { id: owner.id } },
        epigeneticModifiers: { positive: ['resilient'], negative: [], hidden: HIDDEN },
      },
    });
  });

  afterAll(async () => {
    const cleanup = createCleanupTracker();
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: owner.id } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: [owner.id, stranger.id] } } }), 'users');
    cleanup.add(() => prisma.breed.deleteMany({ where: { id: breed.id } }), 'breed');
    await cleanup.run();
  });

  it('marks a visible trait new until the owner has seen it, then never again', async () => {
    const first = await get(`/api/v1/traits/horse/${horse.id}`);
    expect(first.status).toBe(200);
    expect(traitsOf(first).map(t => [t.name, t.isNew])).toEqual([['resilient', true]]);

    const seen = await post(`/api/v1/traits/horse/${horse.id}/seen`);
    expect(seen.status).toBe(200);

    const second = await get(`/api/v1/traits/horse/${horse.id}`);
    expect(traitsOf(second).map(t => [t.name, t.isNew])).toEqual([['resilient', false]]);
  });

  it('never names or records a hidden trait', async () => {
    const res = await post(`/api/v1/traits/horse/${horse.id}/seen`);
    expect(JSON.stringify(res.body)).not.toContain(HIDDEN[0]);
    const row = await prisma.user.findUnique({
      where: { id: owner.id },
      select: { settings: true },
    });
    expect(JSON.stringify(row.settings)).not.toContain(HIDDEN[0]);
  });

  it('a trait revealed later glows once while the earlier one stays quiet', async () => {
    await prisma.horse.update({
      where: { id: horse.id },
      data: {
        epigeneticModifiers: { positive: ['resilient', 'confident'], negative: [], hidden: [] },
      },
    });
    const before = await get(`/api/v1/traits/horse/${horse.id}`);
    const flags = Object.fromEntries(traitsOf(before).map(t => [t.name, t.isNew]));
    expect(flags).toEqual({ resilient: false, confident: true });
  });

  it('the marker belongs to the viewer: another player cannot mark this horse seen', async () => {
    const res = await post(`/api/v1/traits/horse/${horse.id}/seen`, strangerToken, strangerCsrf);
    expect([403, 404]).toContain(res.status);
  });
});
