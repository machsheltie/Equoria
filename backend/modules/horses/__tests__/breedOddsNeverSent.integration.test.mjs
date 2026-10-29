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
let ownHorse;
let adminHorse;

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
  it('GET /breeds/:id sends only the rating profiles, no colour, shade, marking or temperament odds', async () => {
    const res = await request(app).get(`/api/v1/breeds/${breed.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe(breed.name);
    expect(res.body.data.breedGeneticProfile).toEqual({ ratingProfiles });
  });

  it('GET /horses/:id sends the joined breed without its odds', async () => {
    const res = await withToken(`/api/v1/horses/${ownHorse.id}`, ownerToken);
    expect(res.status).toBe(200);
    expect(res.body.data.breed.name).toBe(breed.name);
    expect(res.body.data.breed.breedGeneticProfile).toEqual({ ratingProfiles });
  });

  it('the game admin still gets the whole profile', async () => {
    const res = await withToken(`/api/v1/horses/${adminHorse.id}`, adminToken);
    expect(res.status).toBe(200);
    expect(res.body.data.breed.breedGeneticProfile).toEqual(fullProfile);
  });

  it('withoutBreedOdds cuts every profile at any depth to its public keys without mutating the input', () => {
    const row = { id: 1, breed: { id: 2, breedGeneticProfile: fullProfile } };
    const body = { data: [row, { breedGeneticProfile: 'not-an-object' }, { breedGeneticProfile: null }] };
    const out = withoutBreedOdds(body);
    expect(out.data[0].breed.breedGeneticProfile).toEqual({ ratingProfiles });
    expect(out.data[1].breedGeneticProfile).toBeNull();
    expect(out.data[2].breedGeneticProfile).toBeNull();
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

  it('an untested genotype stays hidden even from the admin', () => {
    const body = { id: 1, userId: 'a', colorGeneticsTested: false, colorGenotype: genotype };
    expect(withoutHiddenGenotype(body, { userId: 'a', isAdmin: true })).not.toHaveProperty('colorGenotype');
  });
});
