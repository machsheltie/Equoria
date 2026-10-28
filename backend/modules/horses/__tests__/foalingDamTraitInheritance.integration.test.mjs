/**
 * Integration test — the nightly foaling job passes on the DAM's traits
 * (Equoria-3ab0k, audit BRE-03).
 *
 * Defect: runFoalingJob selected the due mares without `epigeneticModifiers`
 * and handed that row to createFoalFromPregnancy as the dam snapshot, so the
 * dam's traits were read as "none". A foal could inherit from its sire but
 * never from its dam.
 *
 * Rules exercised (owner rulings 2026-10-27/28, q138 + q145): every trait a
 * parent carries rolls a flat 25% once per parent; a trait active and revealed
 * on a parent is born revealed, a hidden one is born hidden (2026-10-19).
 *
 * The trait rolls are driven by the job's `traitRng` seam so the outcome is
 * deterministic: `() => 0` passes every roll, `() => 0.99` fails every roll.
 *
 * Real DB. No mocks.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { runFoalingJob } from '../services/foalingService.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const dayMs = 24 * 60 * 60 * 1000;
const cleanup = createCleanupTracker();
const createdUserIds = [];

async function createUser() {
  const tag = randomBytes(6).toString('hex');
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `bre03_${tag}`,
      email: `bre03_${tag}@test.com`,
      password: 'pwhash',
      firstName: 'Bre',
      lastName: 'Three',
      money: 0,
      settings: {},
    },
  });
  createdUserIds.push(user.id);
  return user;
}

async function createPregnantPair(userId, damModifiers) {
  const breed = await prisma.breed.upsert({
    where: { name: 'Thoroughbred' },
    update: {},
    create: { name: 'Thoroughbred', description: 'BRE-03 test breed' },
  });
  const fiveYearsAgo = gameCalendarDate(new Date(), -5 * 365);
  const tag = randomBytes(3).toString('hex');
  const sire = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `Bre03Sire_${tag}`,
      sex: 'Stallion',
      dateOfBirth: fiveYearsAgo,
      age: 5,
      breedId: breed.id,
      userId,
      healthStatus: 'Good',
      epigeneticModifiers: { positive: [], negative: [], hidden: [] },
    },
  });
  const dam = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `Bre03Dam_${tag}`,
      sex: 'Mare',
      dateOfBirth: fiveYearsAgo,
      age: 5,
      breedId: breed.id,
      userId,
      healthStatus: 'Good',
      epigeneticModifiers: damModifiers,
      inFoalSinceDate: new Date(Date.now() - 8 * dayMs),
      pregnancySireId: sire.id,
      pregnancyFeedingsByTier: {},
    },
  });
  return { sire, dam };
}

async function foalOf(damId) {
  const foals = await prisma.horse.findMany({ where: { damId } });
  expect(foals).toHaveLength(1);
  return foals[0];
}

afterEach(async () => {
  for (const uid of createdUserIds.splice(0)) {
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: uid, age: 0 } }), `foals:${uid}`);
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: uid } }), `horses:${uid}`);
    cleanup.add(() => prisma.user.deleteMany({ where: { id: uid } }), `user:${uid}`);
  }
  await cleanup.run();
});

describe('runFoalingJob: the dam passes on her traits (BRE-03)', () => {
  it('a trait only the dam carries can pass to the foal; her revealed trait is born revealed, her hidden one hidden', async () => {
    const user = await createUser();
    const { dam } = await createPregnantPair(user.id, {
      positive: ['brave'],
      negative: [],
      hidden: ['curious'],
    });

    const result = await runFoalingJob({ traitRng: () => 0 });
    expect(result.errors.filter(e => e.damId === dam.id)).toEqual([]);

    const foal = await foalOf(dam.id);
    expect(foal.userId).toBe(user.id);
    expect(foal.epigeneticModifiers.positive).toContain('brave');
    expect(foal.epigeneticModifiers.hidden).toContain('curious');
    expect(foal.epigeneticModifiers.positive).not.toContain('curious');
  });

  it('a failed 25% roll passes nothing on from the dam', async () => {
    const user = await createUser();
    const { dam } = await createPregnantPair(user.id, {
      positive: ['brave'],
      negative: [],
      hidden: ['curious'],
    });

    await runFoalingJob({ traitRng: () => 0.99 });

    const foal = await foalOf(dam.id);
    const carried = [
      ...foal.epigeneticModifiers.positive,
      ...foal.epigeneticModifiers.negative,
      ...foal.epigeneticModifiers.hidden,
    ];
    expect(carried).not.toContain('brave');
    expect(carried).not.toContain('curious');
  });
});
