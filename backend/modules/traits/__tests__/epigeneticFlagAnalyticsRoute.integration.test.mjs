/**
 * Epigenetic Flag Analytics Route — Integration Tests (Equoria-yzqhj.7)
 *
 * Verifies the PROMOTED core (beta) flag-analytics endpoint:
 *   GET /api/v1/flags/analytics
 *
 * Decision recorded: PROMOTED to core. The flag-aggregation analytics that
 * previously lived ONLY behind the experimental labs reporting module are now
 * exposed on the core epigenetic-flag surface, reusing the existing
 * analyzeTraitDistribution + generateStableOverview service functions.
 *
 * Real DB, no internal mocks. Scoped cleanup (collected ids + TestFixture-
 * names). No skips. Sentinel-positive: the planted flags actually show up in
 * the aggregation, and a NON-OWNER's flags do NOT.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../db/index.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { createTestHorse, cleanupTestHorses } from '../../../__tests__/helpers/createTestHorse.mjs';

const randHex = () => randomBytes(4).toString('hex');

describe('GET /api/v1/flags/analytics — core flag analytics (Equoria-yzqhj.7)', () => {
  let ownerUser;
  let ownerToken;
  let otherUser;
  const createdHorseIds = [];
  const createdUserIds = [];

  // Known flags planted on the owner's horses.
  const ownerHorse1Flags = ['BRAVE', 'CALM'];
  const ownerHorse2Flags = ['BRAVE', 'AFFECTIONATE'];
  // A flag planted ONLY on another user's horse — must NOT appear in owner's
  // aggregation (auth-scoping sentinel).
  const otherHorseOnlyFlag = 'FEARFUL';

  beforeAll(async () => {
    ownerUser = await prisma.user.create({
      data: {
        id: `TestFixture-yzqhj-owner-${randHex()}_${randHex()}`,
        username: `TestFixture-owner-${randHex()}`,
        email: `testfixture-owner-${randHex()}@example.com`,
        password: 'TestPassword123!',
        role: 'user',
        firstName: 'Test',
        lastName: 'Owner',
      },
    });
    createdUserIds.push(ownerUser.id);

    otherUser = await prisma.user.create({
      data: {
        id: `TestFixture-yzqhj-other-${randHex()}_${randHex()}`,
        username: `TestFixture-other-${randHex()}`,
        email: `testfixture-other-${randHex()}@example.com`,
        password: 'TestPassword123!',
        role: 'user',
        firstName: 'Test',
        lastName: 'Other',
      },
    });
    createdUserIds.push(otherUser.id);

    ownerToken = generateTestToken({ id: ownerUser.id, email: ownerUser.email, role: 'user' });

    // Owner's two horses with known flags.
    await createTestHorse(
      prisma,
      {
        name: `TestFixture-yzqhj-h1-${randHex()}`,
        sex: 'Mare',
        dateOfBirth: new Date('2024-01-01T00:00:00.000Z'),
        userId: ownerUser.id,
        bondScore: 40,
        stressLevel: 3,
        epigeneticFlags: ownerHorse1Flags,
      },
      createdHorseIds,
    );
    await createTestHorse(
      prisma,
      {
        name: `TestFixture-yzqhj-h2-${randHex()}`,
        sex: 'Stallion',
        dateOfBirth: new Date('2024-01-01T00:00:00.000Z'),
        userId: ownerUser.id,
        bondScore: 50,
        stressLevel: 5,
        epigeneticFlags: ownerHorse2Flags,
      },
      createdHorseIds,
    );

    // Another user's horse carrying a flag that must stay out of the owner's
    // aggregation.
    await createTestHorse(
      prisma,
      {
        name: `TestFixture-yzqhj-other-h-${randHex()}`,
        sex: 'Mare',
        dateOfBirth: new Date('2024-01-01T00:00:00.000Z'),
        userId: otherUser.id,
        bondScore: 30,
        stressLevel: 2,
        epigeneticFlags: [otherHorseOnlyFlag, 'BRAVE'],
      },
      createdHorseIds,
    );
  });

  afterAll(async () => {
    await cleanupTestHorses(prisma, createdHorseIds);
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  test('returns 401 without authentication', async () => {
    const response = await request(app)
      .get('/api/v1/flags/analytics')
      .set('Origin', 'http://localhost:3000');

    expect(response.status).toBe(401);
  });

  test('returns 200 with flag aggregation reflecting the planted flags + correct horseCount', async () => {
    const response = await request(app)
      .get('/api/v1/flags/analytics')
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();

    const { traitDistribution, stableOverview, horseCount } = response.body.data;

    // horseCount matches the owner's 2 horses (not the other user's).
    expect(horseCount).toBe(2);
    expect(stableOverview.totalHorses).toBe(2);

    // Sentinel-positive: the planted flags show up in the aggregation with
    // the correct frequencies. BRAVE on both owner horses → 2; CALM and
    // AFFECTIONATE each on one → 1.
    expect(traitDistribution.traitFrequency.BRAVE).toBe(2);
    expect(traitDistribution.traitFrequency.CALM).toBe(1);
    expect(traitDistribution.traitFrequency.AFFECTIONATE).toBe(1);

    // totalTraits = 2 + 2 = 4; uniqueTraits = {BRAVE, CALM, AFFECTIONATE} = 3.
    expect(traitDistribution.totalTraits).toBe(4);
    expect(traitDistribution.uniqueTraits).toBe(3);

    // stableOverview.traitCounts mirrors the same per-flag tally.
    expect(stableOverview.traitCounts.BRAVE).toBe(2);
    expect(stableOverview.traitCounts.CALM).toBe(1);
    expect(stableOverview.traitCounts.AFFECTIONATE).toBe(1);
  });

  test('auth-scoping sentinel: another user’s flags are NOT included', async () => {
    const response = await request(app)
      .get('/api/v1/flags/analytics')
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    const { traitDistribution, stableOverview } = response.body.data;

    // FEARFUL lives ONLY on the other user's horse — it must be absent from
    // the owner's aggregation.
    expect(traitDistribution.traitFrequency).not.toHaveProperty(otherHorseOnlyFlag);
    expect(stableOverview.traitCounts).not.toHaveProperty(otherHorseOnlyFlag);

    // The other user's horse also carries BRAVE; if scoping leaked, BRAVE
    // would be 3, not 2.
    expect(traitDistribution.traitFrequency.BRAVE).toBe(2);
  });

  test('empty case: a user with 0 horses gets a valid empty aggregation (not a 500)', async () => {
    const emptyUser = await prisma.user.create({
      data: {
        id: `TestFixture-yzqhj-empty-${randHex()}_${randHex()}`,
        username: `TestFixture-empty-${randHex()}`,
        email: `testfixture-empty-${randHex()}@example.com`,
        password: 'TestPassword123!',
        role: 'user',
        firstName: 'Test',
        lastName: 'Empty',
      },
    });
    createdUserIds.push(emptyUser.id);
    const emptyToken = generateTestToken({ id: emptyUser.id, email: emptyUser.email, role: 'user' });

    const response = await request(app)
      .get('/api/v1/flags/analytics')
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${emptyToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.horseCount).toBe(0);
    expect(response.body.data.stableOverview.totalHorses).toBe(0);
    expect(response.body.data.traitDistribution.totalTraits).toBe(0);
    expect(response.body.data.traitDistribution.uniqueTraits).toBe(0);
    expect(response.body.data.traitDistribution.traitFrequency).toEqual({});
  });
});
