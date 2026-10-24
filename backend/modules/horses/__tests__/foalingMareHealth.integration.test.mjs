/**
 * Foaling reads the mare's health and hunger (owner ruling 2026-10-23,
 * Equoria-w4ivy). Real DB, real foaling service, no mocks.
 *
 *   - A foal is born with its mare's health and hunger state at foaling.
 *   - A Fair mare raises the foal's negative-trait chance by 25%, a Bad mare by
 *     50%; the multiplier acts on the chance as it already stands, and no other
 *     odds (the positive-trait chance) move.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createFoalFromPregnancy } from '../services/foalingService.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { horseHealthGrade } from '../../../utils/horseHealth.mjs';

const dayMs = 24 * 60 * 60 * 1000;
const fixturePrefix = 'TestFixture-w4ivy';
const tag = randomBytes(4).toString('hex');

let testUser;
let breedId;
let sire;
const cleanup = createCleanupTracker();

async function pregnantMare(label, care) {
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${fixturePrefix}-Dam-${label}-${tag}`,
      sex: 'Mare',
      dateOfBirth: gameCalendarDate(new Date(), -5 * 365),
      age: 5,
      breedId,
      userId: testUser.id,
      healthStatus: 'Excellent',
      inFoalSinceDate: new Date(Date.now() - 8 * dayMs),
      pregnancySireId: sire.id,
      pregnancyFeedingsByTier: {},
      ...care,
    },
  });
}

const foalWith = (damId, options = {}) =>
  createFoalFromPregnancy({
    damId,
    options: { rng: () => 0.99, negativeTraitChance: 40, positiveTraitChance: 30, ...options },
  });

const vettedDaysAgo = days => gameCalendarDate(new Date(), -days);

beforeAll(async () => {
  testUser = await prisma.user.create({
    data: {
      email: `${fixturePrefix}-${tag}@test.com`,
      username: `${fixturePrefix}-${tag}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'Mare',
      lastName: 'Health',
      money: 0,
    },
  });
  const breed = await prisma.breed.upsert({
    where: { name: 'Thoroughbred' },
    update: {},
    create: { name: 'Thoroughbred', description: 'w4ivy test breed' },
  });
  breedId = breed.id;
  sire = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${fixturePrefix}-Sire-${tag}`,
      sex: 'Stallion',
      dateOfBirth: gameCalendarDate(new Date(), -5 * 365),
      age: 5,
      breedId,
      userId: testUser.id,
    },
  });
}, 60000);

afterAll(async () => {
  if (testUser) {
    cleanup.add(() => prisma.notification.deleteMany({ where: { userId: testUser.id } }), 'notifications');
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: testUser.id, age: 0 } }), 'foals');
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: testUser.id } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: testUser.id } }), 'users');
  }
  await cleanup.run();
}, 30000);

describe('negative-trait chance by the mare health at foaling (Equoria-w4ivy)', () => {
  it('leaves the chance alone for an Excellent mare', async () => {
    const dam = await pregnantMare('excellent', { lastVettedDate: vettedDaysAgo(0), lastFedDate: new Date() });
    const { breedingAnalysis } = await foalWith(dam.id);
    expect(breedingAnalysis.damHealthGrade).toBe('excellent');
    expect(breedingAnalysis.pregnancyBonus.negativeChance).toBe(40);
  });

  it('raises it 25% for a Fair mare (vetted 22 days ago)', async () => {
    const dam = await pregnantMare('fair', { lastVettedDate: vettedDaysAgo(22), lastFedDate: new Date() });
    const { breedingAnalysis } = await foalWith(dam.id);
    expect(breedingAnalysis.damHealthGrade).toBe('fair');
    expect(breedingAnalysis.pregnancyBonus.negativeChance).toBe(50);
  });

  it('raises it 50% for a Bad mare (vetted 29 days ago), and leaves the positive chance alone', async () => {
    const dam = await pregnantMare('bad', { lastVettedDate: vettedDaysAgo(29), lastFedDate: new Date() });
    const { breedingAnalysis } = await foalWith(dam.id);
    expect(breedingAnalysis.damHealthGrade).toBe('bad');
    expect(breedingAnalysis.pregnancyBonus.negativeChance).toBe(60);
    expect(breedingAnalysis.pregnancyBonus.positiveChance).toBe(30);
  });

  it('reads hunger too: a freshly vetted mare Fair from hunger alone is Good, not Fair', async () => {
    // Bad hunger lowers Excellent health two levels, to Good: no multiplier.
    const dam = await pregnantMare('hungry', { lastVettedDate: vettedDaysAgo(0), lastFedDate: null });
    const { breedingAnalysis } = await foalWith(dam.id);
    expect(breedingAnalysis.damHealthGrade).toBe('good');
    expect(breedingAnalysis.pregnancyBonus.negativeChance).toBe(40);
  });
});

describe('the foal is born with the mare health and hunger (Equoria-w4ivy)', () => {
  it.each([
    ['Fair from the vet', { vetDays: 22, fedDaysAgo: 0 }],
    ['Bad from vet and hunger', { vetDays: 25, fedDaysAgo: 8 }],
    ['Excellent', { vetDays: 1, fedDaysAgo: 1 }],
  ])('%s', async (label, { vetDays, fedDaysAgo }) => {
    const dam = await pregnantMare(`inherit-${vetDays}-${fedDaysAgo}`, {
      lastVettedDate: vettedDaysAgo(vetDays),
      lastFedDate: new Date(Date.now() - fedDaysAgo * dayMs),
    });
    const { foal } = await foalWith(dam.id);
    const born = await prisma.horse.findUnique({ where: { id: foal.id } });
    const damAtFoaling = await prisma.horse.findUnique({ where: { id: dam.id } });
    expect(horseHealthGrade(born)).toBe(horseHealthGrade(damAtFoaling));
    expect(born.lastFedDate?.getTime()).toBe(damAtFoaling.lastFedDate.getTime());
    expect(born.lastVettedDate.getTime()).toBe(damAtFoaling.lastVettedDate.getTime());
  });

  it('carries a hunger raised by feeding (hungerSince) to the foal', async () => {
    const hungerSince = new Date(Date.now() - 4 * dayMs);
    const dam = await pregnantMare('hungerSince', {
      lastVettedDate: vettedDaysAgo(0),
      lastFedDate: new Date(),
      hungerSince,
    });
    const { foal } = await foalWith(dam.id);
    const born = await prisma.horse.findUnique({ where: { id: foal.id } });
    expect(born.hungerSince?.getTime()).toBe(hungerSince.getTime());
  });
});
