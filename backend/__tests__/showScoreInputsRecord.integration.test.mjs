/**
 * showScoreInputsRecord.integration.test.mjs (Equoria-4q02c, owner ruling q01)
 *
 * The nightly executor records each ridden entry's score inputs (the luck
 * roll, the temperament modifier and the other factors) on its result. They
 * are visible ONLY to the Owner and Admins, through
 * GET /api/v1/staff/shows/:showId/score-inputs; a moderator is refused, a
 * player never sees them in any result view.
 *
 * One Dressage show, two horses with every stat 100: a Calm horse (+5%
 * temperament) and a Nervous one (-5%). Luck is pinned to +1% through the
 * executor's scoreRng option (rng 0). Real DB, TestFixture- fixtures,
 * id-scoped fail-loud cleanup.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { careForHealth } from './helpers/healthFixture.mjs';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../app.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { executeClosedShows } from '../modules/competition/shows/showExecutionService.mjs';
import { generateTestToken } from '../tests/helpers/authHelper.mjs';
import { createTestHorse } from './helpers/createTestHorse.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';
import {
  checkIn,
  createUserFactory,
  get,
  startEmailCapture,
  stopEmailCapture,
} from '../modules/staff/__tests__/helpers/staffFixtures.mjs';

const uid = () => randomBytes(6).toString('hex');
const cleanup = createCleanupTracker();
const staff = createUserFactory('q01staff');
const staffApi = '/api/v1/staff';
const origin = 'http://localhost:3000';
const stats100 = {
  speed: 100,
  stamina: 100,
  agility: 100,
  balance: 100,
  precision: 100,
  intelligence: 100,
  boldness: 100,
  flexibility: 100,
  obedience: 100,
  focus: 100,
};
const inputKeys = [
  'base',
  'healthPercent',
  'luckPercent',
  'riderPercent',
  'tackPoints',
  'temperamentPercent',
  'trainingPoints',
];

let owner;
let ownerToken;
let show;
let calm;
let nervous;

beforeAll(async () => {
  const horseIds = [];
  cleanup.add(() => prisma.competitionResult.deleteMany({ where: { showId: show.id } }), 'competitionResult');
  cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: show.id } }), 'showEntry');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: show.id } }), 'show');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horse');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: owner.id } }), 'user');
  // Equoria-zwndw: the staff users this suite makes (admin, owner, moderator,
  // player) and what their check-ins write. Left behind, a verified admin or
  // owner is mailed by every later staff-ticket filing.
  const staffScope = () => ({ in: staff.createdUserIds });
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: staffScope() } }), 'action log');
  cleanup.add(() => prisma.notification.deleteMany({ where: { userId: staffScope() } }), 'staff notifications');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: staffScope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: staffScope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: staffScope() } }), 'refresh tokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: staffScope() } }), 'staff users');
  owner = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `q01-${uid()}@test.local`,
      username: `q01${uid()}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'Score',
      lastName: 'Inputs',
      money: 0,
    },
  });
  ownerToken = generateTestToken({ id: owner.id, email: owner.email, role: 'user' });
  const makeHorse = temperament =>
    createTestHorse(
      prisma,
      {
        name: `TestFixture-q01-${uid()}`,
        sex: 'Mare',
        dateOfBirth: new Date('2018-01-01'),
        age: 7,
        userId: owner.id,
        ...careForHealth('Good'),
        lastFedDate: new Date(),
        temperament,
        ...stats100,
      },
      horseIds,
    );
  calm = await makeHorse('Calm');
  nervous = await makeHorse('Nervous');

  const pastClose = new Date(Date.now() - 60 * 60 * 1000);
  show = await prisma.show.create({
    data: {
      name: `TestFixture-q01-${uid()}`,
      discipline: 'Dressage',
      entryFee: 0,
      levelMin: 1,
      levelMax: 999,
      prize: 0,
      runDate: pastClose,
      status: 'open',
      openDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      closeDate: pastClose,
      createdByUserId: owner.id,
    },
  });

  await prisma.showEntry.createMany({
    data: [calm, nervous].map(h => ({ showId: show.id, horseId: h.id, userId: owner.id, feePaid: 0 })),
  });
  await executeClosedShows({ body: { showIds: [show.id] } }, null, {
    scoreRng: () => 0,
    statGainRng: () => 0.999,
  });
}, 90000);

afterAll(() => cleanup.run(), 60000);

describe('settlement records each entry’s score inputs on its result (q01)', () => {
  it('stores the luck roll, temperament modifier and the other factors', async () => {
    const rows = await prisma.competitionResult.findMany({
      where: { showId: show.id },
      select: { horseId: true, score: true, scoreInputs: true },
    });
    const byHorse = new Map(rows.map(r => [r.horseId, r]));

    expect(Object.keys(byHorse.get(calm.id).scoreInputs).sort()).toEqual(inputKeys);
    expect(byHorse.get(calm.id).scoreInputs).toMatchObject({ luckPercent: 1, temperamentPercent: 5 });
    expect(byHorse.get(nervous.id).scoreInputs).toMatchObject({ luckPercent: 1, temperamentPercent: -5 });
    expect(Number(byHorse.get(calm.id).score)).toBe(106);
  });
});

describe('score inputs are for the Owner and Admins only (q01)', () => {
  beforeEach(() => startEmailCapture());
  afterEach(() => stopEmailCapture());

  it('shows them to an admin and to the owner', async () => {
    for (const role of ['admin', 'owner']) {
      const user = await staff.makeUser(role);
      const device = await checkIn(user);
      const res = await get(`${staffApi}/shows/${show.id}/score-inputs`, user, device);
      expect(res.status).toBe(200);
      const calmRow = res.body.results.find(r => r.horseId === calm.id);
      expect(calmRow).toMatchObject({
        horseName: expect.any(String),
        placement: 1,
        score: 106,
        scoreInputs: { luckPercent: 1, temperamentPercent: 5 },
      });
    }
  }, 60000);

  it('refuses a moderator and hides the route from a player', async () => {
    const mod = await staff.makeUser('moderator');
    const modDevice = await checkIn(mod);
    const asMod = await get(`${staffApi}/shows/${show.id}/score-inputs`, mod, modDevice);
    expect(asMod.status).toBe(403);
    expect(asMod.body.results).toBeUndefined();

    const player = await staff.makeUser('user');
    const asPlayer = await get(`${staffApi}/shows/${show.id}/score-inputs`, player);
    expect(asPlayer.status).toBe(404);
    expect(asPlayer.body.results).toBeUndefined();
  }, 60000);

  it('never appears in a player’s result views', async () => {
    const reads = await Promise.all(
      [`/api/v1/competition/show/${show.id}/results`, `/api/v1/competition/results/horse/${calm.id}`].map(path =>
        request(app).get(path).set('Origin', origin).set('Authorization', `Bearer ${ownerToken}`),
      ),
    );
    for (const res of reads) {
      expect(res.status).toBe(200);
      const text = JSON.stringify(res.body);
      expect(text).not.toContain('scoreInputs');
      expect(text).not.toContain('luckPercent');
      expect(text).not.toContain('temperamentPercent');
    }
  });
});
