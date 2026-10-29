/**
 * One-time re-score of the flat-20 conformation placeholder (Equoria-vqz4b).
 *
 * Owner ruling 2026-10-28, q208: "Yes, re-score all 5 from their breed ranges". Horses
 * whose conformationScores is still exactly the flat-20 column default get the same
 * breed-range roll a new store horse gets; every other horse is untouched, gaits are
 * never touched, and a breed with no conformation ranges is listed, never guessed.
 *
 * Drives the real script's exported core against the real database, scoped to horses
 * this file plants (so no other horse row is read or written).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../packages/database/prismaClient.mjs';
import { generateConformationScores } from '../modules/horses/services/conformationService.mjs';
import {
  flatConformationPlaceholder,
  planBreedConformationBackfill,
  runBreedConformationBackfill,
} from '../scripts/backfill-horse-breed-conformation.mjs';
import { createTestHorse } from './helpers/createTestHorse.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';
import { seededRng } from './helpers/seededRng.mjs';

const tag = `TestFixture-vqz4b-${randomBytes(4).toString('hex')}`;
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

const regions = ['head', 'neck', 'shoulders', 'back', 'hindquarters', 'legs', 'hooves', 'topline'];
const placeholder = { ...flatConformationPlaceholder };
const ownGaits = { walk: 61, trot: 62, canter: 63, gallop: 64, gaiting: null };

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
      dateOfBirth: new Date('2020-01-01'),
      gaitScores: ownGaits,
      // Equoria-576c0.5: `null` plants a breedless horse (the fixture helper otherwise gives one a breed).
      breedId,
      ...data,
    },
    horseIds,
  );
  return horse.id;
}

const read = id =>
  prisma.horse.findUnique({
    where: { id },
    select: { conformationScores: true, gaitScores: true },
  });

function expectBreedRolled(scores) {
  expect(Object.keys(scores).sort()).toEqual([...regions, 'overallConformation'].sort());
  for (const region of regions) {
    expect(Number.isInteger(scores[region])).toBe(true);
    expect(scores[region]).toBeGreaterThanOrEqual(0);
    expect(scores[region]).toBeLessThanOrEqual(100);
  }
  const mean = Math.round(regions.reduce((sum, r) => sum + scores[r], 0) / regions.length);
  expect(scores.overallConformation).toBe(mean);
  expect(scores).not.toEqual(placeholder);
}

beforeAll(async () => {
  breeds.thoroughbred = await breedNamed('Thoroughbred');
  breeds.saddlebred = await breedNamed('American Saddlebred');
  // A breed with no profile anywhere: no conformation ranges.
  breeds.noRanges = await breedNamed(`${tag}-NoRangesBreed`);
});

afterAll(async () => {
  await cleanup.run();
}, 30000);

describe('planBreedConformationBackfill', () => {
  it('rolls conformation with the same generator a new store horse gets', () => {
    for (const [breedName, seed] of [
      ['Thoroughbred', 21],
      ['American Saddlebred', 22],
    ]) {
      const { updates, skipped } = planBreedConformationBackfill([{ id: 1, name: 'x', breedName }], {
        random: seededRng(seed),
      });
      expect(skipped).toEqual([]);
      expect(updates).toEqual([
        { id: 1, conformationScores: generateConformationScores(breedName, { random: seededRng(seed) }) },
      ]);
    }
  });

  it('never guesses: no breed, or a breed with no ranges, is listed and not rolled', () => {
    const noRangesName = `${tag}-NoRangesBreed`;
    const { updates, skipped } = planBreedConformationBackfill([
      { id: 1, name: 'a', breedName: null },
      { id: 2, name: 'b', breedName: noRangesName },
    ]);
    expect(updates).toEqual([]);
    expect(skipped.map(s => s.id)).toEqual([1, 2]);
    expect(skipped[0].reason).toBe('horse has no breed');
    expect(skipped[1].reason).toContain(noRangesName);
  });
});

describe('runBreedConformationBackfill (real database, planted horses only)', () => {
  it('dry run re-scores every placeholder inside the transaction, then rolls it all back', async () => {
    const tb = await plant('dry-tb', breeds.thoroughbred.id);
    const asb = await plant('dry-asb', breeds.saddlebred.id);
    const noBreed = await plant('dry-no-breed', null);
    const noRanges = await plant('dry-no-ranges', breeds.noRanges.id);
    const ids = [tb, asb, noBreed, noRanges];
    for (const id of ids) {
      expect((await read(id)).conformationScores).toEqual(placeholder);
    }

    const dry = await runBreedConformationBackfill({ dryRun: true, horseIds: ids });
    expect(dry.rolledBack).toBe(true);
    expect(dry.placeholdersBefore).toBe(4);
    expect(dry.rescored.map(r => r.id).sort((a, b) => a - b)).toEqual([tb, asb].sort((a, b) => a - b));
    expect(dry.placeholdersAfter).toBe(2);
    expect(dry.skipped.map(s => s.id).sort((a, b) => a - b)).toEqual([noBreed, noRanges].sort((a, b) => a - b));

    for (const id of ids) {
      expect(await read(id)).toEqual({ conformationScores: placeholder, gaitScores: ownGaits });
    }
  });

  it('apply re-scores placeholders from the breed, leaves every other horse alone, and a second run changes nothing', async () => {
    const tb = await plant('apply-tb', breeds.thoroughbred.id);
    const asb = await plant('apply-asb', breeds.saddlebred.id);
    const noRanges = await plant('apply-no-ranges', breeds.noRanges.id);
    const real = { ...placeholder, head: 74, overallConformation: 26 };
    const notPlaceholder = await plant('apply-real', breeds.thoroughbred.id, { conformationScores: real });
    // Flat 20 in every region but with an extra key is not the placeholder.
    const extraKey = { ...placeholder, note: 'kept' };
    const withExtraKey = await plant('apply-extra-key', breeds.thoroughbred.id, {
      conformationScores: extraKey,
    });
    const ids = [tb, asb, noRanges, notPlaceholder, withExtraKey];

    const wet = await runBreedConformationBackfill({ dryRun: false, horseIds: ids });
    expect(wet).toMatchObject({ rolledBack: false, placeholdersBefore: 3, placeholdersAfter: 1 });
    expect(wet.rescored.map(r => r.id).sort((a, b) => a - b)).toEqual([tb, asb].sort((a, b) => a - b));

    const tbRow = await read(tb);
    const asbRow = await read(asb);
    for (const row of [tbRow, asbRow]) {
      expectBreedRolled(row.conformationScores);
      expect(row.gaitScores).toEqual(ownGaits);
    }
    expect(tbRow.conformationScores).toEqual(wet.rescored.find(r => r.id === tb).conformationScores);

    expect(await read(noRanges)).toEqual({ conformationScores: placeholder, gaitScores: ownGaits });
    expect(await read(notPlaceholder)).toEqual({ conformationScores: real, gaitScores: ownGaits });
    expect(await read(withExtraKey)).toEqual({ conformationScores: extraKey, gaitScores: ownGaits });

    const again = await runBreedConformationBackfill({ dryRun: false, horseIds: ids });
    expect(again).toMatchObject({ placeholdersBefore: 1, placeholdersAfter: 1, rescored: [] });
    expect(await read(tb)).toEqual(tbRow);
    expect(await read(asb)).toEqual(asbRow);
  });

  it('a seeded run writes exactly the breed roll', async () => {
    const asb = await plant('seeded-asb', breeds.saddlebred.id);
    await runBreedConformationBackfill({ dryRun: false, horseIds: [asb], random: seededRng(7) });
    expect((await read(asb)).conformationScores).toEqual(
      generateConformationScores('American Saddlebred', { random: seededRng(7) }),
    );
  });
});
