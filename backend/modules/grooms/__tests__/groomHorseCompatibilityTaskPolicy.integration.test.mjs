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
import { getPersonalityTraitDefinitions, calculatePersonalityModifiers } from '../services/groomPersonalityTraits.mjs';

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
let fearfulFlagHorse;
let braveFlagHorse;
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
  // Flags that make a trait with a task bonus compatible (see groomPersonalityTraits.mjs):
  // calm 'gentle' (trustBuilding 1.4) is compatibleWith fearful; energetic 'enthusiastic'
  // (stimulationBonus 1.4) is compatibleWith brave.
  fearfulFlagHorse = await prisma.horse.create({
    data: { ...horseData(user.id, `Policy Fearful Horse ${uid}`), epigeneticFlags: ['fearful'] },
  });
  braveFlagHorse = await prisma.horse.create({
    data: { ...horseData(user.id, `Policy Brave Horse ${uid}`), epigeneticFlags: ['brave'] },
  });
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
  it('policy personalities === config-advertised personalityTypes === personality definitions', async () => {
    const res = await getAuthed('/config');
    expect(res.status).toBe(200);
    const { personalities } = await getPersonalityTraitDefinitions();
    const defined = sorted(Object.keys(personalities));
    expect(sorted(res.body.data.personalityTypes)).toEqual(defined);
    const { GROOM_HORSE_COMPATIBILITY_PERSONALITIES } = await import(POLICY_MODULE);
    expect(sorted(GROOM_HORSE_COMPATIBILITY_PERSONALITIES)).toEqual(defined);
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
  it("old input 'grooming' (formerly scored a silent 1.0; now rejected per Equoria-q4uem.3): POST /calculate returns 400", async () => {
    const res = await postWithCsrf('/calculate', {
      groomId: groomsByPersonality.calm.id,
      horseId: horse.id,
      context: { taskType: 'grooming' },
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Task type must be a valid task type');
  });

  it("old input 'grooming' (formerly scored a silent 1.0; now rejected per Equoria-q4uem.3): the scorer throws a 400", async () => {
    await expect(
      calculateDynamicCompatibility(groomsByPersonality.calm.id, horse.id, { taskType: 'grooming' }),
    ).rejects.toMatchObject({ message: 'Unsupported compatibility task type: grooming', statusCode: 400 });
  });

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
    const unsupported = {
      message: `Unsupported compatibility task type: ${UNSUPPORTED_TASK}`,
      statusCode: 400,
    };
    await expect(calculateDynamicCompatibility(groomsByPersonality.calm.id, horse.id, context)).rejects.toMatchObject(
      unsupported,
    );
    await expect(predictInteractionOutcome(groomsByPersonality.calm.id, horse.id, context)).rejects.toMatchObject(
      unsupported,
    );
    await expect(getOptimalGroomRecommendations(horse.id, context)).rejects.toMatchObject(unsupported);
  });

  it('the policy lookup throws a 400 for an unsupported task or personality', async () => {
    const { getTaskCompatibilityModifier } = await import(POLICY_MODULE);
    const thrownBy = fn => {
      try {
        fn();
      } catch (error) {
        return { message: error.message, statusCode: error.statusCode };
      }
      return null;
    };
    expect(thrownBy(() => getTaskCompatibilityModifier(UNSUPPORTED_TASK, 'calm'))).toEqual({
      message: `Unsupported compatibility task type: ${UNSUPPORTED_TASK}`,
      statusCode: 400,
    });
    expect(thrownBy(() => getTaskCompatibilityModifier('constructor', 'calm'))).toEqual({
      message: 'Unsupported compatibility task type: constructor',
      statusCode: 400,
    });
    expect(thrownBy(() => getTaskCompatibilityModifier('trust_building', 'grumpy'))).toEqual({
      message: 'Unsupported groom personality: grumpy',
      statusCode: 400,
    });
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

// Characterization (Equoria-q4uem.3 fix round 1): trust_building and desensitization
// through the FULL scorer, with a groom whose trait carries that task's bonus and a horse
// whose flags make the trait compatible. Pins today's values; no mechanics change.
//
// Observed behaviour, pinned as-is: the trait task bonus is computed by
// calculatePersonalityModifiers (taskEffectiveness rises), but the scorer uses only that
// call's compatibilityScore, so the bonus does not reach the compatibility result. The
// result differs from the coat_check control by exactly the policy task modifier.
describe('trait task bonuses through the full scorer (characterization)', () => {
  const cases = [
    // [taskType, personality, horse, policy modifier, task overall, task effectiveness]
    ['trust_building', 'calm', () => fearfulFlagHorse, 1.3, 1.2441, 1.23548085528],
    ['desensitization', 'energetic', () => braveFlagHorse, 1.1, 1.0527, 1.23548085528],
  ];
  const CONTROL_OVERALL = 0.957;
  const CONTROL_TASK_EFFECTIVENESS = 1.14736335;
  const BASE_COMPATIBILITY = 0.725;

  it.each(cases)(
    '%s with a %s groom: policy modifier applied, trait bonus present in taskEffectiveness, coat_check control lower',
    async (taskType, personality, getHorse, policyModifier, overall, taskEffectiveness) => {
      const groomId = groomsByPersonality[personality].id;
      const horseId = getHorse().id;
      const task = await calculateDynamicCompatibility(groomId, horseId, { taskType });
      const control = await calculateDynamicCompatibility(groomId, horseId, { taskType: 'coat_check' });
      const taskMods = await calculatePersonalityModifiers(groomId, horseId, taskType);
      const controlMods = await calculatePersonalityModifiers(groomId, horseId, 'coat_check');

      // Policy task modifier, through the full scorer.
      expect(task.taskSpecificModifier).toBe(policyModifier);
      expect(control.taskSpecificModifier).toBe(1);
      expect(task.overallScore).toBeCloseTo(overall, 6);
      expect(control.overallScore).toBeCloseTo(CONTROL_OVERALL, 6);
      expect(control.overallScore).toBeLessThan(task.overallScore);

      // Trait task bonus: present in the personality modifiers, higher than the control.
      expect(taskMods.taskEffectiveness).toBeCloseTo(taskEffectiveness, 6);
      expect(controlMods.taskEffectiveness).toBeCloseTo(CONTROL_TASK_EFFECTIVENESS, 6);
      expect(controlMods.taskEffectiveness).toBeLessThan(taskMods.taskEffectiveness);

      // ...but it does not reach the scorer: base compatibility is task-independent and
      // the score ratio is exactly the policy modifier.
      expect(task.baseCompatibility).toBeCloseTo(BASE_COMPATIBILITY, 6);
      expect(control.baseCompatibility).toBeCloseTo(BASE_COMPATIBILITY, 6);
      expect(task.overallScore / control.overallScore).toBeCloseTo(policyModifier, 6);
    },
  );
});
