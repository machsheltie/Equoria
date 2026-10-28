/**
 * horseDisciplineScores.integration.test.mjs (Equoria-a0fim)
 *
 * GET /api/v1/horses/:id/discipline-scores — the Discipline Scores on the
 * horse page's Progression section (owner request 2026-10-28): every
 * discipline with the horse's score (its three stats 50/30/20 + its training
 * in that discipline + saddle and bridle points; no health, temperament, rider
 * or luck) and the level of that score (owner ruling 2026-10-23: 50-point
 * levels to 500, then 100-point levels).
 *
 * The score must be the number the nightly show executor starts from, so the
 * suite scores the same stored horse with the executor's scoreShowEntries and
 * compares, discipline by discipline.
 *
 * Real Express app, real database, fixtures owned and removed by this suite.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../app.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { createTestUser, cleanupTestData } from '../tests/helpers/testAuth.mjs';
import { createTestHorse } from './helpers/createTestHorse.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';
import { applyPercentTerms, scoreShowEntries } from '../modules/competition/services/competitionScoring.mjs';
import { competitionDisciplines } from '../modules/competition/index.mjs';
import { levelForScore } from '../utils/competitionLogic.mjs';

const uid = () => randomBytes(5).toString('hex');
const own = createCleanupTracker();

let ownerToken;
let otherToken;
let horse;

beforeAll(async () => {
  const owner = await createTestUser({ username: `TestFixture-a0fim-owner-${uid()}` });
  const other = await createTestUser({ username: `TestFixture-a0fim-other-${uid()}` });
  ownerToken = owner.token;
  otherToken = other.token;
  horse = await createTestHorse(prisma, {
    name: `TestFixture-a0fim-horse-${uid()}`,
    sex: 'Mare',
    dateOfBirth: new Date('2020-01-01T12:00:00Z'),
    age: 6,
    user: { connect: { id: owner.user.id } },
    speed: 40,
    stamina: 45,
    agility: 55,
    balance: 51,
    precision: 80,
    intelligence: 50,
    boldness: 65,
    flexibility: 35,
    obedience: 60,
    focus: 70,
    // Three weeks of Dressage training; a stale value for a discipline name
    // outside the 24 must add nothing anywhere.
    disciplineScores: { Dressage: 15, 'Obedience Training': 40 },
    tack: { saddle: 'dressage-saddle', bridle: 'dressage-bridle' },
    temperament: 'Calm',
    healthStatus: 'Excellent',
  });
  own.add(() => prisma.horse.deleteMany({ where: { id: horse.id } }), `horse ${horse.id}`);
}, 60000);

afterAll(async () => {
  await own.run();
  await cleanupTestData();
}, 60000);

const get = (id, token) => {
  const req = request(app).get(`/api/v1/horses/${id}/discipline-scores`).set('Origin', 'http://localhost:3000');
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
};

describe('GET /api/v1/horses/:id/discipline-scores (Equoria-a0fim)', () => {
  it('lists all 24 disciplines in bible order with a score and its level', async () => {
    const res = await get(horse.id, ownerToken);
    expect(res.status).toBe(200);
    const { disciplines } = res.body.data;
    expect(disciplines.map(d => d.discipline)).toEqual([...competitionDisciplines]);
    for (const d of disciplines) {
      expect(d.level).toBe(levelForScore(d.score));
    }
  });

  it('adds training and tack only in their own discipline and rounds x.5 up', async () => {
    const res = await get(horse.id, ownerToken);
    const byName = Object.fromEntries(res.body.data.disciplines.map(d => [d.discipline, d]));
    // Dressage: 0.5*80 + 0.3*70 + 0.2*60 = 73; trained +15; Dressage saddle
    // and bridle +5 each -> 98, level 2 (50-99).
    expect(byName.Dressage).toEqual({ discipline: 'Dressage', score: 98, level: 2 });
    // Hunter: 0.5*51 + 0.3*80 + 0.2*50 = 59.5 -> 60; no Hunter training or
    // tack. Level 2.
    expect(byName.Hunter).toEqual({ discipline: 'Hunter', score: 60, level: 2 });
    // Racing: 0.5*40 + 0.3*45 + 0.2*70 = 47.5 -> 48, level 1. Health
    // (Excellent) and temperament (Calm) are show-day terms and add nothing.
    expect(byName.Racing).toEqual({ discipline: 'Racing', score: 48, level: 1 });
  });

  it('equals the flat score the nightly executor starts from, in every discipline', async () => {
    const res = await get(horse.id, ownerToken);
    const stored = await prisma.horse.findUnique({ where: { id: horse.id } });
    for (const { discipline, score } of res.body.data.disciplines) {
      const [scored] = scoreShowEntries({
        show: { id: 0, discipline },
        entries: [{ horseId: stored.id, horse: stored }],
        assignmentByHorseId: new Map(),
        rng: () => 0,
      });
      const { base, trainingPoints, tackPoints } = scored.breakdown;
      expect({ discipline, score }).toEqual({
        discipline,
        score: applyPercentTerms(base + trainingPoints + tackPoints, []),
      });
    }
  });

  it("answers 404 for another player's horse and 401 without a session", async () => {
    expect((await get(horse.id, otherToken)).status).toBe(404);
    expect((await get(horse.id)).status).toBe(401);
  });
});
