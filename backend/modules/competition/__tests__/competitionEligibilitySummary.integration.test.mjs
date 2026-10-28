/**
 * competitionEligibilitySummary.integration.test.mjs (Equoria-576c0 B9 round 2)
 *
 * GET /api/v1/competition/eligibility/:horseId/:discipline reports the same
 * entry rules the entry transaction enforces (utils/competitionEntryRules),
 * so it never calls a horse eligible for an entry the server refuses.
 *
 * Old contract: ageEligible was 3-21 from the age column, traitEligible came
 * from an epigenetic 'gaited' trait, there was no rider check and no overall
 * verdict. New: ageEligible is 3-20 game years from dateOfBirth, riderEligible
 * is C10, traitEligible is C12 (Gaited needs gaitScores.gaiting), and
 * `eligible` / `refusal` give the verdict with the entry refusal code and
 * message. The summary has no show, so "already entered" is not part of it.
 *
 * Real HTTP (auth) and the real DB; id-scoped fail-loud cleanup.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { competitionDateOfBirth, giveEligibleRider } from '../../../__tests__/helpers/eligibleCompetitor.mjs';

const rand = () => randomBytes(6).toString('hex');
const cleanup = createCleanupTracker();
const horseIds = [];
const riderIds = [];
const showIds = [];
let user;
let token;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `b9el-${rand()}@test.local`,
      username: `b9el${rand()}`,
      password: 'irrelevant-hash',
      firstName: 'Eligibility',
      lastName: 'Summary',
      money: 0,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: { in: showIds } } }), 'entries');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'shows');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.rider.deleteMany({ where: { id: { in: riderIds } } }), 'riders');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 60000);

afterAll(() => cleanup.run(), 60000);

// Equoria-uszhf: the seeded breeds the Gaited breed rule is judged on.
async function seededGaitedAndPlainBreeds() {
  const gaited = await prisma.breed.findUnique({ where: { name: 'American Saddlebred' } });
  const plain = await prisma.breed.findUnique({ where: { name: 'Thoroughbred' } });
  if (gaited?.breedGeneticProfile?.ratingProfiles?.isGaitedBreed !== true) {
    throw new Error('American Saddlebred must be seeded as a gaited breed; refusing to skip.');
  }
  if (plain?.breedGeneticProfile?.ratingProfiles?.isGaitedBreed !== false) {
    throw new Error('Thoroughbred must be seeded as a non-gaited breed; refusing to skip.');
  }
  return { gaited, plain };
}

async function makeHorse({ years = 7, rider = true, ...fields } = {}) {
  const horse = await createTestHorse(
    prisma,
    {
      name: `TestFixture-b9el-${rand()}`,
      sex: 'Mare',
      age: years,
      dateOfBirth: competitionDateOfBirth(years),
      healthStatus: 'Excellent',
      lastFedDate: new Date(), // fed today: not in bad health (Equoria-0d4wa)
      userId: user.id,
      ...fields,
    },
    horseIds,
  );
  if (rider) {
    await giveEligibleRider(prisma, { horseId: horse.id, userId: user.id }, riderIds);
  }
  return horse;
}

async function summary(horseId, discipline) {
  const res = await request(app)
    .get(`/api/v1/competition/eligibility/${horseId}/${encodeURIComponent(discipline)}`)
    .set('Origin', 'http://localhost:3000')
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  return res.body.data.eligibility;
}

describe('GET /competition/eligibility follows the entry rules (B9)', () => {
  it('calls an entry-ready horse eligible', async () => {
    const horse = await makeHorse();
    const e = await summary(horse.id, 'Dressage');
    expect(e).toMatchObject({
      eligible: true,
      refusal: null,
      ageEligible: true,
      riderEligible: true,
      traitEligible: true,
      currentAge: 7,
    });
  });

  it('a 21-year-old is not eligible (max 20 from dateOfBirth)', async () => {
    const horse = await makeHorse({ years: 21 });
    const e = await summary(horse.id, 'Dressage');
    expect(e).toMatchObject({
      eligible: false,
      ageEligible: false,
      currentAge: 21,
      refusal: { code: 'AGE_TOO_OLD', message: 'Horses over 20 years old cannot compete' },
    });
  });

  it('a horse with no rider is not eligible (C10)', async () => {
    const horse = await makeHorse({ rider: false });
    const e = await summary(horse.id, 'Dressage');
    expect(e).toMatchObject({
      eligible: false,
      riderEligible: false,
      refusal: { code: 'RIDER_REQUIRED', message: 'An assigned rider is required to compete' },
    });
  });

  // Equoria-uszhf (owner ruling 2026-10-19): Gaited is a breed property, so the
  // eligible horse is now of a gaited breed. Old contract: any breed with
  // gaitScores.gaiting was eligible.
  it('Gaited needs gaiting (C12)', async () => {
    const { gaited: gaitedBreed } = await seededGaitedAndPlainBreeds();
    const noGait = await makeHorse({ breedId: gaitedBreed.id });
    expect(await summary(noGait.id, 'Gaited')).toMatchObject({
      eligible: false,
      traitEligible: false,
      refusal: { code: 'GAITING_REQUIRED' },
    });
    const gaited = await makeHorse({
      breedId: gaitedBreed.id,
      gaitScores: { walk: 60, trot: 60, canter: 60, gallop: 60, gaiting: [{ name: 'Rack', score: 70 }] },
    });
    expect(await summary(gaited.id, 'Gaited')).toMatchObject({ eligible: true, traitEligible: true });
  });

  it('a non-gaited breed is not eligible for Gaited, even with gaiting and a stray Gaited trait (Equoria-uszhf)', async () => {
    const { plain } = await seededGaitedAndPlainBreeds();
    const stray = await makeHorse({
      breedId: plain.id,
      gaitScores: { walk: 60, trot: 60, canter: 60, gallop: 60, gaiting: [{ name: 'Rack', score: 70 }] },
      epigeneticModifiers: { positive: ['gaited', 'Gaited'], negative: [], hidden: [] },
    });
    expect(await summary(stray.id, 'Gaited')).toMatchObject({
      eligible: false,
      traitEligible: false,
      refusal: { code: 'gaitedBreedRequired', message: 'Only gaited breeds can show in Gaited' },
    });
    expect(await summary(stray.id, 'Dressage')).toMatchObject({ eligible: true });
  });

  // Equoria-576c0 B10: at most 3 discipline types active at once.
  it('a 4th discipline type is not eligible while 3 are active; an active type is', async () => {
    const horse = await makeHorse();
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    for (const discipline of ['Dressage', 'Racing', 'Show Jumping']) {
      const show = await prisma.show.create({
        data: {
          name: `TestFixture-b10el-${rand()}`,
          discipline,
          entryFee: 0,
          prize: 0,
          levelMin: 1,
          levelMax: 999,
          runDate: future,
          closeDate: future,
          openDate: new Date(),
          status: 'open',
          createdByUserId: user.id,
        },
      });
      showIds.push(show.id);
      await prisma.showEntry.create({
        data: { showId: show.id, horseId: horse.id, userId: user.id, feePaid: 0 },
      });
    }
    expect(await summary(horse.id, 'Western Pleasure')).toMatchObject({
      eligible: false,
      activeDisciplineTypes: ['Dressage', 'Racing', 'Show Jumping'],
      refusal: { code: 'DISCIPLINE_TYPE_LIMIT' },
    });
    expect(await summary(horse.id, 'Racing')).toMatchObject({ eligible: true, refusal: null });
  });
});
