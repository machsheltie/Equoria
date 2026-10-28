/**
 * The discipline trait for horses made before it existed (Equoria-n7ph5). What it is worth
 * at a show: modules/competition/__tests__/disciplineTraitFlatPoints.integration.test.mjs.
 *
 * Owner rulings 2026-10-20 (round 2 Q4, answer A) and 2026-10-21: every horse has exactly
 * one discipline trait, always visible, worth +5 at every show in that discipline, added
 * to the base score BEFORE the luck, rider, temperament and health percentages (tack and
 * trait bonuses are flat points). Existing horses get their breed's default (the approved
 * q232 list in breeds.defaultTrait; gaited breeds are always Gaited).
 *
 * The backfill is the migration 20261029020100_existing_horses_breed_discipline, run here
 * from its own file inside a transaction that is rolled back, so no row outside this
 * test's fixtures is changed.
 *
 * Real DB, no mocks.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { breedDefaultDiscipline } from '../services/birthDiscipline.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION = resolve(
  HERE,
  '../../../../packages/database/prisma/migrations/20261029020100_existing_horses_breed_discipline/migration.sql',
);
const TAG = `TestFixture-n7ph5-${randomBytes(4).toString('hex')}`;

class Rollback extends Error {}

let ridingBreed; // a non-gaited breed with an approved default
let gaitedBreed;

beforeAll(async () => {
  const breeds = await prisma.breed.findMany({
    select: { id: true, name: true, defaultTrait: true, breedGeneticProfile: true },
    orderBy: { id: 'asc' },
  });
  ridingBreed = breeds.find(b => {
    const d = breedDefaultDiscipline(b);
    return d !== null && d !== 'Gaited' && d !== 'Racing';
  });
  gaitedBreed = breeds.find(b => breedDefaultDiscipline(b) === 'Gaited');
  if (!ridingBreed || !gaitedBreed) {
    throw new Error('needs the seeded breeds with their approved defaults; refusing to skip.');
  }
});

describe('existing horses get their breed default discipline at +5 (migration backfill)', () => {
  it('fills only the horses that hold no discipline, with the breed default key, and is idempotent', async () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    const ridingDefault = breedDefaultDiscipline(ridingBreed);
    let seen;

    await expect(
      prisma.$transaction(
        async tx => {
          const make = (label, breedId, disciplineScores) =>
            tx.horse.create({
              data: {
                ...fixtureColor(),
                name: `${TAG}-${label}`,
                sex: 'Mare',
                dateOfBirth: gameCalendarDate(new Date(), -5 * 365),
                breedId,
                ...(disciplineScores === undefined ? {} : { disciplineScores }),
              },
              select: { id: true },
            });
          const none = await make('none', ridingBreed.id, undefined);
          const empty = await make('empty', ridingBreed.id, {});
          // A zero and a key outside the 24 are no discipline; both are kept.
          const zeroAndStray = await make('zero', ridingBreed.id, { [ridingDefault]: 0, Trail: 3 });
          const trained = await make('trained', ridingBreed.id, { Racing: 10 });
          const gaited = await make('gaited', gaitedBreed.id, undefined);
          const noBreed = await make('nobreed', null, undefined);

          await tx.$executeRawUnsafe(sql);
          const read = async () =>
            Object.fromEntries(
              (
                await tx.horse.findMany({
                  where: { name: { startsWith: TAG } },
                  select: { name: true, disciplineScores: true },
                })
              ).map(h => [h.name.slice(TAG.length + 1), h.disciplineScores]),
            );
          const first = await read();
          await tx.$executeRawUnsafe(sql);
          seen = { first, second: await read(), ids: [none, empty, zeroAndStray, trained, gaited, noBreed] };
          throw new Rollback('roll back the backfill and the fixtures');
        },
        { timeout: 60000 },
      ),
    ).rejects.toBeInstanceOf(Rollback);

    expect(seen.first).toEqual({
      none: { [ridingDefault]: 5 },
      empty: { [ridingDefault]: 5 },
      zero: { [ridingDefault]: 5, Trail: 3 },
      trained: { Racing: 10 },
      gaited: { Gaited: 5 },
      nobreed: null,
    });
    expect(seen.second).toEqual(seen.first);
    // Rolled back: none of the fixtures exist.
    await expect(prisma.horse.count({ where: { name: { startsWith: TAG } } })).resolves.toBe(0);
  }, 90000);
});
