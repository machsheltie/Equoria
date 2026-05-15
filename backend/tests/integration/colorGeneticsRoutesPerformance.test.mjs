/**
 * Color & Genetics Routes — HTTP integration PERFORMANCE tests
 * (Equoria-z594; Epic 31E retrospective action item #12).
 *
 * FR-33: GET /api/v1/horses/:id/genetics must return under 300ms (warm).
 * FR-34: GET /api/v1/horses/:id/color    must return under 200ms (warm).
 *
 * Real DB, real middleware chain, real Prisma. NO mocks. Sister of
 * backend/tests/integration/colorGeneticsRoutes.test.mjs (Equoria-5j0z)
 * which covers correctness; this file covers latency NFRs that the
 * TEA:TR Advisory LOW gap (2026-04-09) called out as unverifiable at
 * the unit-test level (pure-function services have no DB latency).
 *
 * Methodology:
 *   - Seed ONE fixture horse + user in `beforeAll`, amortizing setup
 *     across the two warm-path assertions.
 *   - Warm the route once (discarded) so the test measures steady-state
 *     latency, not cold-cache one-off compile time.
 *   - Assert the second timed call against the FR threshold.
 *
 * If these tests flake on CI under load, quarantine via Jest `--testPathPattern`
 * exclusion in the perf job; correctness suite (5j0z) covers the same
 * routes' behaviour and remains a blocking gate.
 */

import { performance } from 'node:perf_hooks';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../helpers/authHelper.mjs';
import { fetchCsrf } from '../helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';
const GENETICS_BUDGET_MS = 300;
const COLOR_BUDGET_MS = 200;

// Full 17-locus genotype matching the CORE_LOCI set used by the prediction
// service. Choosing realistic complexity so the JSONB roundtrip is exercised.
const FULL_GENOTYPE = {
  E_Extension: 'E/e',
  A_Agouti: 'A/a',
  Cr_Cream: 'n/n',
  D_Dun: 'nd2/nd2',
  Z_Silver: 'n/n',
  Ch_Champagne: 'n/n',
  G_Gray: 'g/g',
  Rn_Roan: 'rn/rn',
  W_DominantWhite: 'w/w',
  TO_Tobiano: 'to/to',
  O_FrameOvero: 'n/n',
  SB1_Sabino1: 'n/n',
  SW_SplashWhite: 'n/n',
  LP_LeopardComplex: 'lp/lp',
  PATN1_Pattern1: 'patn1/patn1',
  EDXW: 'n/n',
  MFSD12_Mushroom: 'N/N',
};

describe('Color & Genetics Routes — performance NFRs (Equoria-z594)', () => {
  let csrf;
  let perfUser;
  let perfToken;
  let perfHorse;
  const createdHorseIds = [];
  const createdUserIds = [];

  beforeAll(async () => {
    csrf = await fetchCsrf(app);

    const ts = randomBytes(8).toString('hex');
    perfUser = await prisma.user.create({
      data: {
        username: `cgperf_${ts}`,
        email: `cgperf_${ts}@test.com`,
        password: 'pwhash',
        firstName: 'CGPerf',
        lastName: 'Owner',
      },
    });
    createdUserIds.push(perfUser.id);

    perfToken = generateTestToken(perfUser);

    perfHorse = await prisma.horse.create({
      data: {
        name: `CGPerfHorse_${ts}`,
        sex: 'Mare',
        dateOfBirth: new Date(Date.now() - 4 * 365.25 * 24 * 60 * 60 * 1000),
        age: 4,
        userId: perfUser.id,
        colorGenotype: FULL_GENOTYPE,
        phenotype: { colorName: 'Bay', markings: { face: 'star' } },
      },
    });
    createdHorseIds.push(perfHorse.id);

    // Warm cache: one untimed call to each endpoint so JIT + Prisma client
    // first-call overhead is excluded from the measurement.
    await request(app)
      .get(`/api/v1/horses/${perfHorse.id}/genetics`)
      .set('Authorization', `Bearer ${perfToken}`)
      .set('Origin', ORIGIN);
    await request(app)
      .get(`/api/v1/horses/${perfHorse.id}/color`)
      .set('Authorization', `Bearer ${perfToken}`)
      .set('Origin', ORIGIN);
  });

  afterAll(async () => {
    if (createdHorseIds.length > 0) {
      await prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  test(`GET /horses/:id/genetics warm response < ${GENETICS_BUDGET_MS}ms (FR-33)`, async () => {
    const start = performance.now();
    const res = await request(app)
      .get(`/api/v1/horses/${perfHorse.id}/genetics`)
      .set('Authorization', `Bearer ${perfToken}`)
      .set('Origin', ORIGIN);
    const elapsed = performance.now() - start;

    expect(res.status).toBe(200);
    if (elapsed >= GENETICS_BUDGET_MS) {
      // eslint-disable-next-line no-console
      console.log(
        `[z594] genetics warm latency = ${elapsed.toFixed(1)}ms (budget ${GENETICS_BUDGET_MS}ms)`,
      );
    }
    expect(elapsed).toBeLessThan(GENETICS_BUDGET_MS);
  });

  test(`GET /horses/:id/color warm response < ${COLOR_BUDGET_MS}ms (FR-34)`, async () => {
    const start = performance.now();
    const res = await request(app)
      .get(`/api/v1/horses/${perfHorse.id}/color`)
      .set('Authorization', `Bearer ${perfToken}`)
      .set('Origin', ORIGIN);
    const elapsed = performance.now() - start;

    expect(res.status).toBe(200);
    if (elapsed >= COLOR_BUDGET_MS) {
      // eslint-disable-next-line no-console
      console.log(
        `[z594] color warm latency = ${elapsed.toFixed(1)}ms (budget ${COLOR_BUDGET_MS}ms)`,
      );
    }
    expect(elapsed).toBeLessThan(COLOR_BUDGET_MS);
  });
});
