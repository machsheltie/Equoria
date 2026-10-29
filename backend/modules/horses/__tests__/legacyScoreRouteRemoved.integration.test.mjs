/**
 * The legacy-score route is removed (owner ruling q242, 2026-10-28;
 * Equoria-qw4kp). No screen used it, and its trait and penalty breakdown let a
 * player subtract the parts from the total to find a hidden rare trait's
 * points.
 *
 * Old contract: GET /api/v1/horses/:id/legacy-score answered the horse's owner
 * with `data.legacyScore` (total, grade and per-component breakdown).
 * Ruling: it now answers the app's JSON "Route not found" 404. On the old code
 * the owner's request reached the handler and got a 200, so this fails there.
 *
 * Real DB, real HTTP, scoped fail-loud fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

const ORIGIN = 'http://localhost:3000';
const PREFIX = `TestFixture-q242-legacyScore-${randomBytes(4).toString('hex')}`;

describe('the legacy-score route is removed (q242)', () => {
  const cleanup = createCleanupTracker();
  let token;
  let horse;

  beforeAll(async () => {
    // FK order: horse before its owner (Horse.userId is onDelete: Restrict).
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: horse.id } }), 'horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
    const user = await prisma.user.create({
      data: {
        emailVerified: true,
        username: `${PREFIX}-owner`,
        email: `${PREFIX}-owner@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Legacy',
        lastName: 'Score',
        money: 1000,
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    horse = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: `${PREFIX}-horse`,
        sex: 'Mare',
        dateOfBirth: birthDateForAge(5),
        age: 5,
        userId: user.id,
        healthStatus: 'Good',
        epigeneticModifiers: { positive: ['brave'], negative: [], hidden: ['heart'] },
      }),
    });
  });

  afterAll(async () => {
    await cleanup.run();
  });

  it("the owner's GET /horses/:id/legacy-score answers the JSON route-not-found 404", async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horse.id}/legacy-score`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, message: 'Route not found' });
    expect(res.body.data?.legacyScore).toBeUndefined();
  });
});
