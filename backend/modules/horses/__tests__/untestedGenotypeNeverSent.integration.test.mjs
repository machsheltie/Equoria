/**
 * An untested horse's colour genotype never leaves the server (Equoria-2wdp8).
 *
 * Owner ruling 2026-10-26 (q72): colour genetics stay hidden until the owner
 * pays the vet for Genetic Testing. Owner ruling 2026-10-28 (q164): hide
 * anything a player could use to find loopholes in the data the game sends.
 *
 * GET /horses/:id/genetics already withholds the genotype, but routes that send
 * whole horse rows (the horse page, the stable list) carried `colorGenotype`
 * for every horse, so the network tab gave away what the test sells.
 *
 * Real app, real database, real auth; fixtures are this file's own.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import { createTestUser, createTestHorse, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { withoutUntestedGenotype } from '../../../utils/publicGenotypeView.mjs';

const fixturePrefix = 'TestFixture-untestedGenotype-2wdp8';
const genotype = { E_Extension: 'E/e', A_Agouti: 'A/a' };

let owner;
let token;
let untested;
let tested;

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');
  const created = await createTestUser({
    username: `${fixturePrefix}-${tag}`,
    email: `${fixturePrefix}-${tag}@example.com`,
  });
  owner = created.user;
  token = created.token;
  untested = await createTestHorse({
    name: `${fixturePrefix}-untested-${tag}`,
    userId: owner.id,
    colorGenotype: genotype,
  });
  tested = await createTestHorse({
    name: `${fixturePrefix}-tested-${tag}`,
    userId: owner.id,
    colorGenotype: genotype,
    colorGeneticsTested: true,
  });
}, 120000);

afterAll(async () => {
  await cleanupTestData();
});

const get = path =>
  request(app).get(path).set('Authorization', `Bearer ${token}`).set('Origin', 'http://localhost:3000');

describe('the horse page and stable list hold back an untested genotype', () => {
  it('GET /horses/:id sends no genotype for an untested horse', async () => {
    const res = await get(`/api/v1/horses/${untested.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(untested.id);
    expect(res.body.data).not.toHaveProperty('colorGenotype');
  });

  it('GET /horses sends no genotype for an untested horse in the list', async () => {
    const res = await get(`/api/v1/horses?userId=${owner.id}&limit=200`);
    expect(res.status).toBe(200);
    const row = res.body.data.find(h => h.id === untested.id);
    expect(row).toBeTruthy();
    expect(row).not.toHaveProperty('colorGenotype');
  });

  it('a tested horse keeps its genotype', async () => {
    const res = await get(`/api/v1/horses/${tested.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.colorGenotype).toEqual(genotype);
  });
});

describe('withoutUntestedGenotype', () => {
  it('drops the genotype from any row not marked tested, at any depth, without mutating the input', () => {
    const sire = { id: 2, colorGenotype: genotype };
    const body = {
      data: [
        { id: 1, colorGeneticsTested: false, colorGenotype: genotype, sire },
        { id: 3, colorGeneticsTested: true, colorGenotype: genotype },
      ],
    };
    const out = withoutUntestedGenotype(body);
    expect(out.data[0]).not.toHaveProperty('colorGenotype');
    expect(out.data[0].sire).not.toHaveProperty('colorGenotype');
    expect(out.data[1].colorGenotype).toEqual(genotype);
    expect(body.data[0].colorGenotype).toEqual(genotype);
    expect(sire.colorGenotype).toEqual(genotype);
  });

  it('copes with a shared or cyclic row', () => {
    const horse = { id: 1, colorGenotype: genotype };
    horse.self = horse;
    const out = withoutUntestedGenotype({ a: horse, b: horse });
    expect(out.a).not.toHaveProperty('colorGenotype');
    expect(out.a.self).toBe(out.a);
    expect(out.b).toBe(out.a);
  });
});
