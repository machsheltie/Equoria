/**
 * Groom/horse compatibility task policy (Equoria-q4uem.3).
 *
 * One policy owns the compatibility task vocabulary and the per-personality task
 * weighting. These tests pin that the route validator, the public config endpoint
 * and the scorer all read it, so the three can no longer drift (before q4uem.3 the
 * routes accepted 8 tasks, the config advertised 5, and the scorer silently scored
 * any unknown task as 1.0).
 *
 * The modifier table below is copied verbatim from the pre-refactor scorer
 * (calculateTaskSpecificModifier). Owner ruling: no mechanics changes without the
 * owner, so a change to any number here needs an explicit owner decision.
 *
 * Real Express app, real test database, no mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import dynamicCompatibilityRoutes from '../routes/dynamicCompatibilityRoutes.mjs';
import {
  calculateDynamicCompatibility,
  predictInteractionOutcome,
  getOptimalGroomRecommendations,
} from '../services/dynamicCompatibilityScoring.mjs';
import { getPersonalityTraitDefinitions } from '../services/groomPersonalityTraits.mjs';

const ORIGIN = 'http://localhost:3000';
const POLICY_MODULE = '../services/groomHorseCompatibilityTaskPolicy.mjs';

// Pre-refactor scorer values, verbatim. `balanced` (the Groom schema default) was
// not in the scorer's table and fell through to the `|| 1.0` fallback, as did the
// three accepted-but-unlisted tasks.
const EXPECTED_TASK_MODIFIERS = {
  trust_building: { calm: 1.3, methodical: 1.1, energetic: 0.8, balanced: 1 },
  desensitization: { energetic: 1.1, calm: 1.2, methodical: 0.9, balanced: 1 },
  hoof_handling: { methodical: 1.2, calm: 1.1, energetic: 0.8, balanced: 1 },
  showground_exposure: { energetic: 1.2, calm: 0.9, methodical: 1, balanced: 1 },
  sponge_bath: { calm: 1.2, methodical: 1.3, energetic: 0.9, balanced: 1 },
  coat_check: { calm: 1, energetic: 1, methodical: 1, balanced: 1 },
  tying_practice: { calm: 1, energetic: 1, methodical: 1, balanced: 1 },
  early_touch: { calm: 1, energetic: 1, methodical: 1, balanced: 1 },
};
const FORMERLY_UNSCORED_TASKS = ['coat_check', 'tying_practice', 'early_touch'];
const UNSUPPORTED_TASK = 'grooming';
const TASK_ROUTES = ['/calculate', '/predict', '/recommendations'];

const sorted = values => [...values].sort();

/** The isIn list each route's real express-validator chain applies to context.taskType. */
function routeAcceptedTaskTypes(routePath) {
  const layer = dynamicCompatibilityRoutes.stack.find(l => l.route?.path === routePath);
  expect(layer).toBeDefined();
  const lists = layer.route.stack
    .map(l => l.handle)
    .filter(h => h.builder && typeof h.builder.build === 'function')
    .map(h => h.builder.build())
    .filter(ctx => ctx.fields.includes('context.taskType'))
    .flatMap(ctx => ctx.stack.filter(item => item.validator?.name === 'isIn'))
    .map(item => item.options[0]);
  expect(lists).toHaveLength(1);
  return lists[0];
}

let user;
let token;
let breedId;
let horse;
let foreignUser;
let foreignGroom;
let foreignHorse;
const groomsByPersonality = {};
const cleanup = createCleanupTracker();

function horseData(ownerId, name) {
  return {
    ...fixtureColor(),
    userId: ownerId,
    breedId,
    name,
    sex: 'Filly',
    dateOfBirth: new Date('2023-06-01T12:00:00Z'),
    age: 2,
    temperament: 'developing',
    stressLevel: 5,
    bondScore: 25,
    healthStatus: 'Good',
    epigeneticFlags: [],
  };
}

function groomData(ownerId, name, personality) {
  return {
    userId: ownerId,
    name,
    speciality: 'foal_care',
    personality,
    epigeneticInfluenceType: personality,
    skillLevel: 'intermediate',
    experience: 60,
    level: 4,
    sessionRate: 25.0,
    isActive: true,
  };
}

async function postWithCsrf(path, body) {
  const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
  return request(app)
    .post(`/api/v1/compatibility${path}`)
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

function getAuthed(path) {
  return request(app).get(`/api/v1/compatibility${path}`).set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);
}

beforeAll(async () => {
  const uid = `${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`;

  const breed = await prisma.breed.create({
    data: { name: `TestFixture-CompatPolicy-${uid}`, description: 'compat policy fixture' },
  });
  breedId = breed.id;

  user = await prisma.user.create({
    data: {
      email: `cpolicy-${uid}@test.com`,
      username: `cpolicy${uid.replace('_', '')}`,
      password: 'irrelevant-hash',
      firstName: 'Compat',
      lastName: 'Policy',
      money: 0,
      xp: 0,
      level: 1,
    },
  });
  foreignUser = await prisma.user.create({
    data: {
      email: `cpolicyf-${uid}@test.com`,
      username: `cpolicyf${uid.replace('_', '')}`,
      password: 'irrelevant-hash',
      firstName: 'Compat',
      lastName: 'Foreign',
      money: 0,
      xp: 0,
      level: 1,
    },
  });
  // The tracker runs callbacks in registration order: children before parents.
  cleanup.add(() => prisma.horse.deleteMany({ where: { userId: { in: [user.id, foreignUser.id] } } }), 'horses');
  cleanup.add(() => prisma.groom.deleteMany({ where: { userId: { in: [user.id, foreignUser.id] } } }), 'grooms');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: [user.id, foreignUser.id] } } }), 'users');
  cleanup.add(() => prisma.breed.deleteMany({ where: { id: breedId } }), 'breed');
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  for (const personality of ['calm', 'energetic', 'methodical', 'balanced']) {
    groomsByPersonality[personality] = await prisma.groom.create({
      data: groomData(user.id, `Policy ${personality} ${uid}`, personality),
    });
  }
  horse = await prisma.horse.create({ data: horseData(user.id, `Policy Horse ${uid}`) });
  foreignGroom = await prisma.groom.create({
    data: groomData(foreignUser.id, `Foreign Policy Groom ${uid}`, 'calm'),
  });
  foreignHorse = await prisma.horse.create({
    data: horseData(foreignUser.id, `Foreign Policy Horse ${uid}`),
  });
}, 60000);

afterAll(() => cleanup.run(), 60000);

describe('one task vocabulary for validator, config and scorer', () => {
  it('route-accepted task types === config-advertised task types === policy keys', async () => {
    const res = await getAuthed('/config');
    expect(res.status).toBe(200);
    const advertised = res.body.data.taskTypes;

    for (const routePath of TASK_ROUTES) {
      expect(sorted(routeAcceptedTaskTypes(routePath))).toEqual(sorted(advertised));
    }

    const { GROOM_HORSE_COMPATIBILITY_TASK_POLICY, GROOM_HORSE_COMPATIBILITY_TASK_TYPES } = await import(POLICY_MODULE);
    expect(sorted(Object.keys(GROOM_HORSE_COMPATIBILITY_TASK_POLICY))).toEqual(sorted(advertised));
    expect(sorted(GROOM_HORSE_COMPATIBILITY_TASK_TYPES)).toEqual(sorted(advertised));
  });

  it('accepts exactly the eight tasks the routes accepted before q4uem.3', async () => {
    const { GROOM_HORSE_COMPATIBILITY_TASK_TYPES } = await import(POLICY_MODULE);
    expect(sorted(GROOM_HORSE_COMPATIBILITY_TASK_TYPES)).toEqual(sorted(Object.keys(EXPECTED_TASK_MODIFIERS)));
  });
});

describe('task modifiers', () => {
  it('supports exactly the groom personalities the personality service defines', async () => {
    const { GROOM_HORSE_COMPATIBILITY_PERSONALITIES } = await import(POLICY_MODULE);
    const { personalities } = await getPersonalityTraitDefinitions();
    expect(sorted(GROOM_HORSE_COMPATIBILITY_PERSONALITIES)).toEqual(sorted(Object.keys(personalities)));
  });

  it('gives every accepted task an explicit finite modifier for every supported personality', async () => {
    const {
      GROOM_HORSE_COMPATIBILITY_TASK_POLICY,
      GROOM_HORSE_COMPATIBILITY_TASK_TYPES,
      GROOM_HORSE_COMPATIBILITY_PERSONALITIES,
      getTaskCompatibilityModifier,
    } = await import(POLICY_MODULE);
    for (const taskType of GROOM_HORSE_COMPATIBILITY_TASK_TYPES) {
      expect(sorted(Object.keys(GROOM_HORSE_COMPATIBILITY_TASK_POLICY[taskType]))).toEqual(
        sorted(GROOM_HORSE_COMPATIBILITY_PERSONALITIES),
      );
      for (const personality of GROOM_HORSE_COMPATIBILITY_PERSONALITIES) {
        const modifier = getTaskCompatibilityModifier(taskType, personality);
        expect(Number.isFinite(modifier)).toBe(true);
      }
    }
  });

  it('reproduces the pre-refactor scorer values exactly (no mechanics change)', async () => {
    const { GROOM_HORSE_COMPATIBILITY_TASK_POLICY } = await import(POLICY_MODULE);
    expect(GROOM_HORSE_COMPATIBILITY_TASK_POLICY).toEqual(EXPECTED_TASK_MODIFIERS);
  });

  it('keeps coat_check, tying_practice and early_touch neutral (1) for every personality', async () => {
    const { getTaskCompatibilityModifier, GROOM_HORSE_COMPATIBILITY_PERSONALITIES } = await import(POLICY_MODULE);
    for (const taskType of FORMERLY_UNSCORED_TASKS) {
      for (const personality of GROOM_HORSE_COMPATIBILITY_PERSONALITIES) {
        expect(getTaskCompatibilityModifier(taskType, personality)).toBe(1);
      }
    }
  });

  it('scorer applies the table for every task and personality through real grooms', async () => {
    for (const [taskType, byPersonality] of Object.entries(EXPECTED_TASK_MODIFIERS)) {
      for (const [personality, expected] of Object.entries(byPersonality)) {
        const result = await calculateDynamicCompatibility(groomsByPersonality[personality].id, horse.id, { taskType });
        expect({ taskType, personality, modifier: result.taskSpecificModifier }).toEqual({
          taskType,
          personality,
          modifier: expected,
        });
      }
    }
  }, 60000);
});

describe('unsupported task types are rejected, never defaulted', () => {
  it.each(TASK_ROUTES)('POST %s rejects an unsupported task with 400', async routePath => {
    const res = await postWithCsrf(routePath, {
      groomId: groomsByPersonality.calm.id,
      horseId: horse.id,
      context: { taskType: UNSUPPORTED_TASK },
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Task type must be a valid task type');
  });

  it('the scorer throws for an unsupported task instead of scoring it neutral', async () => {
    const context = { taskType: UNSUPPORTED_TASK };
    const unsupported = { message: `Unsupported compatibility task type: ${UNSUPPORTED_TASK}` };
    await expect(calculateDynamicCompatibility(groomsByPersonality.calm.id, horse.id, context)).rejects.toMatchObject(
      unsupported,
    );
    await expect(predictInteractionOutcome(groomsByPersonality.calm.id, horse.id, context)).rejects.toMatchObject(
      unsupported,
    );
    await expect(getOptimalGroomRecommendations(horse.id, context)).rejects.toMatchObject(unsupported);
  });

  it('the policy lookup throws for an unsupported task or personality', async () => {
    const { getTaskCompatibilityModifier } = await import(POLICY_MODULE);
    expect(() => getTaskCompatibilityModifier(UNSUPPORTED_TASK, 'calm')).toThrow(
      `Unsupported compatibility task type: ${UNSUPPORTED_TASK}`,
    );
    expect(() => getTaskCompatibilityModifier('constructor', 'calm')).toThrow(
      'Unsupported compatibility task type: constructor',
    );
    expect(() => getTaskCompatibilityModifier('trust_building', 'grumpy')).toThrow(
      'Unsupported groom personality: grumpy',
    );
  });
});

// Ownership on every compatibility route that names a groom or horse. The trends
// route's foreign-groom/foreign-horse cases live in
// dynamicCompatibilityController.integration.test.mjs (Equoria-q4uem.2).
describe('ownership is enforced on every compatibility route', () => {
  const task = { taskType: 'trust_building' };

  it('POST /calculate rejects a foreign groom and a foreign horse with 404', async () => {
    const g = await postWithCsrf('/calculate', {
      groomId: foreignGroom.id,
      horseId: horse.id,
      context: task,
    });
    const h = await postWithCsrf('/calculate', {
      groomId: groomsByPersonality.calm.id,
      horseId: foreignHorse.id,
      context: task,
    });
    expect([g.status, h.status]).toEqual([404, 404]);
    expect(g.body.data).toBeUndefined();
    expect(h.body.data).toBeUndefined();
  });

  it('POST /predict rejects a foreign groom and a foreign horse with 404', async () => {
    const g = await postWithCsrf('/predict', {
      groomId: foreignGroom.id,
      horseId: horse.id,
      context: task,
    });
    const h = await postWithCsrf('/predict', {
      groomId: groomsByPersonality.calm.id,
      horseId: foreignHorse.id,
      context: task,
    });
    expect([g.status, h.status]).toEqual([404, 404]);
    expect(g.body.data).toBeUndefined();
    expect(h.body.data).toBeUndefined();
  });

  it('POST /recommendations rejects a foreign horse with 404', async () => {
    const res = await postWithCsrf('/recommendations', { horseId: foreignHorse.id, context: task });
    expect(res.status).toBe(404);
    expect(res.body.data).toBeUndefined();
  });

  it('GET /factors rejects a foreign groom and a foreign horse with 404', async () => {
    const g = await getAuthed(`/factors/${foreignGroom.id}/${horse.id}`);
    const h = await getAuthed(`/factors/${groomsByPersonality.calm.id}/${foreignHorse.id}`);
    expect([g.status, h.status]).toEqual([404, 404]);
    expect(g.body.data).toBeUndefined();
    expect(h.body.data).toBeUndefined();
  });
});
