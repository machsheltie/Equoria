/**
 * POST /api/v1/environment/calculate-impact assesses every horse against ONE
 * environmental snapshot (Equoria-q4uem.7 S3, real app + DB).
 *
 * Before S3 the route called impact and triggers separately for each
 * horse, each with its own `new Date()`. The weather model seeds its daily
 * variation from the millisecond timestamp, so the sections of one response
 * could describe different weather. To make that observable deterministically,
 * the logger's info call inside the weather calculation waits 3 ms (a test-only
 * clock driver; the logger is infrastructure, its output is not under test):
 * every separately-computed weather then carries a different timestamp, while a
 * single snapshot carries one.
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const TOKEN = randomBytes(6).toString('hex');
const cleanup = createCleanupTracker();
let user;
let token;
const horseIds = [];

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `env1snap-${TOKEN}@test.com`,
      username: `env1snap${TOKEN}`,
      password: 'irrelevant-hash',
      firstName: 'One',
      lastName: 'Snapshot',
      money: 0,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  for (const traits of [[], ['nervous'], ['heat_tolerant', 'hardy']]) {
    const horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-Env1Snap-${TOKEN}-${horseIds.length}`,
        sex: 'Mare',
        dateOfBirth: new Date('2018-01-01'),
        age: 7,
        userId: user.id,
        healthStatus: 'Good',
        epigeneticModifiers: { positive: traits, negative: [], hidden: [] },
      },
    });
    horseIds.push(horse.id);
  }
  cleanup.add(() => prisma.horse.deleteMany({ where: { userId: user.id } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

describe('POST /api/v1/environment/calculate-impact uses one environmental snapshot', () => {
  it('every section of every horse reports the same weather', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    let delays = 0;
    jest.spyOn(logger, 'info').mockImplementation(message => {
      if (String(message).includes('calculateCurrentWeather')) {
        delays += 1;
        const started = Date.now();
        while (Date.now() - started < 3) {
          // advance the wall clock past the millisecond the weather was seeded with
        }
      }
    });

    const res = await request(app)
      .post('/api/v1/environment/calculate-impact')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseIds });

    expect(res.status).toBe(200);
    // The clock driver must have armed: a renamed weather log line would
    // otherwise silently remove the delay that makes separate clocks visible.
    expect(delays).toBeGreaterThan(0);
    expect(res.body.data.results).toHaveLength(horseIds.length);
    const weathers = res.body.data.results.flatMap(r => [r.impact.weather, r.triggers.weather]);
    expect(new Set(weathers.map(w => w.timestamp)).size).toBe(1);
    for (const w of weathers) {
      expect(w).toEqual(weathers[0]);
    }
  });
});
