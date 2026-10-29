/**
 * A Saddlebred's coat portrait is rolled once, when the horse is created, and
 * kept (Equoria-de7ts, owner request 2026-10-28).
 *
 *   1. createHorse — the funnel the Horse Trader, foaling and POST /horses use —
 *      stores one variant of the horse's color in imageUrl; reading the horse
 *      again returns the same picture.
 *   2. A color with no portrait, or a breed with no portraits, keeps the column
 *      default (the page shows the breed's single picture); a caller-chosen
 *      imageUrl is kept.
 *   3. The onboarding breed step (update branch: the registration horse exists)
 *      gives the horse the CHOSEN breed's coat and that coat's portrait. Before,
 *      the registration coat (rolled before any breed was picked) survived, so a
 *      Saddlebred starter could stay Bay Dun, a color the breed cannot have.
 *
 * Real app, real DB, real CSRF, no mocks. Cleanup is scoped to this file's rows.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createHorse } from '../services/horseCreation.mjs';
import { coatImageVariants, defaultHorseImageUrl } from '../services/coatImageService.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { parseBreedSourceFile } from '../../../seed/syncBreedGeneticProfiles.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const origin = 'http://localhost:3000';
const saddlebred = 'American Saddlebred';
const tag = randomBytes(5).toString('hex');

const bayDunGenotype = {
  E_Extension: 'E/e',
  A_Agouti: 'A/a',
  Cr_Cream: 'n/n',
  D_Dun: 'D/nd2',
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
  Prl_Pearl: 'n/n',
  BR1_Brindle1: 'n/n',
};

describe('coat portrait persistence (Equoria-de7ts)', () => {
  const cleanup = createCleanupTracker();
  const userIds = [];
  const breedIds = {};

  cleanup.add(() => prisma.horse.deleteMany({ where: { userId: { in: userIds } } }), 'horse');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'user');

  async function fixtureUser(label, settings) {
    const user = await prisma.user.create({
      data: {
        email: `de7ts-${label}-${tag}@test.invalid`,
        username: `de7ts${label}${tag}`,
        password: 'irrelevant-hash',
        firstName: 'Coat',
        lastName: 'Portrait',
        emailVerified: true,
        ...(settings && { settings }),
      },
      select: { id: true, email: true },
    });
    userIds.push(user.id);
    return user;
  }

  function horseFor(user, breedName, extra = {}) {
    return createHorse({
      name: `De7ts ${breedName} ${tag}`,
      age: 4,
      dateOfBirth: birthDateForAge(4),
      sex: 'Mare',
      breedId: breedIds[breedName],
      userId: user.id,
      ...extra,
    });
  }

  beforeAll(async () => {
    for (const name of [saddlebred, 'Thoroughbred']) {
      const breed = await prisma.breed.findUnique({ where: { name }, select: { id: true } });
      if (!breed) {
        throw new Error(`Seeded breed "${name}" is missing; run npm run seed:breeds.`);
      }
      breedIds[name] = breed.id;
    }
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  it('the database Saddlebred profile is the seed file profile (one breed data set)', async () => {
    const file = join(here, '..', '..', '..', 'data', 'breeds', `${saddlebred}.txt`);
    const { profile } = parseBreedSourceFile(readFileSync(file, 'utf8'), `${saddlebred}.txt`);
    const row = await prisma.breed.findUnique({
      where: { name: saddlebred },
      select: { breedGeneticProfile: true },
    });
    expect(row.breedGeneticProfile).toEqual(profile);
  });

  it('createHorse stores one variant of the color, and the horse keeps it', async () => {
    const user = await fixtureUser('create');
    const phenotype = { colorName: 'Bay', shade: 'blood' };
    const horse = await horseFor(user, saddlebred, { colorGenotype: bayDunGenotype, phenotype });
    expect(coatImageVariants(saddlebred, phenotype)).toContain(horse.imageUrl);

    const reread = await prisma.horse.findUnique({ where: { id: horse.id }, select: { imageUrl: true } });
    expect(reread.imageUrl).toBe(horse.imageUrl);
  }, 60000);

  it('rolls the portrait from the generated coat when the caller passes none', async () => {
    const user = await fixtureUser('generated');
    const horse = await horseFor(user, saddlebred);
    const variants = coatImageVariants(saddlebred, horse.phenotype);
    if (variants.length > 0) {
      expect(variants).toContain(horse.imageUrl);
    } else {
      expect(horse.imageUrl).toBe(defaultHorseImageUrl);
    }
  }, 60000);

  it('keeps the column default for a color or breed with no portrait, and a chosen imageUrl', async () => {
    const user = await fixtureUser('fallback');
    const noPortrait = await horseFor(user, saddlebred, {
      colorGenotype: bayDunGenotype,
      phenotype: { colorName: 'Smoky Seal Brown', shade: 'standard' },
    });
    expect(noPortrait.imageUrl).toBe(defaultHorseImageUrl);

    const thoroughbred = await horseFor(user, 'Thoroughbred', {
      colorGenotype: bayDunGenotype,
      phenotype: { colorName: 'Bay', shade: 'blood' },
    });
    expect(thoroughbred.imageUrl).toBe(defaultHorseImageUrl);

    const chosen = await horseFor(user, saddlebred, {
      colorGenotype: bayDunGenotype,
      phenotype: { colorName: 'Bay', shade: 'blood' },
      imageUrl: '/images/breeds/american_saddlebred.png',
    });
    expect(chosen.imageUrl).toBe('/images/breeds/american_saddlebred.png');
  }, 60000);

  it('the onboarding breed step gives the starter the chosen breed coat and its portrait', async () => {
    const user = await fixtureUser('onboard', { completedOnboarding: false, onboardingStep: 0 });
    // The registration horse: default breed, a coat rolled before any breed was picked.
    const starter = await horseFor(user, 'Thoroughbred', {
      colorGenotype: bayDunGenotype,
      phenotype: { colorName: 'Bay Dun', shade: 'standard' },
    });

    const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    const csrf = await fetchCsrf(app, { origin, extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/auth/advance-onboarding')
      .set('Origin', origin)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseName: `Portrait ${tag}`, breedId: breedIds[saddlebred], gender: 'Mare' });
    expect(res.status).toBe(200);

    const after = await prisma.horse.findUnique({
      where: { id: starter.id },
      select: { breedId: true, colorGenotype: true, phenotype: true, imageUrl: true },
    });
    expect(after.breedId).toBe(breedIds[saddlebred]);
    expect(after.colorGenotype.D_Dun).toBe('nd2/nd2');
    expect(after.phenotype.colorName).not.toMatch(/dun|grulla/i);
    const variants = coatImageVariants(saddlebred, after.phenotype);
    if (variants.length > 0) {
      expect(variants).toContain(after.imageUrl);
    } else {
      expect(after.imageUrl).toBe(defaultHorseImageUrl);
    }
  }, 60000);
});
