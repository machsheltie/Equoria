/**
 * breedingPredictionService unit tests (Equoria-rr7 coverage sprint).
 *
 * Shared DB fixture: user + Stallion + Mare (no trait history, no lineage).
 * Tests exercise the zero-trait / missing-parent paths.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { calculateTemperamentInfluence, generateBreedingData } from '../services/breedingPredictionService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { realDateOrReason } from '../../../__tests__/helpers/expectRealDate.mjs';

let user;
let stallion;
let mare;
const cleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `breedlin-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `breedlin${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'BreedLin',
      lastName: 'Tester',
      money: 1000,
    },
  });

  stallion = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-BreedLinStallion-${Date.now()}`,
      sex: 'Stallion',
      dateOfBirth: gameCalendarDate(new Date(), -5 * 365),
      age: 5,
      userId: user.id,
    },
  });

  mare = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-BreedLinMare-${Date.now()}`,
      sex: 'Mare',
      dateOfBirth: gameCalendarDate(new Date(), -4 * 365),
      age: 4,
      userId: user.id,
    },
  });

  // Scoped, fail-loud cleanup (Equoria-1ohys). FK order: stallion + mare
  // (independent, no lineage between them) BEFORE the owning user —
  // Horse.userId is onDelete:Restrict (schema:282). .deleteMany so an
  // already-gone row is a no-op, not P2025; a real scope/FK failure reds
  // afterAll instead of being swallowed.
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: stallion.id } }), 'stallion');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: mare.id } }), 'mare');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ── breedingPredictionService ─────────────────────────────────────────────────
// calculateInheritanceProbabilities / calculateFlagInheritanceScore /
// predictOffspringTraits were deleted with their tests (owner ruling
// 2026-10-19, Equoria-6dace fix round 1).

describe('calculateTemperamentInfluence', () => {
  it('throws for non-existent horse IDs', async () => {
    await expect(calculateTemperamentInfluence(999999999, 999999998)).rejects.toThrow();
  });

  it('returns compatibility shape for valid pair', async () => {
    const result = await calculateTemperamentInfluence(stallion.id, mare.id);
    expect(result.stallionId).toBe(stallion.id);
    expect(result.mareId).toBe(mare.id);
    expect(typeof result.compatibilityScore).toBe('number');
    expect(Array.isArray(result.predictedOffspringTemperament)).toBe(true);
    expect(typeof result.traitInfluenceModifiers).toBe('object');
    expect(realDateOrReason(result.calculatedAt)).toBe('valid date');
  });
});

describe('generateBreedingData', () => {
  it('throws for non-existent horse', async () => {
    await expect(generateBreedingData(999999999)).rejects.toThrow();
  });

  it('returns breeding data shape for valid horse', async () => {
    const result = await generateBreedingData(stallion.id);
    expect(result.horseId).toBe(stallion.id);
    expect(typeof result.traitSummary).toBe('object');
    expect(typeof result.traitSummary.totalTraits).toBe('number');
    expect(result.traitSummary.totalTraits).toBe(0);
  });
});
