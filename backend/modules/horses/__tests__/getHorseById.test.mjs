/**
 * getHorseById — DB-fixture tests (Equoria-rr7 / Equoria-jkht).
 *
 * Equoria-q4uem.7 S2: getHorseById moved from the former horseModelService into
 * horseRouteQueries.mjs, and the other 13 horseModelService exports were deleted
 * as dead code with their tests; this file keeps the getHorseById block of the
 * former horseModelFunctions.test.mjs, assertions unchanged.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { getHorseById } from '../services/horseRouteQueries.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

let hmUser;
let hmHorse;
const hmCleanup = createCleanupTracker();

beforeAll(async () => {
  const ts = Date.now();
  const rand = () => Math.random().toString(36).slice(2, 8);

  hmUser = await prisma.user.create({
    data: {
      email: `hm-db-${ts}-${rand()}@test.com`,
      username: `hmdb${ts}${rand()}`,
      password: 'irrelevant-hash',
      firstName: 'HM',
      lastName: 'DBTest',
      money: 1000,
    },
  });

  hmHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-HMFunctions-${ts}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 3,
      userId: hmUser.id,
    },
  });

  // Scoped, fail-loud cleanup (Equoria-pemoo). Horse before user for the FK ordering.
  hmCleanup.add(() => prisma.horse.delete({ where: { id: hmHorse.id } }), 'horse');
  hmCleanup.add(() => prisma.user.delete({ where: { id: hmUser.id } }), 'user');
}, 30000);

afterAll(() => hmCleanup.run(), 30000);

// ── getHorseById ──────────────────────────────────────────────────────────────

describe('getHorseById()', () => {
  it('returns the horse for a valid existing id', async () => {
    const horse = await getHorseById(hmHorse.id);
    expect(horse).toBeDefined();
    expect(horse.id).toBe(hmHorse.id);
    expect(horse.name).toContain('TestFixture-HMFunctions-');
  });

  it('returns null for a non-existent horse id', async () => {
    const horse = await getHorseById(999999999);
    expect(horse).toBeNull();
  });

  it('throws for an invalid (negative) horse id', async () => {
    await expect(getHorseById(-1)).rejects.toThrow(/Invalid horse ID/);
  });

  it('throws for NaN id', async () => {
    await expect(getHorseById('not-a-number')).rejects.toThrow();
  });
});
