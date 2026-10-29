/**
 * Horse Prestige (Equoria-jyf8c, audit COMP-04).
 *
 * The defect: Horse Prestige did not exist. Owner ruling q255 (2026-10-28): a
 * horse earns Prestige from its placings, plus bonuses for big fields and repeat
 * wins. The numbers are placeholders pending the owner, so every expectation
 * here is computed from horsePrestigeRules, never from literal values.
 *
 * Real DB and the real GET /api/v1/horses/:horseId/competition-history route.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import config from '../../../config/config.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { horsePrestigeRules, scoreHorsePrestige } from '../services/horsePrestige.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

const prefix = 'TestFixture-jyf8c';
const tag = () => randomBytes(4).toString('hex');
const rules = horsePrestigeRules;
const bigField = rules.bigField.minimumEntrants;

const userIds = [];
const horseIds = [];
const showIds = [];
const cleanup = createCleanupTracker();
let owner;
let token;
let star;

async function makeHorse(userId) {
  const horse = await prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: `${prefix}-horse-${tag()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-06-15'),
      age: 7,
      userId,
    }),
  });
  horseIds.push(horse.id);
  return horse;
}

/** One settled show: `star` takes `placement` in a field of `fieldSize` horses. */
async function settledShow(placement, fieldSize, daysAgo) {
  const runDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  const show = await prisma.show.create({
    data: {
      name: `${prefix}-show-${tag()}`,
      discipline: 'Dressage',
      entryFee: 0,
      levelMin: 1,
      levelMax: 20,
      prize: 0,
      runDate,
      status: 'completed',
    },
  });
  showIds.push(show.id);
  const others = [];
  for (let i = 1; i < fieldSize; i++) {
    others.push(await makeHorse(owner.id));
  }
  const placements = [placement, ...others.map((_, i) => (i + 1 < placement ? i + 1 : i + 2))];
  const field = [star, ...others];
  await prisma.competitionResult.createMany({
    data: field.map((horse, i) => ({
      showId: show.id,
      horseId: horse.id,
      score: 100 - placements[i],
      placement: placements[i],
      discipline: 'Dressage',
      runDate,
      showName: show.name,
      prizeWon: 0,
    })),
  });
}

beforeAll(async () => {
  cleanup.add(() => prisma.competitionResult.deleteMany({ where: { showId: { in: showIds } } }), 'competitionResults');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'shows');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');

  owner = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `${prefix}-${tag()}`,
      email: `${prefix}-${tag()}@example.com`,
      password: 'irrelevant-hash',
      firstName: 'Prestige',
      lastName: 'Owner',
    },
  });
  userIds.push(owner.id);
  token = jwt.sign({ id: owner.id, role: owner.role }, config.jwtSecret, { expiresIn: '1h' });
  star = await makeHorse(owner.id);

  await settledShow(1, bigField, 4); // first win, big field
  await settledShow(1, 2, 3); // repeat win, small field
  await settledShow(3, 3, 2); // a 3rd place
  await settledShow(5, 5, 1); // unplaced: no Prestige
}, 120000);

afterAll(() => cleanup.run(), 60000);

describe('Horse Prestige (Equoria-jyf8c)', () => {
  it('scores placings, a big-field bonus and a repeat-win bonus', () => {
    const p = rules.placementPoints;
    expect(
      scoreHorsePrestige([
        { placement: 1, fieldSize: bigField },
        { placement: 1, fieldSize: 2 },
        { placement: 3, fieldSize: 3 },
        { placement: 5, fieldSize: 5 },
      ]),
    ).toBe(p[1] + rules.bigField.bonusPoints + p[1] + rules.repeatWin.bonusPoints + p[3]);
  });

  it('an unplaced horse in a big field earns nothing, and a first win earns no repeat bonus', () => {
    expect(scoreHorsePrestige([{ placement: 9, fieldSize: bigField * 3 }])).toBe(0);
    expect(scoreHorsePrestige([{ placement: 1, fieldSize: 1 }])).toBe(rules.placementPoints[1]);
  });

  it("the horse's competition history reports the Prestige its results earn", async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${star.id}/competition-history`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const p = rules.placementPoints;
    expect(res.body.statistics.prestige).toBe(
      p[1] + rules.bigField.bonusPoints + p[1] + rules.repeatWin.bonusPoints + p[3],
    );
  });
});
