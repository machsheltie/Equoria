/**
 * entryEligibility.integration.test.mjs (Equoria-576c0 B9)
 *
 * Owner entry rules (2026-10-15) and rulings C10-C12 (2026-10-16), enforced the
 * same way by BOTH ridden entry paths through one checkEntryEligibility inside
 * the entry transaction:
 *   - age 3-20 game years (utils/horseAge.mjs, Eastern calendar);
 *   - C10: an active rider assignment whose rider is not retired and is
 *     employed by the horse's owner;
 *   - C12: a Gaited show needs gaitScores.gaiting present;
 *   - no double entry in one show;
 *   - R9: entering has nothing to do with XP or points, so the XP level
 *     bracket (Equoria-g8qg0) no longer refuses an entry.
 * Injured horses stay refused; so does any horse in bad health (displayed
 * health critical, owner ruling 2026-10-22, Equoria-0d4wa) - fixtures are fed.
 *
 * Every refusal is a clear message with a stable `code`, leaves the wallet
 * untouched and creates no ShowEntry. Real HTTP (supertest on the app, auth +
 * CSRF) and the real DB; shows are free (entryFee 0, prize 0) so nothing
 * touches the shared escrow account.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { competitionDateOfBirth, giveEligibleRider } from '../../../__tests__/helpers/eligibleCompetitor.mjs';

const ORIGIN = 'http://localhost:3000';
const uid = () => randomBytes(5).toString('hex');
const cleanup = createCleanupTracker();
const showIds = [];
const horseIds = [];
const riderIds = [];
let entrant;
let otherUser;
let token;

beforeAll(async () => {
  entrant = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `b9-e-${uid()}@test.local`,
      username: `b9e${uid()}`,
      password: 'irrelevant-hash',
      firstName: 'Entry',
      lastName: 'Rules',
      money: 1000,
    },
  });
  otherUser = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `b9-o-${uid()}@test.local`,
      username: `b9o${uid()}`,
      password: 'irrelevant-hash',
      firstName: 'Other',
      lastName: 'Employer',
      money: 0,
    },
  });
  token = generateTestToken({ id: entrant.id, email: entrant.email, role: 'user' });
  cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: { in: showIds } } }), 'entries');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'shows');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.rider.deleteMany({ where: { id: { in: riderIds } } }), 'riders');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: [entrant.id, otherUser.id] } } }), 'users');
}, 60000);

afterAll(() => cleanup.run(), 60000);

async function makeShow(discipline = 'Dressage', level = { levelMin: 1, levelMax: 1 }) {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const show = await prisma.show.create({
    data: {
      name: `TestFixture-b9-${uid()}`,
      discipline,
      entryFee: 0,
      prize: 0,
      ...level,
      runDate: future,
      closeDate: future,
      openDate: new Date(Date.now() - 60 * 1000),
      status: 'open',
      createdByUserId: entrant.id,
    },
  });
  showIds.push(show.id);
  return show;
}

/** A horse owned by the entrant; `rider` false leaves it without one. */
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

async function makeHorse({ years = 7, rider = {}, assignment = {}, withRider = true, ...fields } = {}) {
  const horse = await createTestHorse(
    prisma,
    {
      name: `TestFixture-b9-${uid()}`,
      sex: 'Mare',
      dateOfBirth: competitionDateOfBirth(years),
      age: years,
      userId: entrant.id,
      healthStatus: 'Excellent',
      lastFedDate: new Date(), // fed today: not in bad health (Equoria-0d4wa)
      ...fields,
    },
    horseIds,
  );
  if (withRider) {
    await giveEligibleRider(prisma, { horseId: horse.id, userId: entrant.id, rider, assignment }, riderIds);
  }
  return horse;
}

async function post(path, body) {
  const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
  return request(app)
    .post(path)
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

const PATHS = [
  ['POST /api/v1/shows/:id/enter', (showId, horseId) => post(`/api/v1/shows/${showId}/enter`, { horseId })],
  ['POST /api/v1/competition/enter', (showId, horseId) => post('/api/v1/competition/enter', { horseId, showId })],
];

describe.each(PATHS)('%s applies the entry rules', (_label, enter) => {
  async function expectRefused(showId, horseId, status, code, message) {
    const before = await prisma.user.findUnique({ where: { id: entrant.id }, select: { money: true } });
    const res = await enter(showId, horseId);
    expect({ status: res.status, code: res.body.code, message: res.body.message }).toEqual({
      status,
      code,
      message,
    });
    const after = await prisma.user.findUnique({ where: { id: entrant.id }, select: { money: true } });
    expect(after.money).toBe(before.money);
    expect(await prisma.showEntry.count({ where: { showId, horseId } })).toBe(0);
  }

  it('accepts an eligible horse aged 3, and one aged 20', async () => {
    const show = await makeShow();
    const young = await makeHorse({ years: 3 });
    const old = await makeHorse({ years: 20 });
    expect((await enter(show.id, young.id)).status).toBe(201);
    expect((await enter(show.id, old.id)).status).toBe(201);
  });

  it('refuses a horse under 3', async () => {
    const show = await makeShow();
    const horse = await makeHorse({ years: 2 });
    await expectRefused(show.id, horse.id, 400, 'ageTooYoung', 'Horse must be at least 3 years old to compete');
  });

  it('refuses a horse over 20', async () => {
    const show = await makeShow();
    const horse = await makeHorse({ years: 21 });
    await expectRefused(show.id, horse.id, 400, 'ageTooOld', 'Horses over 20 years old cannot compete');
  });

  it('refuses a horse with no rider assigned (C10)', async () => {
    const show = await makeShow();
    const horse = await makeHorse({ withRider: false });
    await expectRefused(show.id, horse.id, 400, 'riderRequired', 'An assigned rider is required to compete');
  });

  it('refuses a horse whose only assignment is inactive (C10)', async () => {
    const show = await makeShow();
    const horse = await makeHorse({ assignment: { isActive: false } });
    await expectRefused(show.id, horse.id, 400, 'riderRequired', 'An assigned rider is required to compete');
  });

  it('refuses a horse whose rider is retired (C10)', async () => {
    const show = await makeShow();
    const horse = await makeHorse({ rider: { retired: true } });
    await expectRefused(show.id, horse.id, 400, 'riderRetired', "This horse's rider is retired");
  });

  it('refuses a horse whose rider is employed by someone else (C10)', async () => {
    const show = await makeShow();
    const horse = await makeHorse({ rider: { userId: otherUser.id } });
    await expectRefused(show.id, horse.id, 400, 'riderNotEmployed', "This horse's rider is not employed by you");
  });

  // Equoria-uszhf (owner ruling 2026-10-19): Gaited is a breed property, so the
  // horse that may enter is now of a gaited breed. Old contract: any breed with
  // gaitScores.gaiting was accepted.
  it('refuses a Gaited show for a horse without gaiting (C12), and accepts one with it', async () => {
    const { gaited: gaitedBreed } = await seededGaitedAndPlainBreeds();
    const show = await makeShow('Gaited');
    const noGait = await makeHorse({
      breedId: gaitedBreed.id,
      gaitScores: { walk: 60, trot: 60, canter: 60, gallop: 60, gaiting: null },
    });
    await expectRefused(
      show.id,
      noGait.id,
      400,
      'gaitingRequired',
      'Gaited shows require a horse with gaiting ability',
    );
    const unrecorded = await makeHorse({ breedId: gaitedBreed.id });
    await expectRefused(
      show.id,
      unrecorded.id,
      400,
      'gaitingRequired',
      'Gaited shows require a horse with gaiting ability',
    );
    const gaited = await makeHorse({
      breedId: gaitedBreed.id,
      gaitScores: { walk: 60, trot: 60, canter: 60, gallop: 60, gaiting: [{ name: 'Rack', score: 70 }] },
    });
    expect((await enter(show.id, gaited.id)).status).toBe(201);
  });

  it('refuses a Gaited show to a non-gaited breed, even with gaiting and a stray Gaited trait (Equoria-uszhf)', async () => {
    const { plain } = await seededGaitedAndPlainBreeds();
    const show = await makeShow('Gaited');
    const stray = await makeHorse({
      breedId: plain.id,
      gaitScores: { walk: 60, trot: 60, canter: 60, gallop: 60, gaiting: [{ name: 'Rack', score: 70 }] },
      epigeneticModifiers: { positive: ['gaited', 'Gaited'], negative: [], hidden: [] },
    });
    await expectRefused(show.id, stray.id, 400, 'gaitedBreedRequired', 'Only gaited breeds can show in Gaited');
    const breedless = await makeHorse({
      gaitScores: { walk: 60, trot: 60, canter: 60, gallop: 60, gaiting: [{ name: 'Rack', score: 70 }] },
    });
    await expectRefused(show.id, breedless.id, 400, 'gaitedBreedRequired', 'Only gaited breeds can show in Gaited');
  });

  it('refuses a second entry of the same horse in one show', async () => {
    const show = await makeShow();
    const horse = await makeHorse();
    expect((await enter(show.id, horse.id)).status).toBe(201);
    const res = await enter(show.id, horse.id);
    expect({ status: res.status, code: res.body.code, message: res.body.message }).toEqual({
      status: 409,
      code: 'alreadyEntered',
      message: 'Horse is already entered in this show',
    });
    expect(await prisma.showEntry.count({ where: { showId: show.id, horseId: horse.id } })).toBe(1);
  });

  it('keeps refusing an injured horse (unchanged until B7)', async () => {
    const show = await makeShow();
    const horse = await makeHorse({ healthStatus: 'injured' });
    await expectRefused(show.id, horse.id, 400, 'horseInjured', 'Injured horses cannot compete');
  });

  it('no longer refuses on the XP level bracket (R9)', async () => {
    const show = await makeShow('Dressage', { levelMin: 1, levelMax: 1 });
    const horse = await makeHorse({ horseXp: 5000 }); // XP level 51 under the old bracket
    expect((await enter(show.id, horse.id)).status).toBe(201);
  });
});
