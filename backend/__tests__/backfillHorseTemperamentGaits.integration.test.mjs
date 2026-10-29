/**
 * One-time backfill of NULL temperament and gaitScores (Equoria-576c0.5).
 *
 * Owner ruling 2026-10-19 (decision 4 / O5, option A): fill NULL temperament and NULL
 * gaitScores once, the way a new horse gets them, before both columns become required.
 * Gaits come only from the breed's gait ranges and a breed without them is never given
 * fallback scores (owner rulings 2026-10-28, q210 / q211), so such horses are listed
 * and left NULL for manual handling.
 *
 * Drives the real script's exported core against the real database, scoped to horses
 * this file plants (so no other horse row is read or written).
 *
 * Old contract: the database suite planted NULL temperament / gaitScores rows and
 * checked the fill. New rule (Equoria-576c0.5): both columns are NOT NULL, so no such
 * row can exist; the planning logic is still pinned on in-memory rows, and against the
 * database the script finds nothing to do and changes nothing.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../packages/database/prismaClient.mjs';
import { horseTemperamentValues } from '../constants/schema.mjs';
import { generateGaitScores } from '../modules/horses/services/gaitService.mjs';
import { getBreedProfile } from '../modules/horses/data/breedProfileLoader.mjs';
import {
  planTemperamentGaitBackfill,
  runTemperamentGaitBackfill,
} from '../scripts/backfill-horse-temperament-gaits.mjs';
import { createTestHorse } from './helpers/createTestHorse.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';
import { seededRng } from './helpers/seededRng.mjs';

const tag = `TestFixture-576c05-${randomBytes(4).toString('hex')}`;
const cleanup = createCleanupTracker();
const horseIds = [];
const createdBreedIds = [];
const breeds = {};

cleanup.add(async () => {
  if (horseIds.length) {
    await prisma.horse.deleteMany({ where: { id: { in: horseIds } } });
  }
}, 'planted horses');
cleanup.add(async () => {
  if (createdBreedIds.length) {
    await prisma.breed.deleteMany({ where: { id: { in: createdBreedIds } } });
  }
}, 'planted breeds');

// Uses the breed row if it exists; otherwise creates it and removes it afterwards.
async function breedNamed(name) {
  const existing = await prisma.breed.findUnique({ where: { name } });
  if (existing) {
    return existing;
  }
  const created = await prisma.breed.create({ data: { name } });
  createdBreedIds.push(created.id);
  return created;
}

async function plant(label, breedId, data = {}) {
  const horse = await createTestHorse(
    prisma,
    {
      name: `${tag}-${label}`,
      sex: 'Mare',
      breedId,
      ...data,
    },
    horseIds,
  );
  return horse.id;
}

const read = id => prisma.horse.findUnique({ where: { id }, select: { temperament: true, gaitScores: true } });

beforeAll(async () => {
  breeds.thoroughbred = await breedNamed('Thoroughbred');
  breeds.saddlebred = await breedNamed('American Saddlebred');
});

afterAll(async () => {
  await cleanup.run();
}, 30000);

describe('planTemperamentGaitBackfill', () => {
  it('rolls gaits with the same generator a new horse gets, special gaits only for a gaited breed', () => {
    for (const [breedName, seed] of [
      ['Thoroughbred', 11],
      ['American Saddlebred', 12],
    ]) {
      const { updates, skipped } = planTemperamentGaitBackfill(
        [{ id: 1, name: 'x', breedName, temperament: 'Calm', gaitScores: null }],
        { random: seededRng(seed) },
      );
      expect(skipped).toEqual([]);
      expect(updates).toEqual([{ id: 1, gaitScores: generateGaitScores(breedName, { random: seededRng(seed) }) }]);
    }
    const tb = planTemperamentGaitBackfill(
      [{ id: 1, name: 'x', breedName: 'Thoroughbred', temperament: 'Calm', gaitScores: null }],
      { random: seededRng(3) },
    ).updates[0].gaitScores;
    expect(tb.gaiting).toBeNull();
    const asb = planTemperamentGaitBackfill(
      [
        {
          id: 1,
          name: 'x',
          breedName: 'American Saddlebred',
          temperament: 'Calm',
          gaitScores: null,
        },
      ],
      { random: seededRng(4) },
    ).updates[0].gaitScores;
    expect(asb.gaiting.map(g => g.name)).toEqual(
      getBreedProfile('American Saddlebred').ratingProfiles.gaitedGaitRegistry,
    );
  });

  it("rolls temperament from the breed's weights over the 12 temperaments", () => {
    const weights = getBreedProfile('Thoroughbred').temperamentWeights;
    for (let i = 0; i < 50; i++) {
      const { updates } = planTemperamentGaitBackfill([
        { id: i, name: 'x', breedName: 'Thoroughbred', temperament: null, gaitScores: {} },
      ]);
      expect(Object.keys(updates[0])).toEqual(['id', 'temperament']);
      expect(horseTemperamentValues).toContain(updates[0].temperament);
      expect(weights[updates[0].temperament]).toBeGreaterThan(0);
    }
  });

  it('never guesses: no breed, or a breed with no profile, is listed and left NULL', () => {
    const noRangesName = `${tag}-NoRangesBreed`;
    const { updates, skipped } = planTemperamentGaitBackfill([
      { id: 1, name: 'a', breedName: null, temperament: null, gaitScores: null },
      { id: 2, name: 'b', breedName: noRangesName, temperament: null, gaitScores: null },
      { id: 3, name: 'c', breedName: noRangesName, temperament: 'Bold', gaitScores: null },
    ]);
    expect(updates).toEqual([]);
    expect(skipped.map(s => [s.id, s.columns])).toEqual([
      [1, ['temperament', 'gaitScores']],
      [2, ['temperament', 'gaitScores']],
      [3, ['gaitScores']],
    ]);
    expect(skipped[0].reason).toBe('horse has no breed');
    expect(skipped[1].reason).toContain(noRangesName);
  });

  it('leaves a horse with both values alone', () => {
    expect(
      planTemperamentGaitBackfill([
        { id: 1, name: 'a', breedName: 'Thoroughbred', temperament: 'Calm', gaitScores: {} },
      ]),
    ).toEqual({ updates: [], skipped: [] });
  });
});

describe('runTemperamentGaitBackfill (real database, planted horses only)', () => {
  it('finds no NULL to fill, in a dry run or applied, and changes no row', async () => {
    const tb = await plant('tb', breeds.thoroughbred.id, { temperament: 'Calm' });
    const asb = await plant('asb', breeds.saddlebred.id, { temperament: 'Driven' });
    const ids = [tb, asb];
    const before = await Promise.all(ids.map(read));

    for (const dryRun of [true, false]) {
      const run = await runTemperamentGaitBackfill({ dryRun, horseIds: ids });
      expect(run).toMatchObject({
        rolledBack: dryRun,
        before: { nullTemperament: 0, nullGaitScores: 0 },
        temperamentFilled: 0,
        gaitScoresFilled: 0,
        after: { nullTemperament: 0, nullGaitScores: 0 },
        skipped: [],
      });
      expect(await Promise.all(ids.map(read))).toEqual(before);
    }
  });
});
