/**
 * Breeding Color Prediction Route — HTTP integration tests (31E-5, Equoria-wpih).
 *
 * Real DB. Real middleware chain (mutationRateLimiter, rejectPollutedRequest,
 * authenticateToken, csrfProtection, express-validator). Real controller. NO mocks.
 *
 * Covers POST /api/v1/horses/breeding/color-prediction end-to-end:
 *   - 200 with full prediction payload (owner, both parents real Prisma genotype)
 *   - 200 with data:null (AC6 legacy parent — sire or dam missing genotype)
 *   - 400 on missing/invalid body fields (validation chain hit)
 *   - 400 on prototype-pollution body (rejectPollutedRequest hit)
 *   - 401 with no auth token
 *   - 404 cross-user (ownership violation — must NOT leak existence)
 *   - 400 self-cross (sireId === damId) — guard implemented per
 *     PATTERN_LIBRARY.md "Per-Locus Probability" Self-cross requirement
 *     (Equoria-eef8 closed the doc-vs-code drift).
 *
 * Sister test of backend/tests/integration/colorGeneticsRoutes.test.mjs (Equoria-5j0z).
 * Existing controller-level test at backend/modules/horses/__tests__/breedingColorPredictionApi.test.mjs
 * calls the controller fn directly with handcrafted req/res — it cannot cover the
 * middleware chain. This file is the HTTP-level companion.
 */

import request from 'supertest';
import { randomBytes } from 'node:crypto';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../helpers/authHelper.mjs';
import { fetchCsrf, attachCsrf } from '../helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';

// Full 17-locus genotype matching the prediction service's CORE_LOCI set.
// Both parents heterozygous on E so offspring distribution is non-trivial.
const FULL_GENOTYPE_HET = {
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

describe('POST /api/v1/horses/breeding/color-prediction — HTTP integration (Equoria-wpih)', () => {
  let csrf;
  let owner;
  let stranger;
  let ownerToken;
  let strangerToken;
  let sire;
  let dam;
  let legacyDam;
  const createdHorseIds = [];
  const createdUserIds = [];

  beforeAll(async () => {
    csrf = await fetchCsrf(app);
  });

  beforeEach(async () => {
    const ts = `${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`;

    owner = await prisma.user.create({
      data: {
        username: `bcp_owner_${ts}`,
        email: `bcp_owner_${ts}@test.com`,
        password: 'pwhash',
        firstName: 'BCP',
        lastName: 'Owner',
      },
    });
    createdUserIds.push(owner.id);

    stranger = await prisma.user.create({
      data: {
        username: `bcp_stranger_${ts}`,
        email: `bcp_stranger_${ts}@test.com`,
        password: 'pwhash',
        firstName: 'BCP',
        lastName: 'Stranger',
      },
    });
    createdUserIds.push(stranger.id);

    ownerToken = generateTestToken({ id: owner.id, email: owner.email, role: 'user' });
    strangerToken = generateTestToken({ id: stranger.id, email: stranger.email, role: 'user' });

    sire = await prisma.horse.create({
      data: {
        name: `BCPSire_${ts}`,
        sex: 'Stallion',
        dateOfBirth: new Date(Date.now() - 6 * 365.25 * 24 * 60 * 60 * 1000),
        age: 6,
        userId: owner.id,
        colorGenotype: FULL_GENOTYPE_HET,
      },
    });
    createdHorseIds.push(sire.id);

    dam = await prisma.horse.create({
      data: {
        name: `BCPDam_${ts}`,
        sex: 'Mare',
        dateOfBirth: new Date(Date.now() - 5 * 365.25 * 24 * 60 * 60 * 1000),
        age: 5,
        userId: owner.id,
        colorGenotype: FULL_GENOTYPE_HET,
      },
    });
    createdHorseIds.push(dam.id);

    // AC6 — legacy dam with no genotype.
    legacyDam = await prisma.horse.create({
      data: {
        name: `BCPLegacyDam_${ts}`,
        sex: 'Mare',
        dateOfBirth: new Date(Date.now() - 7 * 365.25 * 24 * 60 * 60 * 1000),
        age: 7,
        userId: owner.id,
      },
    });
    createdHorseIds.push(legacyDam.id);
  });

  afterEach(async () => {
    if (createdHorseIds.length) {
      await prisma.horse.deleteMany({ where: { id: { in: createdHorseIds.splice(0) } } });
    }
    if (createdUserIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds.splice(0) } } });
    }
  });

  it('AC: 200 with full prediction payload for owner with two genotyped parents', async () => {
    const res = await attachCsrf(
      request(app)
        .post('/api/v1/horses/breeding/color-prediction')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Origin', ORIGIN)
        .send({ sireId: sire.id, damId: dam.id }),
      csrf,
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeTruthy();
    expect(res.body.data.sireId).toBe(sire.id);
    expect(res.body.data.damId).toBe(dam.id);
    expect(Array.isArray(res.body.data.possibleColors)).toBe(true);
    expect(res.body.data.possibleColors.length).toBeGreaterThan(0);
    // Probabilities should sum to ~1.0 (within float tolerance).
    const probSum = res.body.data.possibleColors.reduce((s, c) => s + c.probability, 0);
    expect(probSum).toBeGreaterThan(0.999);
    expect(probSum).toBeLessThanOrEqual(1.0001);
    expect(typeof res.body.data.totalCombinations).toBe('number');
    expect(typeof res.body.data.lethalCombinationsFiltered).toBe('number');
  });

  it('AC6: 200 with data:null when dam has no colorGenotype (legacy horse)', async () => {
    const res = await attachCsrf(
      request(app)
        .post('/api/v1/horses/breeding/color-prediction')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Origin', ORIGIN)
        .send({ sireId: sire.id, damId: legacyDam.id }),
      csrf,
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeNull();
    expect(res.body.message).toMatch(/genetics data/i);
  });

  it('AC: 400 when sireId is missing (express-validator fires)', async () => {
    const res = await attachCsrf(
      request(app)
        .post('/api/v1/horses/breeding/color-prediction')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Origin', ORIGIN)
        .send({ damId: dam.id }),
      csrf,
    );

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('AC: 400 when sireId is not a positive integer', async () => {
    const res = await attachCsrf(
      request(app)
        .post('/api/v1/horses/breeding/color-prediction')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Origin', ORIGIN)
        .send({ sireId: -1, damId: dam.id }),
      csrf,
    );

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('AC: 400 on prototype-polluted request body (__proto__ injection)', async () => {
    // rejectPollutedRequest is one of the first middlewares in the chain.
    // Send raw JSON so JSON.parse stores __proto__ as an own data property —
    // a non-trivial payload Express can actually parse.
    const polluted = `{"sireId":${sire.id},"damId":${dam.id},"__proto__":{"isAdmin":true}}`;

    const res = await attachCsrf(
      request(app)
        .post('/api/v1/horses/breeding/color-prediction')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Origin', ORIGIN)
        .set('Content-Type', 'application/json')
        .send(polluted),
      csrf,
    );

    expect(res.status).toBe(400);
  });

  it('AC: 401 with no auth token', async () => {
    const res = await attachCsrf(
      request(app)
        .post('/api/v1/horses/breeding/color-prediction')
        .set('Origin', ORIGIN)
        .send({ sireId: sire.id, damId: dam.id }),
      csrf,
    );

    expect(res.status).toBe(401);
  });

  it('AC: 404 cross-user — stranger cannot predict using owners horses (no info leak)', async () => {
    const res = await attachCsrf(
      request(app)
        .post('/api/v1/horses/breeding/color-prediction')
        .set('Authorization', `Bearer ${strangerToken}`)
        .set('Origin', ORIGIN)
        .send({ sireId: sire.id, damId: dam.id }),
      csrf,
    );

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.data).toBeFalsy();
  });

  it('AC: 404 when sire does not exist (uses huge id outside any real row)', async () => {
    const res = await attachCsrf(
      request(app)
        .post('/api/v1/horses/breeding/color-prediction')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Origin', ORIGIN)
        .send({ sireId: 2147483640, damId: dam.id }),
      csrf,
    );

    expect(res.status).toBe(404);
  });

  it('rejects self-cross (sireId === damId) with 400 before any DB work (Equoria-eef8)', async () => {
    // Sentinel-positive coverage for the self-cross guard documented in
    // PATTERN_LIBRARY.md "Per-Locus Probability". The guard MUST fire before
    // Promise.all([getSire, getDam]) so a single Horse.findUnique cannot be
    // observed in the SQL log. We assert on the user-visible response only,
    // since asserting on log content is brittle in real-DB integration tests.
    const res = await attachCsrf(
      request(app)
        .post('/api/v1/horses/breeding/color-prediction')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Origin', ORIGIN)
        .send({ sireId: sire.id, damId: sire.id }),
      csrf,
    );

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    // Match the canonical "Sire and dam cannot be the same horse" message
    // documented in PATTERN_LIBRARY.md so future contributors can grep.
    expect(res.body.message).toMatch(/sire.*dam.*same horse/i);
  });
});
