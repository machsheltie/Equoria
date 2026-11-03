/**
 * syncBreedGeneticProfiles.test.mjs (Equoria-hxhqk)
 *
 * Real-DB coverage for the production breedGeneticProfile sync. The sync is
 * driven with profiles named after this suite's own fixture breeds, so it
 * reads and writes only rows this file created. The source-file loader and
 * the .txt-vs-JSON cross-check run against the real shipped data files.
 *
 * NO MOCKS — real Prisma, real Postgres jsonb comparison and UPDATE.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import prisma from '../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../__tests__/helpers/failLoudCleanup.mjs';
import { createTestHorse, cleanupTestHorses } from '../__tests__/helpers/createTestHorse.mjs';
import {
  defaultBreedProfilesJson,
  findSourceJsonDrift,
  loadBreedSourceProfiles,
  parseBreedSourceFile,
  removeRetiredBreeds,
  retiredBreedNames,
  syncBreedGeneticProfiles,
} from './syncBreedGeneticProfiles.mjs';

const tag = randomBytes(5).toString('hex');
const nullName = `TestFixture-BreedSync-${tag}-null`;
const staleName = `TestFixture-BreedSync-${tag}-stale`;
const syncedName = `TestFixture-BreedSync-${tag}-synced`;
const untouchedName = `TestFixture-BreedSync-${tag}-untouched`;
const absentName = `TestFixture-BreedSync-${tag}-absent`;

describe('syncBreedGeneticProfiles (Equoria-hxhqk)', () => {
  const cleanup = createCleanupTracker();
  let sources;
  let profileA;
  let profileB;

  beforeAll(async () => {
    sources = await loadBreedSourceProfiles();
    profileA = sources.get('Abaga');
    profileB = sources.get('Arabian');

    cleanup.add(
      () => prisma.breed.deleteMany({ where: { name: { startsWith: `TestFixture-BreedSync-${tag}-` } } }),
      'fixture breeds',
    );
    await prisma.breed.create({ data: { name: nullName, description: 'keep me', defaultTrait: 'keepTrait' } });
    await prisma.breed.create({ data: { name: staleName, breedGeneticProfile: profileB } });
    await prisma.breed.create({ data: { name: syncedName, breedGeneticProfile: profileA } });
    await prisma.breed.create({
      data: { name: untouchedName, description: 'not in sources', breedGeneticProfile: { marker: true } },
    });
  });

  afterAll(() => cleanup.run(), 60000);

  // Old contract: 312 breed files. Owner ruling q337 (2026-11-03): keep
  // 'Tennessee Walking Horse' and remove the duplicate 'Tennessee Walking'.
  it('loads all 311 breed files and they agree with breedProfiles.json', async () => {
    expect(sources.size).toBe(311);
    expect(sources.has('Tennessee Walking')).toBe(false);
    expect(sources.has('Tennessee Walking Horse')).toBe(true);
    const json = JSON.parse(readFileSync(defaultBreedProfilesJson, 'utf8'));
    expect(findSourceJsonDrift(sources, json)).toEqual([]);
    // Full profile, not just the JSON subset: color genetics come along.
    expect(Object.keys(profileA)).toEqual(
      expect.arrayContaining(['alleleWeights', 'shadeBias', 'markingBias', 'ratingProfiles', 'temperamentWeights']),
    );
  });

  it('applies the same Pearl/Brindle case normalization as the seed importer', () => {
    const { profile } = parseBreedSourceFile(
      [
        'INSERT INTO breeds (name, default_trait, breed_genetic_profile) VALUES',
        "('X', 'Trait', $json$",
        '{"allowedAlleles":{"Prl_Pearl":["N/N"],"BR1_Brindle1":["N/BR1"],"MFSD12_Mushroom":["N/N"]},',
        '"ratingProfiles":{},"temperamentWeights":{}}',
        '$json$::JSONB);',
      ].join('\n'),
      'inline',
    );
    expect(profile.allowedAlleles).toEqual({
      Prl_Pearl: ['n/n'],
      BR1_Brindle1: ['br1/n'],
      MFSD12_Mushroom: ['N/N'],
    });
  });

  it('reports drift when a .txt profile and the JSON disagree', () => {
    const json = { Abaga: { ...profileA, temperamentWeights: { Calm: 100 } }, Extra: profileA };
    const drift = findSourceJsonDrift(new Map([['Abaga', profileA]]), json);
    expect(drift).toEqual([
      '"Abaga" temperamentWeights differs between its .txt file and breedProfiles.json',
      '"Extra" is in breedProfiles.json but has no .txt file',
    ]);
  });

  it('dry run reports, writes nothing; apply updates only the profile; second apply changes 0 rows', async () => {
    const profiles = new Map([
      [nullName, profileA],
      [staleName, profileA],
      [syncedName, profileA],
      [absentName, profileA],
    ]);
    const dry = await syncBreedGeneticProfiles(prisma, { profiles });
    expect(dry.apply).toBe(false);
    expect(dry.changed).toEqual([nullName, staleName].sort());
    expect(dry.alreadyInSync).toBe(1);
    expect(dry.missingInDb).toEqual([absentName]);
    expect(dry.dbWithoutSource).toContain(untouchedName);
    const afterDry = await prisma.breed.findUnique({ where: { name: nullName } });
    expect(afterDry.breedGeneticProfile).toBeNull();

    const first = await syncBreedGeneticProfiles(prisma, { profiles, apply: true });
    expect(first.changed).toEqual([nullName, staleName].sort());
    expect(first.missingInDb).toEqual([absentName]);

    const nullRow = await prisma.breed.findUnique({ where: { name: nullName } });
    expect(nullRow.breedGeneticProfile).toEqual(profileA);
    expect(nullRow.description).toBe('keep me');
    expect(nullRow.defaultTrait).toBe('keepTrait');
    expect((await prisma.breed.findUnique({ where: { name: staleName } })).breedGeneticProfile).toEqual(profileA);
    const untouched = await prisma.breed.findUnique({ where: { name: untouchedName } });
    expect(untouched.breedGeneticProfile).toEqual({ marker: true });
    expect(untouched.description).toBe('not in sources');
    expect(await prisma.breed.findUnique({ where: { name: absentName } })).toBeNull();

    const second = await syncBreedGeneticProfiles(prisma, { profiles, apply: true });
    expect(second.changed).toEqual([]);
    expect(second.alreadyInSync).toBe(3);
  });

  // Equoria-rd1ed: production's breeds came from an older name list, so three
  // seed-file breeds never got a row and the sync (update-only) could not add
  // them. insertMissing adds a file breed that has no row, from its file.
  it('insertMissing: dry run lists, apply inserts name + defaultTrait + profile, second apply inserts 0', async () => {
    const newName = `TestFixture-BreedSync-${tag}-new`;
    const rows = new Map([
      [syncedName, { defaultTrait: 'Endurance', profile: profileA }],
      [newName, { defaultTrait: 'Gaited', profile: profileB }],
    ]);
    const profiles = new Map([...rows].map(([n, r]) => [n, r.profile]));
    const defaultTraits = new Map([...rows].map(([n, r]) => [n, r.defaultTrait]));

    const dry = await syncBreedGeneticProfiles(prisma, { profiles, defaultTraits, insertMissing: true });
    expect(dry.inserted).toEqual([newName]);
    expect(dry.missingInDb).toEqual([newName]);
    expect(await prisma.breed.findUnique({ where: { name: newName } })).toBeNull();

    const first = await syncBreedGeneticProfiles(prisma, {
      profiles,
      defaultTraits,
      insertMissing: true,
      apply: true,
    });
    expect(first.inserted).toEqual([newName]);
    expect(first.missingInDb).toEqual([]);
    const row = await prisma.breed.findUnique({ where: { name: newName } });
    expect(row.defaultTrait).toBe('Gaited');
    expect(row.breedGeneticProfile).toEqual(profileB);

    const second = await syncBreedGeneticProfiles(prisma, {
      profiles,
      defaultTraits,
      insertMissing: true,
      apply: true,
    });
    expect(second.inserted).toEqual([]);
    expect(second.changed).toEqual([]);
    expect(second.missingInDb).toEqual([]);
  });

  it('insertMissing never inserts a breed whose name differs from a DB row only by accents or case', async () => {
    // Production held 'Taishu horse' while the file says 'Taishū horse'.
    const asciiName = `TestFixture-BreedSync-${tag}-Taishu horse`;
    const accentedName = `TestFixture-BreedSync-${tag}-Taishū HORSE`;
    await prisma.breed.create({ data: { name: asciiName } });
    const profiles = new Map([[accentedName, profileA]]);
    const defaultTraits = new Map([[accentedName, 'Endurance']]);

    const r = await syncBreedGeneticProfiles(prisma, {
      profiles,
      defaultTraits,
      insertMissing: true,
      apply: true,
    });
    expect(r.inserted).toEqual([]);
    expect(r.nearDuplicates).toEqual([{ file: accentedName, db: asciiName }]);
    expect(await prisma.breed.findUnique({ where: { name: accentedName } })).toBeNull();
  });

  it('insertMissing requires a defaultTrait for every breed it would insert', async () => {
    const lonely = `TestFixture-BreedSync-${tag}-nodefault`;
    await expect(
      syncBreedGeneticProfiles(prisma, {
        profiles: new Map([[lonely, profileA]]),
        defaultTraits: new Map(),
        insertMissing: true,
      }),
    ).rejects.toThrow(/defaultTrait/);
  });

  it('loads each file breed with its defaultTrait', async () => {
    const { loadBreedSourceRows } = await import('./syncBreedGeneticProfiles.mjs');
    const rowsBySource = await loadBreedSourceRows();
    expect(rowsBySource.size).toBe(311);
    expect(rowsBySource.get('Tennessee Walking Horse').defaultTrait).toBe('Gaited');
    expect(rowsBySource.get('Taishū horse').defaultTrait).toBe('Endurance');
    expect(rowsBySource.get('Pony Of The Americas').defaultTrait).toBe('Gymkhana');
    expect(rowsBySource.get('Abaga').profile).toEqual(profileA);
  });

  // Equoria-rd1ed, owner ruling q337 (2026-11-03): remove the duplicate
  // 'Tennessee Walking' breed row; never delete a row a horse still uses.
  describe('removeRetiredBreeds', () => {
    const horseIds = [];
    const unusedName = `TestFixture-BreedSync-${tag}-retired-unused`;
    const usedName = `TestFixture-BreedSync-${tag}-retired-used`;
    const retiredNames = [unusedName, usedName];

    beforeAll(async () => {
      await prisma.breed.create({ data: { name: unusedName } });
      const used = await prisma.breed.create({ data: { name: usedName } });
      await createTestHorse(
        prisma,
        { name: `TestFixture-BreedSync-${tag}-horse`, sex: 'Mare', dateOfBirth: new Date(), breedId: used.id },
        horseIds,
      );
    });

    afterAll(() => cleanupTestHorses(prisma, horseIds), 30000);

    it('names exactly the duplicate Tennessee Walking', () => {
      expect(retiredBreedNames).toEqual(['Tennessee Walking']);
    });

    it('dry run lists, apply deletes only rows no horse uses, second apply deletes 0', async () => {
      const dry = await removeRetiredBreeds(prisma, { profiles: sources, retiredNames });
      expect(dry.removed).toEqual([unusedName]);
      expect(dry.inUse).toEqual([{ name: usedName, horses: 1 }]);
      expect(await prisma.breed.findUnique({ where: { name: unusedName } })).not.toBeNull();

      const first = await removeRetiredBreeds(prisma, { profiles: sources, retiredNames, apply: true });
      expect(first.removed).toEqual([unusedName]);
      expect(first.inUse).toEqual([{ name: usedName, horses: 1 }]);
      expect(await prisma.breed.findUnique({ where: { name: unusedName } })).toBeNull();
      expect(await prisma.breed.findUnique({ where: { name: usedName } })).not.toBeNull();

      const second = await removeRetiredBreeds(prisma, { profiles: sources, retiredNames, apply: true });
      expect(second.removed).toEqual([]);
    });

    it('refuses a retired name that still has a breed file', async () => {
      await expect(
        removeRetiredBreeds(prisma, { profiles: sources, retiredNames: ['Abaga'], apply: true }),
      ).rejects.toThrow(/still have a .txt file: Abaga/);
      expect(await prisma.breed.findUnique({ where: { name: 'Abaga' } })).not.toBeNull();
    });
  });

  it('refuses an empty profile map', async () => {
    await expect(syncBreedGeneticProfiles(prisma, { profiles: new Map() })).rejects.toThrow(/non-empty Map/);
  });
});
