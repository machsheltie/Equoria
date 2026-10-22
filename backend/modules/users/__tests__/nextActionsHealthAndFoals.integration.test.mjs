/**
 * next-actions: the health gate and the foal window.
 *
 * Equoria-3tna6 — owner ruling 2026-10-22: bad health is the only consequence;
 * a horse in bad health cannot breed, train or enter shows. Bad health is the
 * threshold the breeding guard applies (displayed health 'critical',
 * utils/horseHealth.mjs getDisplayedHealth). next-actions offered 'train' and
 * 'breed' (and 'compete') for such a horse, because it checked only
 * healthStatus 'injured'. It must not suggest an action the gate would refuse.
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

/** An adult mare, off every cooldown, with a rider; `fed` decides her health. */
async function adultMare(user, { fed }) {
  const horse = await createTestHorse(
    prisma,
    {
      name: `TestFixture-3tna6-${rand()}`,
      sex: 'Mare',
      age: 7,
      dateOfBirth: competitionDateOfBirth(7),
      healthStatus: 'Excellent',
      // Never fed (or fed 10 game days ago) is feed health 'critical'.
      lastFedDate: fed ? new Date() : new Date(Date.now() - 10 * DAY),
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
  });

  it('a mare in critical health is suggested for none of train, breed or compete', async () => {
    const user = await makeUser();
    const mare = await adultMare(user, { fed: false });

    const actions = await actionsFor(user);
    const types = actions.filter(a => a.horseId === mare.id).map(a => a.type);

    expect(types).not.toContain('train');
    expect(types).not.toContain('breed');
    expect(types).not.toContain('compete');
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
        dateOfBirth: new Date(Date.now() - 15 * DAY),
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
        dateOfBirth: new Date(Date.now() - 22 * DAY),
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
