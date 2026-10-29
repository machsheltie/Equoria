/**
 * Breed odds and other players' genetics never leave the server (Equoria-9kakx).
 *
 * Owner ruling 2026-10-29 (q274): "the player gets to see the listed color name
 * and markings and temperament but none of the odds or genetics behind it. A
 * player can go to the vet and pay to get their horses color genetics profile.
 * That is the only way color genetics are revealed. They get no color shade
 * markings or temperament odds."
 *
 * The leaks this pins: GET /breeds/:id (public, before login) and GET /horses/:id
 * (its joined breed row) sent the breed's whole breedGeneticProfile: allele
 * weights, shade and marking bias, temperament weights. The game admin (owner or
 * admin role) still gets everything.
 *
 * Owner rulings 2026-10-29: q292 took the breed stat bars out of the breed
 * picker, the only player reader of the profile's ratingProfiles, so no part of
 * the profile is sent to a player now (old contract: { ratingProfiles } was
 * kept). q294: the game admin sees every colour genotype, tested or not (old
 * contract: an untested genotype was hidden from the admin too); moderators and
 * players are unchanged.
 *
 * Real app, real database, real auth; fixtures (a breed, users, horses) are this
 * file's own and are removed afterwards.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { withoutHiddenGenotype } from '../../../utils/publicGenotypeView.mjs';
import { withoutBreedOdds } from '../../../utils/publicBreedProfileView.mjs';

const fixturePrefix = 'TestFixture-breedOdds-9kakx';
const genotype = { E_Extension: 'E/e', A_Agouti: 'A/a' };
const ratingProfiles = {
  conformation: { head: { mean: 70, stdDev: 5 } },
  gaits: { walk: { mean: 65, stdDev: 6 } },
};
const fullProfile = {
  ratingProfiles,
  alleleWeights: { E_Extension: { 'E/e': 0.5, 'e/e': 0.5 } },
  allowedAlleles: { E_Extension: ['E', 'e'] },
  disallowedCombinations: { W: ['W/W'] },
  shadeBias: { Bay: { light: 0.2, standard: 0.6, dark: 0.2 } },
  markingBias: { face: { none: 0.5, star: 0.5 } },
  advancedMarkingsBias: { frost: 0.01 },
  booleanModifiersPrevalence: { sooty: 0.3 },
  temperamentWeights: { Calm: 40, Spirited: 60 },
};

let breed;
let ownerToken;
let adminToken;
let moderatorToken;
let ownHorse;
let adminHorse;
let adminUntestedHorse;
let moderatorUntestedHorse;

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');
  breed = await prisma.breed.create({
    data: {
      name: `${fixturePrefix}-${tag}`,
      description: 'Equoria-9kakx fixture breed',
      breedGeneticProfile: fullProfile,
    },
  });
  const ownerCreated = await createTestUser({
    username: `${fixturePrefix}-owner-${tag}`,
    email: `${fixturePrefix}-owner-${tag}@example.com`,
  });
  const owner = ownerCreated.user;
  ownerToken = ownerCreated.token;
  const admin = (
    await createTestUser({
      username: `${fixturePrefix}-admin-${tag}`,
      email: `${fixturePrefix}-admin-${tag}@example.com`,
      role: 'admin',
    })
  ).user;
  adminToken = generateTestToken({ id: admin.id, role: 'admin' });
  const moderator = (
    await createTestUser({
      username: `${fixturePrefix}-mod-${tag}`,
      email: `${fixturePrefix}-mod-${tag}@example.com`,
      role: 'moderator',
    })
  ).user;
  moderatorToken = generateTestToken({ id: moderator.id, role: 'moderator' });

  ownHorse = await createTestHorse({
    name: `${fixturePrefix}-own-${tag}`,
    userId: owner.id,
    breed: { connect: { id: breed.id } },
    colorGenotype: genotype,
    colorGeneticsTested: true,
  });
  adminHorse = await createTestHorse({
    name: `${fixturePrefix}-admin-${tag}`,
    userId: admin.id,
    breed: { connect: { id: breed.id } },
  });
  adminUntestedHorse = await createTestHorse({
    name: `${fixturePrefix}-adminUntested-${tag}`,
    userId: admin.id,
    breed: { connect: { id: breed.id } },
    colorGenotype: genotype,
    colorGeneticsTested: false,
  });
  moderatorUntestedHorse = await createTestHorse({
    name: `${fixturePrefix}-modUntested-${tag}`,
    userId: moderator.id,
    breed: { connect: { id: breed.id } },
    colorGenotype: genotype,
    colorGeneticsTested: false,
  });
}, 120000);

afterAll(async () => {
  await cleanupTestData();
  if (breed) {
    await prisma.breed.delete({ where: { id: breed.id } });
  }
});

const withToken = (path, token) =>
  request(app).get(path).set('Authorization', `Bearer ${token}`).set('Origin', 'http://localhost:3000');

describe('breed odds are not sent to players', () => {
  it('GET /breeds/:id sends no genetic profile at all, to anyone', async () => {
    const res = await request(app).get(`/api/v1/breeds/${breed.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe(breed.name);
    expect(res.body.data).not.toHaveProperty('breedGeneticProfile');

    // Public, HTTP-cacheable reference data: the admin gets the same body.
    const asAdmin = await withToken(`/api/v1/breeds/${breed.id}`, adminToken);
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.data).not.toHaveProperty('breedGeneticProfile');
  });

  it('GET /breeds sends no genetic profile (no stat ranges for the breed picker)', async () => {
    const res = await request(app).get('/api/v1/breeds');
    expect(res.status).toBe(200);
    const row = res.body.data.find(b => b.id === breed.id);
    expect(row).toBeDefined();
    expect(row).not.toHaveProperty('breedGeneticProfile');
    expect(JSON.stringify(res.body)).not.toContain('ratingProfiles');
  });

  it('GET /horses/:id sends the joined breed without its profile', async () => {
    const res = await withToken(`/api/v1/horses/${ownHorse.id}`, ownerToken);
    expect(res.status).toBe(200);
    expect(res.body.data.breed.name).toBe(breed.name);
    expect(res.body.data.breed).not.toHaveProperty('breedGeneticProfile');
  });

  it('a moderator gets no breed profile either', async () => {
    const res = await withToken(`/api/v1/horses/${moderatorUntestedHorse.id}`, moderatorToken);
    expect(res.status).toBe(200);
    expect(res.body.data.breed).not.toHaveProperty('breedGeneticProfile');
  });

  it('the game admin still gets the whole profile', async () => {
    const res = await withToken(`/api/v1/horses/${adminHorse.id}`, adminToken);
    expect(res.status).toBe(200);
    expect(res.body.data.breed.breedGeneticProfile).toEqual(fullProfile);
  });

  it('withoutBreedOdds removes every profile at any depth without mutating the input', () => {
    const row = { id: 1, breed: { id: 2, breedGeneticProfile: fullProfile } };
    const body = { data: [row, { breedGeneticProfile: 'not-an-object' }, { breedGeneticProfile: null }] };
    const out = withoutBreedOdds(body);
    expect(out.data[0].breed).toEqual({ id: 2 });
    expect(out.data[1]).toEqual({});
    expect(out.data[2]).toEqual({});
    expect(row.breed.breedGeneticProfile).toBe(fullProfile);
  });
});

describe('a tested genotype goes only to the horse owner (and the game admin)', () => {
  it('the owner gets their tested horse genotype on the horse page and the genetics endpoint', async () => {
    const page = await withToken(`/api/v1/horses/${ownHorse.id}`, ownerToken);
    expect(page.status).toBe(200);
    expect(page.body.data.colorGenotype).toEqual(genotype);

    const genetics = await withToken(`/api/v1/horses/${ownHorse.id}/genetics`, ownerToken);
    expect(genetics.status).toBe(200);
    expect(genetics.body.data.colorGenotype).toEqual(genotype);
  });

  it('withoutHiddenGenotype drops a tested genotype the viewer does not own, at any depth', () => {
    const viewer = { userId: 'viewer-1', isAdmin: false, ownedHorseId: 10 };
    const body = {
      data: {
        id: 10,
        userId: 'viewer-1',
        colorGeneticsTested: true,
        colorGenotype: genotype,
        sire: { id: 11, userId: 'someone-else', colorGeneticsTested: true, colorGenotype: genotype },
      },
      genetics: { horseId: 10, colorGeneticsTested: true, colorGenotype: genotype },
      stranger: { horseId: 12, colorGeneticsTested: true, colorGenotype: genotype },
    };
    const out = withoutHiddenGenotype(body, viewer);
    expect(out.data.colorGenotype).toEqual(genotype);
    expect(out.data.sire).not.toHaveProperty('colorGenotype');
    expect(out.genetics.colorGenotype).toEqual(genotype);
    expect(out.stranger).not.toHaveProperty('colorGenotype');
    expect(body.data.sire.colorGenotype).toEqual(genotype);

    // A moderator or anonymous viewer gets none of them; an admin gets every tested one.
    const anonymous = withoutHiddenGenotype(body);
    expect(anonymous.data).not.toHaveProperty('colorGenotype');
    expect(anonymous.genetics).not.toHaveProperty('colorGenotype');
    const admin = withoutHiddenGenotype(body, { userId: 'a', isAdmin: true, ownedHorseId: null });
    expect(admin.data.sire.colorGenotype).toEqual(genotype);
    expect(admin.stranger.colorGenotype).toEqual(genotype);
  });

  it('the game admin sees an untested genotype; nobody else does', () => {
    const body = { id: 1, userId: 'a', colorGeneticsTested: false, colorGenotype: genotype };
    expect(withoutHiddenGenotype(body, { userId: 'a', isAdmin: true }).colorGenotype).toEqual(genotype);
    expect(withoutHiddenGenotype(body, { userId: 'a', isAdmin: false })).not.toHaveProperty('colorGenotype');
    expect(withoutHiddenGenotype(body)).not.toHaveProperty('colorGenotype');
  });

  it('the admin gets her untested horse genotype on the horse page and the genetics endpoint', async () => {
    const page = await withToken(`/api/v1/horses/${adminUntestedHorse.id}`, adminToken);
    expect(page.status).toBe(200);
    expect(page.body.data.colorGenotype).toEqual(genotype);

    const genetics = await withToken(`/api/v1/horses/${adminUntestedHorse.id}/genetics`, adminToken);
    expect(genetics.status).toBe(200);
    expect(genetics.body.data.colorGeneticsTested).toBe(false);
    expect(genetics.body.data.colorGenotype).toEqual(genotype);
  });

  it('a moderator does not get the genotype of their own untested horse', async () => {
    const page = await withToken(`/api/v1/horses/${moderatorUntestedHorse.id}`, moderatorToken);
    expect(page.status).toBe(200);
    expect(page.body.data).not.toHaveProperty('colorGenotype');

    const genetics = await withToken(`/api/v1/horses/${moderatorUntestedHorse.id}/genetics`, moderatorToken);
    expect(genetics.status).toBe(200);
    expect(genetics.body.data.colorGeneticsTested).toBe(false);
    expect(genetics.body.data).not.toHaveProperty('colorGenotype');
  });
});
