/**
 * A hidden trait adds nothing to a horse's breeding quality (Equoria-q4uem.17).
 *
 * Owner ruling 2026-10-19 (Stacey): "Hidden = no effect. These are EPIGENETIC
 * traits. They have to be turned ON to activate." A hidden trait affects nothing,
 * breeding-data counts included, until it is revealed.
 *
 * generateBreedingData used to score its epigenetic-trait points from
 * positive + negative + hiddenCount, so a horse carrying three unrevealed traits
 * was rated 'fair' where the same horse with none was 'poor'. Only revealed,
 * active traits (positive / negative) may move the rating.
 *
 * Real database: fixture horses created through the canonical helper.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateBreedingData } from '../index.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

const run = randomBytes(4).toString('hex');
const cleanup = createCleanupTracker();
const horseIds = [];
let user;
let hiddenOnly;
let activeOnly;

async function makeHorse(label, epigeneticModifiers) {
  const horse = await prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: `TestFixture-BQ-${label}-${run}`,
      sex: 'Mare',
      dateOfBirth: new Date(),
      age: 4,
      userId: user.id,
      epigeneticModifiers,
    }),
  });
  horseIds.push(horse.id);
  return horse;
}

beforeAll(async () => {
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user?.id } }), 'user');
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `bq-hidden-${run}@test.com`,
      username: `bqhidden${run}`,
      password: 'irrelevant-hash',
      firstName: 'Test',
      lastName: 'Fixture',
      money: 0,
    },
  });
  hiddenOnly = await makeHorse('HiddenOnly', {
    positive: [],
    negative: [],
    hidden: ['brave', 'confident', 'curious'],
    dormant: [],
  });
  activeOnly = await makeHorse('ActiveOnly', {
    positive: ['brave', 'confident', 'curious'],
    negative: [],
    hidden: [],
    dormant: [],
  });
}, 60_000);

afterAll(() => cleanup.run(), 30_000);

describe('breeding quality counts only revealed, active traits (Equoria-q4uem.17)', () => {
  it('three hidden traits earn no quality points: the horse rates "poor"', async () => {
    const result = await generateBreedingData(hiddenOnly.id);
    expect(result.epigeneticFlags.hiddenCount).toBe(3);
    expect(result.breedingQuality).toBe('poor');
  });

  it('NOT vacuous: the same three traits active earn the epigenetic points ("fair")', async () => {
    const result = await generateBreedingData(activeOnly.id);
    expect(result.epigeneticFlags.positive).toHaveLength(3);
    expect(result.breedingQuality).toBe('fair');
  });
});
