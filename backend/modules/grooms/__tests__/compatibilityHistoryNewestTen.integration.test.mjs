/**
 * Equoria-ld219 — groom/horse compatibility history uses the NEWEST 10
 * interactions in the window (owner ruling 2026-10-23).
 *
 * The history modifier averages up to ten of this groom's interactions with the
 * horse from the last 14 days. It used to take the first ten in id order, i.e.
 * the OLDEST ten, so a groom's latest work never moved the score once the
 * window held more than ten. Now it takes the newest ten (createdAt desc, ties
 * by id desc). The scoring formula itself is unchanged.
 *
 * Real DB: real groom, horse and interaction rows read through
 * loadCompatibilityInputs, then scored by scoreCompatibility. No mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { loadCompatibilityInputs, scoreCompatibility } from '../services/dynamicCompatibilityScoring.mjs';

const SCOPE = 'TestFixture-ld219';
const RUN = randomBytes(5).toString('hex');
const hourMs = 60 * 60 * 1000;
const CONTEXT = { taskType: 'desensitization', environmentalFactors: [] };

const cleanup = createCleanupTracker();
let user;
let horse;
let groom;
const now = new Date();

/**
 * The modifier formula (unchanged): quality poor=1..excellent=4, neutral 2.5;
 * bonding neutral 0. ((q - 2.5) * 0.1 + 1 + b * 0.05 + 1) / 2, clamped 0.8..1.2.
 */
function expectedModifier(rows) {
  const scores = { poor: 1, fair: 2, good: 3, excellent: 4 };
  const q = rows.reduce((s, r) => s + scores[r.quality], 0) / rows.length;
  const b = rows.reduce((s, r) => s + r.bondingChange, 0) / rows.length;
  return Math.max(0.8, Math.min(1.2, ((q - 2.5) * 0.1 + 1 + (b * 0.05 + 1)) / 2));
}

beforeAll(async () => {
  cleanup.add(() => prisma.groomInteraction.deleteMany({ where: { groomId: groom.id } }), 'interactions');
  cleanup.add(() => prisma.groom.deleteMany({ where: { id: groom.id } }), 'groom');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: horse.id } }), 'horse');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `${SCOPE}-${RUN}@test.com`,
      username: `ld219${RUN}`,
      password: 'irrelevant-hash',
      firstName: 'Compat',
      lastName: 'History',
      money: 0,
    },
  });
  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${SCOPE}-horse-${RUN}`,
      sex: 'Mare',
      dateOfBirth: new Date('2020-01-01'),
      age: 5,
      userId: user.id,
    },
  });
  groom = await prisma.groom.create({
    data: {
      name: `${SCOPE}-groom-${RUN}`,
      speciality: 'general',
      personality: 'gentle',
      skillLevel: 'novice',
      userId: user.id,
    },
  });
}, 60_000);

afterAll(() => cleanup.run(), 60_000);

async function interact({ hoursAgo, quality, bondingChange }) {
  return prisma.groomInteraction.create({
    data: {
      interactionType: 'desensitization',
      duration: 30,
      quality,
      bondingChange,
      foalId: horse.id,
      groomId: groom.id,
      createdAt: new Date(now.getTime() - hoursAgo * hourMs),
    },
  });
}

describe('Equoria-ld219 — compatibility history takes the newest 10 in the window', () => {
  it('ignores the oldest rows once the window holds more than ten', async () => {
    // Inserted in time order, as the game writes them: the two OLDEST rows hold
    // the LOWEST ids, which is exactly what the old id-order pick took first.
    const oldest = [
      await interact({ hoursAgo: 101, quality: 'excellent', bondingChange: 5 }),
      await interact({ hoursAgo: 100, quality: 'excellent', bondingChange: 5 }),
    ];
    const rows = [];
    for (let i = 10; i >= 1; i--) {
      rows.push(await interact({ hoursAgo: i, quality: 'poor', bondingChange: 0 }));
    }
    // Outside the 14-day window: never counted.
    await interact({ hoursAgo: 15 * 24, quality: 'excellent', bondingChange: 5 });

    const inputs = await loadCompatibilityInputs(horse.id, { groomIds: [groom.id], now });
    const result = scoreCompatibility(inputs, groom.id, CONTEXT);

    expect(result.historicalModifier).toBeCloseTo(expectedModifier(rows), 10);
    // The old pick (the ten lowest ids) averaged in the two oldest instead.
    expect(expectedModifier(rows)).not.toBeCloseTo(expectedModifier([...oldest, ...rows.slice(0, 8)]), 5);
  });
});
