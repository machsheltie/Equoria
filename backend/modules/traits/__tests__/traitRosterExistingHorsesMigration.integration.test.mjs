/**
 * Existing horses move to the twenty-trait roster (owner ruling 2026-10-27,
 * q136; Equoria-2d55z): bold -> brave, social -> outgoing, antisocial -> aloof,
 * nervous -> skittish, bonded -> affectionate; every other off-roster trait is
 * removed; a trait keeps its revealed/active state; a horse that already
 * carries the target is never given a duplicate.
 *
 * This runs the real migration SQL against the real test database inside a
 * transaction that is always rolled back, so the global UPDATE never keeps a
 * change to another suite's rows. Fixtures are created and removed here.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestHorse, cleanupTestHorses } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const migrationSql = readFileSync(
  path.resolve(
    HERE,
    '../../../../packages/database/prisma/migrations/20261027140000_trait_roster_existing_horses/migration.sql',
  ),
  'utf8',
);
const RUN = randomBytes(4).toString('hex');
const emptyUltraRare = { ultraRare: [], exotic: [] };
const horseIds = [];
const fixtures = {};

class RollBack extends Error {}

const SELECT = {
  id: true,
  epigeneticModifiers: true,
  epigeneticFlags: true,
  trait: true,
  ultraRareTraits: true,
};

async function horse(label, data) {
  fixtures[label] = await createTestHorse(
    prisma,
    {
      name: `TestFixture-traitRoster-${RUN}-${label}`,
      sex: 'Mare',
      dateOfBirth: new Date('2020-01-01T12:00:00Z'),
      ...data,
    },
    horseIds,
  );
}

/** Run the migration `times` times in one transaction, read the fixtures after each run, roll back. */
async function afterMigration(times = 1) {
  const runs = [];
  await expect(
    prisma.$transaction(
      async tx => {
        const ctidBefore = await tx.$queryRaw`
          SELECT "id", ctid::text AS ctid FROM "horses" WHERE "id" = ANY(${horseIds})`;
        for (let i = 0; i < times; i++) {
          await tx.$executeRawUnsafe(migrationSql);
          const rows = await tx.horse.findMany({ where: { id: { in: horseIds } }, select: SELECT });
          const ctid = await tx.$queryRaw`
            SELECT "id", ctid::text AS ctid FROM "horses" WHERE "id" = ANY(${horseIds})`;
          runs.push({
            byLabel: Object.fromEntries(
              Object.entries(fixtures).map(([label, f]) => [label, rows.find(r => r.id === f.id)]),
            ),
            ctid: new Map(ctid.map(r => [r.id, r.ctid])),
          });
        }
        runs.ctidBefore = new Map(ctidBefore.map(r => [r.id, r.ctid]));
        throw new RollBack();
      },
      { timeout: 60_000, maxWait: 30_000 },
    ),
  ).rejects.toBeInstanceOf(RollBack);
  return runs;
}

beforeAll(async () => {
  await horse('mapped', {
    epigeneticModifiers: {
      positive: ['bold', 'bonded', 'confident', 'disciplineAffinityDressage'],
      negative: ['antisocial', 'nervous', 'fragile'],
      hidden: ['social', 'calm', 'legendaryBloodline', 'heart'],
      revealEvaluatedThroughDay: 7,
    },
    epigeneticFlags: ['BRAVE', 'SOCIAL', 'CALM', 'aloof'],
    trait: 'Speed Demon',
    ultraRareTraits: { ultraRare: [{ name: 'phoenixBorn' }], exotic: [] },
  });
  await horse('duplicates', {
    epigeneticModifiers: {
      // The horse already carries brave (hidden) and skittish (active):
      // the mapped bold and nervous are dropped, never doubled.
      positive: ['bold'],
      negative: ['nervous', 'skittish'],
      hidden: ['brave', 'social', 'outgoing', 'outgoing'],
    },
    epigeneticFlags: ['bold', 'brave', 'nervous', 'BRAVE'],
    trait: 'Bold',
  });
  await horse('respelled', {
    epigeneticModifiers: {
      // Active but filed under the wrong polarity, and legacy spellings.
      positive: [],
      negative: ['bold', 'People Trusting'],
      hidden: ['EAGERLEARNER', 'Nervous'],
    },
  });
  await horse('canonical', {
    epigeneticModifiers: { positive: ['brave'], negative: ['aloof'], hidden: ['heart'] },
    epigeneticFlags: ['brave'],
    trait: null,
    ultraRareTraits: emptyUltraRare,
  });
}, 60_000);

afterAll(async () => {
  const cleanup = createCleanupTracker();
  cleanup.add(() => cleanupTestHorses(prisma, horseIds), 'horses');
  await cleanup.run();
}, 60_000);

describe('trait roster migration for existing horses (q136)', () => {
  it('maps the five old names, keeps each state, removes every other off-roster trait', async () => {
    const [{ byLabel }] = await afterMigration();
    const mapped = byLabel.mapped;
    expect(mapped.epigeneticModifiers).toEqual({
      positive: ['brave', 'affectionate', 'confident', 'disciplineAffinityDressage'],
      negative: ['aloof', 'skittish', 'fragile'],
      hidden: ['outgoing', 'heart'],
      revealEvaluatedThroughDay: 7,
    });
    expect(mapped.epigeneticFlags).toEqual(['brave', 'outgoing', 'aloof']);
    expect(mapped.trait).toBeNull();
    expect(mapped.ultraRareTraits).toEqual(emptyUltraRare);
  }, 60_000);

  it('never creates a duplicate: a trait the horse already carries keeps its own state', async () => {
    const [{ byLabel }] = await afterMigration();
    expect(byLabel.duplicates.epigeneticModifiers).toEqual({
      positive: [],
      negative: ['skittish'],
      hidden: ['brave', 'outgoing'],
    });
    expect([...byLabel.duplicates.epigeneticFlags].sort()).toEqual(['brave', 'skittish']);
    expect(byLabel.duplicates.trait).toBe('brave');
  }, 60_000);

  it('stores the camelCase id and files an active trait under its ruled polarity', async () => {
    const [{ byLabel }] = await afterMigration();
    expect(byLabel.respelled.epigeneticModifiers).toEqual({
      positive: ['brave', 'peopleTrusting'],
      negative: [],
      hidden: ['eagerLearner', 'skittish'],
    });
  }, 60_000);

  it('leaves a horse whose traits are already on the roster untouched', async () => {
    const runs = await afterMigration();
    const id = fixtures.canonical.id;
    expect(runs[0].ctid.get(id)).toBe(runs.ctidBefore.get(id));
    expect(runs[0].byLabel.canonical).toMatchObject({
      epigeneticModifiers: { positive: ['brave'], negative: ['aloof'], hidden: ['heart'] },
      epigeneticFlags: ['brave'],
      trait: null,
      ultraRareTraits: emptyUltraRare,
    });
  }, 60_000);

  it('is idempotent: a second run changes no fixture row', async () => {
    const [first, second] = await afterMigration(2);
    expect(second.byLabel).toEqual(first.byLabel);
    for (const id of horseIds) {
      expect(second.ctid.get(id)).toBe(first.ctid.get(id));
    }
  }, 60_000);
});
