/**
 * horseDisciplineLevelOneSource.integration.test.mjs (Equoria-n56bt)
 *
 * A horse has one level per discipline, from one source: the nightly show
 * scorer's flat score (the discipline's three stats weighted 50/30/20, plus the
 * horse's trained value in that discipline, plus its saddle and bridle points;
 * owner rulings 2026-10-07 and 2026-10-23) put through the one level table
 * (`levelForScore`, owner ruling 2026-10-23). Traits add nothing to a show score
 * until the trait rework (owner ruling 2026-10-23), so they add nothing to the
 * level either.
 *
 * Old contract (the defect): the show's entered field and the eligibility
 * summary used calculateHorseLevel, which averaged the three stats equally,
 * added trait bonuses twice and ignored tack, so the show list could show a
 * different level from the horse page's Discipline Scores.
 *
 * For the same stored horse, in several disciplines, with tack, training and a
 * roster trait, this suite requires:
 *   show entered-field level == horse page level == eligibility level
 *   == levelForScore(the scorer's own base + training + tack).
 *
 * Real Express app, real database, fixtures owned and removed by this suite.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../app.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { createTestUser, createTestShow, cleanupTestData } from '../tests/helpers/testAuth.mjs';
import { createTestHorse } from './helpers/createTestHorse.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';
import { applyPercentTerms, scoreShowEntries } from '../modules/competition/services/competitionScoring.mjs';
import { levelForScore } from '../utils/competitionLogic.mjs';

const uid = () => randomBytes(5).toString('hex');
const origin = 'http://localhost:3000';
const disciplines = ['Dressage', 'Racing', 'Hunter', 'Show Jumping'];

const own = createCleanupTracker();
let token;
let horse;
const showByDiscipline = new Map();

beforeAll(async () => {
  const owner = await createTestUser({ username: `TestFixture-n56bt-owner-${uid()}` });
  token = owner.token;
  horse = await createTestHorse(prisma, {
    name: `TestFixture-n56bt-horse-${uid()}`,
    sex: 'Mare',
    dateOfBirth: new Date('2020-01-01T12:00:00Z'),
    age: 6,
    user: { connect: { id: owner.user.id } },
    speed: 40,
    stamina: 45,
    agility: 55,
    balance: 60,
    precision: 90,
    intelligence: 30,
    boldness: 65,
    flexibility: 35,
    obedience: 30,
    focus: 40,
    // Six weeks of Dressage training and one of Racing.
    disciplineScores: { Dressage: 30, Racing: 5 },
    // Dressage saddle: +5 in Dressage only. All Purpose bridle: +2 everywhere.
    tack: { saddle: 'dressage-saddle', bridle: 'all-purpose-bridle' },
    // A revealed roster trait: no effect on any show score, so none on a level.
    epigeneticModifiers: { positive: ['brave'], negative: [], hidden: [] },
    temperament: 'Calm',
    healthStatus: 'Excellent',
  });
  own.add(() => prisma.showEntry.deleteMany({ where: { horseId: horse.id } }), `entries of horse ${horse.id}`);
  own.add(() => prisma.horse.deleteMany({ where: { id: horse.id } }), `horse ${horse.id}`);
  for (const discipline of disciplines) {
    const show = await createTestShow({
      name: `TestFixture-n56bt-${discipline}`,
      discipline,
      hostUserId: owner.user.id,
      status: 'open',
      closeDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      maxEntries: 10,
    });
    showByDiscipline.set(discipline, show);
    await prisma.showEntry.create({
      data: { showId: show.id, horseId: horse.id, userId: owner.user.id, feePaid: 100 },
    });
  }
}, 60000);

afterAll(async () => {
  await own.run();
  await cleanupTestData();
}, 60000);

const get = path => request(app).get(path).set('Origin', origin).set('Authorization', `Bearer ${token}`);

async function scorerLevel(discipline) {
  const stored = await prisma.horse.findUnique({ where: { id: horse.id } });
  const [scored] = scoreShowEntries({
    show: { id: 0, discipline },
    entries: [{ horseId: stored.id, horse: stored }],
    assignmentByHorseId: new Map(),
    rng: () => 0,
  });
  const { base, trainingPoints, tackPoints } = scored.breakdown;
  return levelForScore(applyPercentTerms(base + trainingPoints + tackPoints, []));
}

describe('one discipline level for a horse (Equoria-n56bt)', () => {
  it('the show list, the horse page, the eligibility summary and the scorer agree in every discipline', async () => {
    const page = await get(`/api/v1/horses/${horse.id}/discipline-scores`);
    expect(page.status).toBe(200);
    const pageLevel = Object.fromEntries(page.body.data.disciplines.map(d => [d.discipline, d.level]));

    for (const discipline of disciplines) {
      const field = await get(`/api/v1/competition/show/${showByDiscipline.get(discipline).id}/entries`);
      expect(field.status).toBe(200);
      const entry = field.body.entries.find(e => e.horseId === horse.id);

      const eligibility = await get(`/api/v1/competition/eligibility/${horse.id}/${encodeURIComponent(discipline)}`);
      expect(eligibility.status).toBe(200);

      const expected = await scorerLevel(discipline);
      expect({
        discipline,
        showList: entry.level,
        horsePage: pageLevel[discipline],
        eligibility: eligibility.body.data.eligibility.horseLevel,
      }).toEqual({ discipline, showList: expected, horsePage: expected, eligibility: expected });
    }
  });

  it('weights the stats 50/30/20 and counts training and tack, never traits', async () => {
    const field = async discipline => {
      const res = await get(`/api/v1/competition/show/${showByDiscipline.get(discipline).id}/entries`);
      return res.body.entries.find(e => e.horseId === horse.id).level;
    };
    // Dressage: 0.5*90 + 0.3*40 + 0.2*30 = 63; trained +30; Dressage saddle +5
    // and All Purpose bridle +2 -> 100, level 3. (Equal average + training
    // without tack read 83, level 2.)
    expect(await field('Dressage')).toBe(3);
    // Racing: 0.5*40 + 0.3*45 + 0.2*40 = 41.5; trained +5; All Purpose bridle
    // +2 (the Dressage saddle scores 0 here) -> 48.5, rounds to 49, level 1.
    // (The trait bonus counted twice used to lift it to level 2.)
    expect(await field('Racing')).toBe(1);
  });
});
