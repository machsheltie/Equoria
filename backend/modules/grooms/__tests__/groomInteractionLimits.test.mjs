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
import prisma from '../../../../packages/database/prismaClient.mjs';
import { validateFoalInteractionLimits } from '../../../utils/groomSystem.mjs';
// Equoria-15b6j: fail-loud scoped cleanup — a cleanup failure must fail the
// suite (not swallow into a warn) so a leaked fixture surfaces at the source.
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const PREFIX = 'TestFixture-GroomIntLimits-';

let groomId;
const cleanup = createCleanupTracker();

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
  // Equoria-15b6j: fail-loud, scoped, FK-ordered. deleteMany (not delete) is a
  // no-op on an already-removed row, so no swallow is needed to tolerate the
  // double-clean; a REAL delete failure now throws and fails the test instead
  // of being masked by a swallowed error arm.
  await prisma.groomInteraction.deleteMany({ where: { foalId: id } });
  await prisma.horse.deleteMany({ where: { id } });
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

  // Equoria-15b6j: register PREFIX-scoped fail-loud cleanup. Interactions
  // before horses (foalId FK) before grooms (referenced by interactions).
  cleanup.add(
    () =>
      prisma.groomInteraction.deleteMany({
        where: { foal: { name: { startsWith: PREFIX } } },
      }),
    'groomInteraction by PREFIX foal',
  );
  cleanup.add(() => prisma.horse.deleteMany({ where: { name: { startsWith: PREFIX } } }), 'horse by PREFIX');
  cleanup.add(() => prisma.groom.deleteMany({ where: { name: { startsWith: PREFIX } } }), 'groom by PREFIX');
});

afterAll(() => cleanup.run());

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
