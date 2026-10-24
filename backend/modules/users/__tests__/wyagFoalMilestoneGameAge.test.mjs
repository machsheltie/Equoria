/**
 * While You Were Gone: the foal-milestone item follows game age and the
 * horse's own bond (Equoria-fr2kg, owner rulings Q11 and Q16, 2026-10-22).
 *
 * Old contract: the item listed foals whose legacy FoalDevelopment.isActive
 * was true and printed FoalDevelopment.bondScore / bondingLevel. Now a horse
 * under game age 3 qualifies whatever that legacy flag says, and the bond
 * shown is Horse.bondScore.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createTestHorse, cleanupTestHorses } from '../../../__tests__/helpers/createTestHorse.mjs';

const ORIGIN = 'http://localhost:3000';
const hex = () => randomBytes(4).toString('hex');
const hoursAgo = n => new Date(Date.now() - n * 60 * 60 * 1000);

const cleanup = createCleanupTracker();
const horseIds = [];
let user;
let token;
let youngName;
let grownName;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `wyagfoal-${hex()}-${hex()}@test.com`,
      username: `wyagfoal${hex()}${hex()}`,
      password: 'irrelevant-hash',
      firstName: 'Wyag',
      lastName: 'Foal',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  youngName = `TestFixture-WyagFoalYoung-${hex()}`;
  grownName = `TestFixture-WyagFoalGrown-${hex()}`;
  const young = await createTestHorse(
    prisma,
    { name: youngName, sex: 'Colt', age: 1, bondScore: 61, dateOfBirth: hoursAgo(24 * 8), userId: user.id },
    horseIds,
  );
  const grown = await createTestHorse(
    prisma,
    { name: grownName, sex: 'Colt', age: 5, bondScore: 77, dateOfBirth: hoursAgo(24 * 40), userId: user.id },
    horseIds,
  );
  // The legacy flag disagrees with game age on both rows on purpose.
  await prisma.foalDevelopment.create({
    data: { foalId: young.id, bondScore: 0, bondingLevel: 50, isActive: false, lastInteractionAt: hoursAgo(1) },
  });
  await prisma.foalDevelopment.create({
    data: { foalId: grown.id, bondScore: 9, bondingLevel: 50, isActive: true, lastInteractionAt: hoursAgo(1) },
  });

  cleanup.add(() => prisma.foalDevelopment.deleteMany({ where: { foalId: { in: horseIds } } }), 'foalDevelopment');
  cleanup.add(() => cleanupTestHorses(prisma, horseIds), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

describe('while-you-were-gone foal-milestone (Equoria-fr2kg)', () => {
  it('lists a horse under game age 3 with its own bond, and skips a horse of 3 or older', async () => {
    const res = await request(app)
      .get(`/api/v1/while-you-were-gone?since=${encodeURIComponent(hoursAgo(2).toISOString())}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const foalItems = res.body.data.items.filter(i => i.type === 'foal-milestone');

    const young = foalItems.find(i => i.title.includes(youngName));
    expect(young).toBeDefined();
    expect(young.description).toBe('Bond level: 61');
    expect(foalItems.find(i => i.title.includes(grownName))).toBeUndefined();
  });
});
