/**
 * nextActionsAgePolicyAndConformation.integration.test.mjs
 *
 * Equoria-2nacc: the train and breed suggestions use the one horse age policy
 * (constants/horseAgePolicy.mjs): active ages 3-20, retirement at 21. A
 * retired horse is never offered for training or breeding.
 *
 * Equoria-576c0.2 (owner ruling 2026-10-19, decision 12): the compete
 * suggestion lists conformation shows again, offered only for a horse with an
 * assigned groom (conformation entry rule C11: age 0+, a groom the entry
 * transaction would accept).
 *
 * Real DB and HTTP; free shows; id-scoped fail-loud cleanup.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { competitionDateOfBirth } from '../../../__tests__/helpers/eligibleCompetitor.mjs';

const rand = () => randomBytes(6).toString('hex');
const DAY_MS = 24 * 60 * 60 * 1000;
const cleanup = createCleanupTracker();
const userIds = [];
const horseIds = [];
const showIds = [];
const groomIds = [];

cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: { in: showIds } } }), 'entries');
cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'shows');
cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { groomId: { in: groomIds } } }), 'groomAssignments');
cleanup.add(() => prisma.groom.deleteMany({ where: { id: { in: groomIds } } }), 'grooms');
cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');

async function makeUser() {
  const user = await prisma.user.create({
    data: {
      email: `nxap-${rand()}@test.local`,
      username: `nxap${rand()}`,
      password: 'irrelevant-hash',
      firstName: 'Next',
      lastName: 'Action',
      money: 0,
    },
  });
  userIds.push(user.id);
  return user;
}

async function makeHorse(user, { years = 7, sex = 'Mare', ...fields } = {}) {
  return createTestHorse(
    prisma,
    {
      name: `TestFixture-nxap-${rand()}`,
      sex,
      age: years,
      dateOfBirth: competitionDateOfBirth(years),
      healthStatus: 'Excellent',
      lastFedDate: new Date(),
      userId: user.id,
      ...fields,
    },
    horseIds,
  );
}

async function giveGroom(user, horse, { assignedDaysAgo = 5, groomFields = {} } = {}) {
  const groom = await prisma.groom.create({
    data: {
      name: `TestFixture-nxap-groom-${rand()}`,
      speciality: 'show_handling',
      personality: 'gentle',
      skillLevel: 'expert',
      user: { connect: { id: user.id } },
      ...groomFields,
    },
  });
  groomIds.push(groom.id);
  await prisma.groomAssignment.create({
    data: {
      groom: { connect: { id: groom.id } },
      foal: { connect: { id: horse.id } },
      user: { connect: { id: user.id } },
      isActive: true,
      createdAt: new Date(Date.now() - assignedDaysAgo * DAY_MS),
    },
  });
  return groom;
}

async function nextActions(user) {
  const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  const res = await request(app)
    .get('/api/v1/next-actions')
    .set('Origin', 'http://localhost:3000')
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  return res.body.data.actions;
}

let conformationShow;

beforeAll(async () => {
  const now = Date.now();
  conformationShow = await prisma.show.create({
    data: {
      name: `TestFixture-nxap-conf-${rand()}`,
      discipline: 'Conformation',
      showType: 'conformation',
      levelMin: 1,
      levelMax: 999,
      entryFee: 0,
      prize: 0,
      runDate: new Date(now + 2 * 60 * 1000),
      status: 'open',
      openDate: new Date(now - 60 * 1000),
      closeDate: new Date(now + 2 * 60 * 1000),
    },
  });
  showIds.push(conformationShow.id);
}, 60000);

afterAll(() => cleanup.run(), 60000);

describe('train and breed suggestions follow the horse age policy (Equoria-2nacc)', () => {
  it('offers a 20-year-old for training and breeding', async () => {
    const user = await makeUser();
    const horse = await makeHorse(user, { years: 20 });
    const actions = await nextActions(user);
    expect(actions.filter(a => a.horseId === horse.id).map(a => a.type)).toEqual(
      expect.arrayContaining(['train', 'breed']),
    );
  });

  it('offers a retired 21-year-old for neither training nor breeding', async () => {
    const user = await makeUser();
    const horse = await makeHorse(user, { years: 21 });
    const actions = await nextActions(user);
    expect(actions.filter(a => a.horseId === horse.id && ['train', 'breed'].includes(a.type))).toEqual([]);
  });
});

describe('the compete suggestion lists conformation shows with a groom check (Equoria-576c0.2)', () => {
  const conformationCompete = actions =>
    actions.filter(a => a.type === 'compete' && a.metadata?.showId === conformationShow.id);

  it('suggests a conformation show for a horse with a groom assigned', async () => {
    const user = await makeUser();
    const horse = await makeHorse(user, { years: 1, trainingCooldown: new Date(Date.now() + DAY_MS) });
    await giveGroom(user, horse);
    const compete = conformationCompete(await nextActions(user));
    expect(compete).toHaveLength(1);
    expect(compete[0]).toMatchObject({ horseId: horse.id });
  });

  it('does not suggest it for a horse with no groom', async () => {
    const user = await makeUser();
    await makeHorse(user, { years: 1, trainingCooldown: new Date(Date.now() + DAY_MS) });
    expect(conformationCompete(await nextActions(user))).toHaveLength(0);
  });

  it('does not suggest it when the groom was only just assigned', async () => {
    const user = await makeUser();
    const horse = await makeHorse(user, { years: 1, trainingCooldown: new Date(Date.now() + DAY_MS) });
    await giveGroom(user, horse, { assignedDaysAgo: 0 });
    expect(conformationCompete(await nextActions(user))).toHaveLength(0);
  });

  it('does not suggest it when the groom cannot work (retired)', async () => {
    const user = await makeUser();
    const horse = await makeHorse(user, { years: 1, trainingCooldown: new Date(Date.now() + DAY_MS) });
    await giveGroom(user, horse, { groomFields: { retired: true } });
    expect(conformationCompete(await nextActions(user))).toHaveLength(0);
  });

  it('does not suggest it for a horse already entered', async () => {
    const user = await makeUser();
    const horse = await makeHorse(user, { years: 1, trainingCooldown: new Date(Date.now() + DAY_MS) });
    await giveGroom(user, horse);
    await prisma.showEntry.create({
      data: { showId: conformationShow.id, horseId: horse.id, userId: user.id, feePaid: 0 },
    });
    expect(conformationCompete(await nextActions(user))).toHaveLength(0);
  });
});
