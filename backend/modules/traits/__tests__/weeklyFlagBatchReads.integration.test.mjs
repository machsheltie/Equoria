/**
 * Weekly flag evaluation reads the cohort set-based (Equoria-cmw85.38).
 *
 * DECISION 2026-10-23 (option B; owner asked what is best long term for
 * thousands of players and horses): the weekly trait/flag job uses set-based,
 * batched READS with SERIAL writes. No extra database connections — production
 * runs a pool of 3 and the job already holds one for its advisory lock.
 *
 * Before: batchEvaluateFlags evaluated one horse at a time — a horse read, a
 * parents read and a horse-plus-interactions read per horse (4 SQL statements),
 * so a cohort of N cost ~4N round-trips before any write.
 * After: one horse read with the cohort's care-window interactions and one
 * parents read per batch, whatever N; writes stay one guarded update per horse
 * that gains flags, in order.
 *
 * PROOF, on the real database with the real engine (no mocks):
 *   - counted operations through a real Prisma $extends interceptor over the
 *     real client (queries still run): reads are a constant 2 for the cohort,
 *     writes equal the horses that gained flags;
 *   - identical results: two cohorts with identical fixtures; cohort A goes
 *     through evaluateHorseFlags one horse at a time (exactly what the old batch
 *     did), cohort B through batchEvaluateFlags. Results and the stored flags
 *     must match field for field. This half also passes on the old code, which
 *     is the point — the outputs do not change, only the query shape.
 * Fixtures per cohort: a foal predisposed by its parents' 'affectionate' flag
 * with borderline care (develops it), a control foal with the same care and
 * flagless parents (does not), a foal past the 0-3 window (refused by age) and
 * an id that does not exist (error entry).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { batchEvaluateFlags, evaluateHorseFlags } from '../../../utils/flagEvaluationEngine.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';

const scope = 'TestFixture-cmw85_38';
const run = randomBytes(5).toString('hex');
const dayMs = 24 * 60 * 60 * 1000;
const cleanup = createCleanupTracker();
const horseIds = [];
let user;
let groom;

/** Six good grooming days in the last week: just under affectionate's 7-day bar. */
async function seedBorderlineCare(foalId) {
  const rows = [];
  for (let daysAgo = 1; daysAgo <= 6; daysAgo += 1) {
    const when = new Date(Date.now() - daysAgo * dayMs);
    rows.push({
      foalId,
      groomId: groom.id,
      interactionType: 'dailyGrooming',
      duration: 30,
      bondingChange: 3,
      quality: 'good',
      taskType: 'grooming',
      qualityScore: 0.8,
      createdAt: when,
      timestamp: when,
    });
  }
  await prisma.groomInteraction.createMany({ data: rows });
}

async function horse(key, data) {
  return createTestHorse(prisma, { name: `${scope}-${key}-${run}`, userId: user.id, ...data }, horseIds);
}

/** One cohort: predisposed foal, control foal, too-old horse, missing id. */
async function makeCohort(tag) {
  const adultDob = gameCalendarDate(new Date(), -60);
  const flaggedSire = await horse(`${tag}-fsire`, {
    sex: 'Stallion',
    dateOfBirth: adultDob,
    epigeneticFlags: ['affectionate'],
  });
  const flaggedDam = await horse(`${tag}-fdam`, {
    sex: 'Mare',
    dateOfBirth: adultDob,
    epigeneticFlags: ['affectionate'],
  });
  const plainSire = await horse(`${tag}-psire`, { sex: 'Stallion', dateOfBirth: adultDob, epigeneticFlags: [] });
  const plainDam = await horse(`${tag}-pdam`, { sex: 'Mare', dateOfBirth: adultDob, epigeneticFlags: [] });
  const foalDob = gameCalendarDate(new Date(), -7);
  const foal = { sex: 'Filly', dateOfBirth: foalDob, bondScore: 50, epigeneticFlags: [] };
  const predisposed = await horse(`${tag}-pfoal`, { ...foal, sireId: flaggedSire.id, damId: flaggedDam.id });
  const control = await horse(`${tag}-cfoal`, { ...foal, sireId: plainSire.id, damId: plainDam.id });
  // 35 Eastern days = 5 game-years: past the 0-3 evaluation window.
  const tooOld = await horse(`${tag}-old`, { ...foal, dateOfBirth: gameCalendarDate(new Date(), -35) });
  await seedBorderlineCare(predisposed.id);
  await seedBorderlineCare(control.id);
  await seedBorderlineCare(tooOld.id);
  // An id above every existing horse id that this suite never creates.
  const missingId = 2_000_000_000 - Math.floor(Math.random() * 1_000_000);
  return { ids: [predisposed.id, control.id, tooOld.id, missingId] };
}

/** What the result says about the horse, without the horse's own id and name. */
function normalized(result) {
  const copy = JSON.parse(JSON.stringify(result));
  delete copy.horseId;
  delete copy.horseName;
  if (copy.careAnalysis) {
    delete copy.careAnalysis.horseId;
  }
  if (typeof copy.error === 'string') {
    copy.error = copy.error.replace(/\d+/g, '<id>');
  }
  return copy;
}

let cohortA;
let cohortB;
const evaluationDate = new Date();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      username: `${scope}-${run}`,
      email: `${scope}-${run}@example.com`,
      password: 'x',
      firstName: 'TestFixture',
      lastName: 'FlagBatch',
    },
  });
  groom = await prisma.groom.create({
    data: {
      name: `${scope}-groom-${run}`,
      speciality: 'foalCare',
      personality: 'gentle',
      skillLevel: 'expert',
      userId: user.id,
    },
  });
  cleanup.add(() => prisma.groomInteraction.deleteMany({ where: { foalId: { in: horseIds } } }), 'interactions');
  // Children before parents (self FK), then the groom and the user.
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds }, sireId: { not: null } } }), 'foals');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.groom.deleteMany({ where: { id: groom.id } }), 'groom');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');

  cohortA = await makeCohort('a');
  cohortB = await makeCohort('b');
}, 60_000);

afterAll(() => cleanup.run(), 60_000);

describe('weekly flag evaluation — set-based reads, serial writes (Equoria-cmw85.38)', () => {
  let perHorse;
  let batched;
  const operations = [];

  beforeAll(async () => {
    // The old batch: one horse at a time, an error entry for a horse that throws.
    perHorse = [];
    for (const horseId of cohortA.ids) {
      try {
        perHorse.push(await evaluateHorseFlags(horseId, evaluationDate));
      } catch (error) {
        perHorse.push({ success: false, horseId, error: error.message });
      }
    }

    const counted = prisma.$extends({
      query: {
        async $allOperations({ model, operation, args, query }) {
          operations.push({ model, operation });
          return query(args);
        },
      },
    });
    batched = await batchEvaluateFlags(cohortB.ids, evaluationDate, { client: counted });
  }, 60_000);

  it('the cohort is read with a constant two reads, and only flag gains are written', () => {
    const reads = operations.filter(o => /^(find|count|aggregate|groupBy)/.test(o.operation));
    const writes = operations.filter(o => !reads.includes(o));
    expect(reads).toEqual([
      { model: 'Horse', operation: 'findMany' },
      { model: 'Horse', operation: 'findMany' },
    ]);
    const gained = batched.filter(r => r.success && r.newFlags.length > 0).length;
    expect(gained).toBe(1);
    expect(writes).toEqual([{ model: 'Horse', operation: 'update' }]);
  });

  it('results are identical to evaluating the same horses one at a time', () => {
    expect(batched).toHaveLength(cohortB.ids.length);
    expect(batched.map(r => r.horseId)).toEqual(cohortB.ids);
    expect(batched.map(normalized)).toEqual(perHorse.map(normalized));
  });

  it('the outcomes are the engine rules: predisposed foal develops affectionate, control and too-old do not, missing id errors', () => {
    const [predisposed, control, tooOld, missing] = batched;
    expect(predisposed.success).toBe(true);
    expect(predisposed.newFlags).toContain('affectionate');
    expect(control.success).toBe(true);
    expect(control.newFlags).not.toContain('affectionate');
    expect(tooOld.success).toBe(false);
    expect(tooOld.reason).toMatch(/outside evaluation range/);
    expect(missing).toEqual({
      success: false,
      horseId: cohortB.ids[3],
      error: `Horse with ID ${cohortB.ids[3]} not found`,
    });
  });

  it('the stored flags match too', async () => {
    const stored = async ids => {
      const rows = await prisma.horse.findMany({
        where: { id: { in: ids.slice(0, 3) } },
        select: { id: true, epigeneticFlags: true },
      });
      const byId = Object.fromEntries(rows.map(r => [r.id, r.epigeneticFlags]));
      return ids.slice(0, 3).map(id => byId[id]);
    };
    expect(await stored(cohortB.ids)).toEqual(await stored(cohortA.ids));
    expect((await stored(cohortB.ids))[0]).toContain('affectionate');
  });
});
