/**
 * Groom growth (Equoria-xlw03) — owner rulings 2026-10-28 (q160, q177, q244).
 *
 *   - A hired groom is a Rookie with 12 hidden items (4 traits, 4 disciplines and 2
 *     temperaments, each + or -, and 2 favourite breeds); its profile shows its
 *     personality and nothing else.
 *   - (The conformation show count is tested beside the settlement:
 *     modules/competition/__tests__/conformationGroomGrowth.integration.test.mjs.)
 *   - An unpaid groom released to the grooms-for-hire pool keeps its level and reveals,
 *     and the pool shows only what is revealed.
 *
 * Real app, real DB; id-scoped fail-loud cleanup.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { releaseGroomTx } from '../services/groomEngagementService.mjs';
import { recordStaffShowsTx } from '../../../services/staffGrowthService.mjs';
import { getTraitDefinition } from '../../../utils/epigeneticTraits.mjs';

const ORIGIN = 'http://localhost:3000';
const prefix = 'TestFixture-xlw03-groom';
const tag = () => randomBytes(4).toString('hex');
const userIds = [];
const groomIds = [];
const horseIds = [];
const showIds = [];
const cleanup = createCleanupTracker();

async function makeUser() {
  const t = tag();
  const user = await prisma.user.create({
    data: {
      username: `${prefix}-${t}`,
      email: `${prefix}-${t}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Groom',
      lastName: 'Growth',
      money: 5000,
      settings: {},
    },
  });
  userIds.push(user.id);
  return { user, token: generateTestToken({ id: user.id, email: user.email, role: 'user' }) };
}

async function call(method, path, token, body) {
  const csrf = await fetchCsrf(app);
  const agent = request(app);
  const req = agent[method](path)
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken);
  return body ? req.send(body) : req;
}

async function hireGroom(user, token) {
  const marketplaceId = `mkt-${tag()}`;
  await prisma.staffMarketplaceState.create({
    data: {
      userId: user.id,
      staffType: 'groom',
      refreshCount: 0,
      offers: [
        {
          marketplaceId,
          firstName: 'TestFixture',
          lastName: `xlw03-${tag()}`,
          specialty: 'general',
          skillLevel: 'novice',
          starLevel: 'rookie',
          weeklyFee: 100,
          personality: 'gentle',
          experience: 1,
          sessionRate: 15,
          bio: 'hire fixture',
          availability: true,
        },
      ],
    },
  });
  const res = await call('post', '/api/v1/groom-marketplace/hire', token, { marketplaceId });
  expect(res.status).toBe(201);
  const groom = await prisma.groom.findFirst({
    where: { userId: user.id },
    orderBy: { id: 'desc' },
  });
  groomIds.push(groom.id);
  return groom;
}

const profileOf = groomId => prisma.groomGrowthProfile.findUnique({ where: { groomId } });

async function labelsOf(items) {
  const breeds = await prisma.breed.findMany({
    where: { id: { in: items.filter(i => i.kind === 'breed').map(i => i.value) } },
    select: { id: true, name: true },
  });
  const names = new Map(breeds.map(b => [b.id, b.name]));
  return items.map(i =>
    i.kind === 'trait' ? getTraitDefinition(i.value).label : i.kind === 'breed' ? names.get(i.value) : i.value,
  );
}

const shownLabels = growth => growth.categories.flatMap(c => c.revealed.map(r => r.label)).sort();

beforeAll(() => {
  cleanup.add(() => prisma.competitionResult.deleteMany({ where: { showId: { in: showIds } } }), 'competitionResult');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'show');
  cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { groomId: { in: groomIds } } }), 'groomAssignment');
  cleanup.add(() => prisma.groomEngagement.deleteMany({ where: { groomId: { in: groomIds } } }), 'groomEngagement');
  cleanup.add(() => prisma.groom.deleteMany({ where: { id: { in: groomIds } } }), 'groom');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horse');
  cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: userIds } } }), 'notification');
  cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: userIds } } }), 'userTransaction');
  cleanup.add(
    () => prisma.staffMarketplaceState.deleteMany({ where: { userId: { in: userIds } } }),
    'staffMarketplaceState',
  );
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'user');
});

afterAll(() => cleanup.run(), 60000);

describe('groom growth (Equoria-xlw03)', () => {
  it('a hired groom is a Rookie with 12 hidden items; its profile shows the personality only', async () => {
    const { user, token } = await makeUser();
    const groom = await hireGroom(user, token);
    expect(groom.starLevel).toBe('rookie');

    const { items } = await profileOf(groom.id);
    expect(items.map(i => i.kind).sort()).toEqual(
      [
        ...Array(4).fill('trait'),
        ...Array(4).fill('discipline'),
        'temperament',
        'temperament',
        'breed',
        'breed',
      ].sort(),
    );
    expect(items.every(i => !i.revealed)).toBe(true);

    const res = await call('get', `/api/v1/grooms/${groom.id}/profile`, token);
    expect(res.status).toBe(200);
    expect(res.body.groom.growth).toMatchObject({
      starLevel: 'rookie',
      personality: 'gentle',
      totalItems: 12,
      revealedCount: 0,
    });
    const body = JSON.stringify(res.body);
    for (const label of await labelsOf(items)) {
      expect(body).not.toContain(`"${label}"`);
    }
  });

  it('an unpaid groom released to the pool keeps its level and reveals; the pool shows only those', async () => {
    const { user, token } = await makeUser();
    const { token: otherToken } = await makeUser();
    const own = await hireGroom(user, token);
    await prisma.$transaction(tx => recordStaffShowsTx(tx, 'groom', own.id, 600));
    const before = await profileOf(own.id);
    expect(before.items.filter(i => i.revealed)).toHaveLength(9);

    await prisma.$transaction(tx => releaseGroomTx(tx, { groomId: own.id, userId: user.id, reason: 'feeUnpaid' }));
    const released = await prisma.groom.findUnique({ where: { id: own.id } });
    expect(released).toMatchObject({ userId: null, starLevel: 'advanced' });
    expect((await profileOf(own.id)).items).toEqual(before.items);

    const res = await call('get', '/api/v1/groom-marketplace/free-agents?limit=100', otherToken);
    expect(res.status).toBe(200);
    const listed = res.body.data.grooms.find(g => g.id === own.id);
    expect(listed).toBeDefined();
    expect(listed.starLevel).toBe('advanced');
    expect(listed.weeklyFee).toBe(400);
    expect(shownLabels(listed.growth)).toEqual((await labelsOf(before.items.filter(i => i.revealed))).sort());
    const body = JSON.stringify(listed);
    for (const label of await labelsOf(before.items.filter(i => !i.revealed))) {
      expect(body).not.toContain(`"${label}"`);
    }
  }, 60000);
});
