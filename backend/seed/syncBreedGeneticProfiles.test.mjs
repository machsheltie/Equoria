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
import {
  defaultBreedProfilesJson,
  findSourceJsonDrift,
  loadBreedSourceProfiles,
  parseBreedSourceFile,
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

  it('loads all 312 breed files and they agree with breedProfiles.json', async () => {
    expect(sources.size).toBe(312);
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

  it('refuses an empty profile map', async () => {
    await expect(syncBreedGeneticProfiles(prisma, { profiles: new Map() })).rejects.toThrow(/non-empty Map/);
  });
});
