/**
 * next-actions: the health gate and the foal window.
 *
 * Equoria-3tna6 — owner ruling 2026-10-22: bad health is the only consequence;
 * a horse in bad health cannot breed, train or enter shows. next-actions
 * offered 'train' and 'breed' (and 'compete') for such a horse, because it
 * checked only healthStatus 'injured'. It must not suggest an action the gate
 * would refuse.
 *
 * Equoria-cn6kt — owner ruling 2026-10-22: for a horse in bad health,
 * next-actions suggests BOTH a vet visit and feeding.
 *
 * Equoria-u0jop — owner ruling 2026-10-23: health is Excellent, Very Good,
 * Good, Fair, Bad (Poor/Bad/Critical = Bad) and a horse must be Fair or better
 * to breed, train or show. next-actions uses the SAME gate as those actions
 * (utils/horseHealth.mjs hasBadHealth). Old contract: only 'critical' was bad,
 * so a horse seven days unfed (then 'poor') was still suggested for training.
 *
 * Equoria-fr2kg Q11 — owner ruling 2026-10-22: remove the
 * FoalDevelopment.isActive filter (the column never turns false). The
 * groom-foal suggestion is for horses under 3 (game age), whatever the
 * legacy isActive column says.
 *
 * Real DB and HTTP; id-scoped fail-loud cleanup.
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
import { gameCalendarDate } from '../../../utils/gameTime.mjs';

const rand = () => randomBytes(6).toString('hex');
const DAY = 24 * 60 * 60 * 1000;
const cleanup = createCleanupTracker();
const userIds = [];
const horseIds = [];
const showIds = [];
const riderIds = [];

cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'shows');
cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
cleanup.add(() => prisma.rider.deleteMany({ where: { id: { in: riderIds } } }), 'riders');
cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
afterAll(() => cleanup.run(), 60000);

async function makeUser() {
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `na3tna6-${rand()}@test.local`,
      username: `na3tna6${rand()}`,
      password: 'irrelevant-hash',
      firstName: 'Next',
      lastName: 'Action',
      money: 0,
    },
  });
  userIds.push(user.id);
  return user;
}

/**
 * An adult mare, off every cooldown, with a rider. `fed` decides her health:
 * fed today is Excellent, unfed is ten days (Bad); `daysUnfed` sets the gap.
 */
async function adultMare(user, { fed, daysUnfed = fed ? 0 : 10 }) {
  const horse = await createTestHorse(
    prisma,
    {
      name: `TestFixture-3tna6-${rand()}`,
      sex: 'Mare',
      age: 7,
      dateOfBirth: competitionDateOfBirth(7),
      healthStatus: 'Excellent',
      // Owner ruling 2026-10-23 (Equoria-qwz60): health is the vet days lowered by
      // hunger. A horse unfed 7+ days (hunger Fair or Bad) is vetted 25 days ago
      // (Fair), so hunger drags it to Bad; fed recently it is freshly vetted.
      // Old contract: ten days unfed alone made a horse Bad.
      lastFedDate: daysUnfed === 0 ? new Date() : new Date(Date.now() - daysUnfed * DAY),
      lastVettedDate: daysUnfed >= 7 ? gameCalendarDate(new Date(), -25) : gameCalendarDate(),
      trainingCooldown: null,
      lastBredDate: null,
      userId: user.id,
    },
    horseIds,
  );
  await giveEligibleRider(prisma, { horseId: horse.id, userId: user.id }, riderIds);
  return horse;
}

async function actionsFor(user) {
  const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  const res = await request(app)
    .get('/api/v1/next-actions')
    .set('Origin', 'http://localhost:3000')
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  return res.body.data.actions;
}

beforeAll(async () => {
  const now = Date.now();
  // The soonest-closing open show, so a compete suggestion names it.
  const show = await prisma.show.create({
    data: {
      name: `TestFixture-3tna6-show-${rand()}`,
      discipline: 'Dressage',
      levelMin: 1,
      levelMax: 999,
      entryFee: 0,
      prize: 0,
      runDate: new Date(now + 60 * 1000),
      status: 'open',
      openDate: new Date(now - 60 * 1000),
      closeDate: new Date(now + 60 * 1000),
    },
  });
  showIds.push(show.id);
}, 60000);

describe('next-actions respects the health gate (Equoria-3tna6)', () => {
  it('a healthy mare is suggested for train, breed and compete', async () => {
    const user = await makeUser();
    const mare = await adultMare(user, { fed: true });

    const actions = await actionsFor(user);
    const types = actions.filter(a => a.horseId === mare.id).map(a => a.type);

    expect(types).toEqual(expect.arrayContaining(['train', 'breed', 'compete']));
    expect(types).not.toContain('visit-vet');
    expect(types).not.toContain('feed');
  });

  it('a mare in Bad health is suggested for none of train, breed or compete', async () => {
    const user = await makeUser();
    const mare = await adultMare(user, { fed: false });

    const actions = await actionsFor(user);
    const types = actions.filter(a => a.horseId === mare.id).map(a => a.type);

    expect(types).not.toContain('train');
    expect(types).not.toContain('breed');
    expect(types).not.toContain('compete');
  });

  it('a mare in Bad health is suggested for a vet visit AND feeding (Equoria-cn6kt)', async () => {
    const user = await makeUser();
    const mare = await adultMare(user, { fed: false });

    const actions = (await actionsFor(user)).filter(a => a.horseId === mare.id);

    expect(actions.filter(a => a.type === 'visit-vet')).toHaveLength(1);
    expect(actions.filter(a => a.type === 'feed')).toEqual([
      expect.objectContaining({ metadata: { displayedHealth: 'Bad' } }),
    ]);
  });

  it('a mare seven days unfed (was Poor, now Bad) gets vet + feeding and no train, breed or compete', async () => {
    const user = await makeUser();
    const mare = await adultMare(user, { daysUnfed: 7 });

    const types = (await actionsFor(user)).filter(a => a.horseId === mare.id).map(a => a.type);

    expect(types.sort()).toEqual(['feed', 'visit-vet']);
  });

  it('a mare in Fair health (five days unfed) is still suggested for train, breed and compete', async () => {
    const user = await makeUser();
    const mare = await adultMare(user, { daysUnfed: 5 });

    const types = (await actionsFor(user)).filter(a => a.horseId === mare.id).map(a => a.type);

    expect(types).toEqual(expect.arrayContaining(['train', 'breed', 'compete']));
    expect(types).not.toContain('visit-vet');
    expect(types).not.toContain('feed');
  });

  it('an injured mare already fed today gets one vet visit and no feeding', async () => {
    const user = await makeUser();
    const mare = await adultMare(user, { fed: true });
    await prisma.horse.update({ where: { id: mare.id }, data: { healthStatus: 'Injured' } });

    const types = (await actionsFor(user)).filter(a => a.horseId === mare.id).map(a => a.type);

    expect(types.filter(t => t === 'visit-vet')).toHaveLength(1);
    expect(types).not.toContain('feed');
  });
});

describe('groom-foal follows game age, not FoalDevelopment.isActive (Equoria-fr2kg Q11)', () => {
  it('suggests a foal under 3 whose legacy isActive is false, and not a 3-year-old whose isActive is true', async () => {
    const user = await makeUser();
    const foal = await createTestHorse(
      prisma,
      {
        name: `TestFixture-q11-foal-${rand()}`,
        sex: 'Filly',
        age: 2,
        dateOfBirth: gameCalendarDate(new Date(), -15),
        healthStatus: 'Excellent',
        lastFedDate: new Date(),
        userId: user.id,
      },
      horseIds,
    );
    await prisma.foalDevelopment.create({ data: { foalId: foal.id, isActive: false } });
    const grown = await createTestHorse(
      prisma,
      {
        name: `TestFixture-q11-grown-${rand()}`,
        sex: 'Mare',
        age: 3,
        dateOfBirth: gameCalendarDate(new Date(), -22),
        healthStatus: 'Excellent',
        lastFedDate: new Date(),
        trainingCooldown: new Date(Date.now() + 2 * DAY),
        userId: user.id,
      },
      horseIds,
    );
    await prisma.foalDevelopment.create({ data: { foalId: grown.id, isActive: true } });

    const groomFoal = (await actionsFor(user)).filter(a => a.type === 'groom-foal');

    expect(groomFoal.map(a => a.horseId)).toEqual([foal.id]);
  });
});
