/**
 * Groom Interaction Daily Limits Tests
 *
 * Tests that ALL horses (regardless of age) are limited to one groom interaction
 * per day via the real validateFoalInteractionLimits function against the real DB.
 * No mocks of any kind.
 *
 * Fixtures:
 *   - One shared Groom (TestFixture-GroomIntLimits-Groom)
 *   - Horses created per-test (TestFixture-GroomIntLimits-*)
 *   - GroomInteractions created with timestamp = today to test daily limit
 *
 * Cleanup: horse.delete cascades to groomInteractions (foalId FK).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../db/index.mjs';
import { validateFoalInteractionLimits } from '../utils/groomSystem.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from './helpers/fixtureColor.mjs';

const PREFIX = 'TestFixture-GroomIntLimits-';

let groomId;

// ─── fixtures ─────────────────────────────────────────────────────────────────

async function mkHorse(suffix, opts = {}) {
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}${suffix}`,
      sex: 'Colt',
      dateOfBirth: opts.dateOfBirth ?? new Date('2022-01-01'),
      age: opts.age ?? 1,
    },
  });
}

async function rmHorse(id) {
  await prisma.horse.delete({ where: { id } }).catch(() => {});
}

async function mkInteractionToday(foalId) {
  // validateFoalInteractionLimits queries the `timestamp` field for today's window
  return prisma.groomInteraction.create({
    data: {
      foalId,
      groomId,
      interactionType: 'daily_care',
      duration: 30,
      timestamp: new Date(),
    },
  });
}

// ─── setup / teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  await prisma.horse.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.groom.deleteMany({ where: { name: { startsWith: PREFIX } } });

  const groom = await prisma.groom.create({
    data: {
      name: `${PREFIX}Groom`,
      speciality: 'foalCare',
      personality: 'calm',
    },
  });
  groomId = groom.id;
});

afterAll(async () => {
  await prisma.horse.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.groom.deleteMany({ where: { name: { startsWith: PREFIX } } });
});

// ─── daily limit enforcement ──────────────────────────────────────────────────

describe('Daily Limits — ALL Horses', () => {
  it('prevents a second interaction today for a 1-year-old horse', async () => {
    const horse = await mkHorse('Adult1yr', { age: 1 });
    try {
      await mkInteractionToday(horse.id);

      const result = await validateFoalInteractionLimits(horse.id);

      expect(result.canInteract).toBe(false);
      expect(result.message).toContain('already had a groom interaction today');
    } finally {
      await rmHorse(horse.id);
    }
  });

  it('prevents a second interaction today for a 2-year-old horse', async () => {
    const horse = await mkHorse('Adult2yr', { age: 2 });
    try {
      await mkInteractionToday(horse.id);

      const result = await validateFoalInteractionLimits(horse.id);

      expect(result.canInteract).toBe(false);
      expect(result.message).toContain('already had a groom interaction today');
    } finally {
      await rmHorse(horse.id);
    }
  });

  it('prevents a second interaction today for a young foal and reports interactionsToday=1', async () => {
    const horse = await mkHorse('YoungFoal', { age: 0 });
    try {
      await mkInteractionToday(horse.id);

      const result = await validateFoalInteractionLimits(horse.id);

      expect(result.canInteract).toBe(false);
      expect(result.message).toContain('already had a groom interaction today');
      expect(result.interactionsToday).toBe(1);
    } finally {
      await rmHorse(horse.id);
    }
  });
});

// ─── edge cases ───────────────────────────────────────────────────────────────

describe('Edge Cases', () => {
  it('throws when horse ID does not exist', async () => {
    await expect(validateFoalInteractionLimits(999999999)).rejects.toThrow('Horse with ID 999999999 not found');
  });

  it('allows interaction when horse has no interactions today', async () => {
    const horse = await mkHorse('NoInteractions', { age: 1 });
    try {
      const result = await validateFoalInteractionLimits(horse.id);

      expect(result.canInteract).toBe(true);
      expect(result.message).toContain('can have a groom interaction today');
    } finally {
      await rmHorse(horse.id);
    }
  });
});
