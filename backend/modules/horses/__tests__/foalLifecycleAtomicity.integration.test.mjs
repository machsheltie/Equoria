/**
 * foalLifecycleAtomicity.integration.test.mjs
 *
 * Real-DB coverage for the foal lifecycle commands' atomicity
 * (Thermo-Nuclear quality repair, Workstream 1).
 *
 * DEFECTS (pre-fix), foalModel.mjs:
 *   - completeEnrichmentActivity ran check -> horse.update -> milestones ->
 *     history.create as separate commits. A failure after the horse update kept
 *     the reward but lost the anti-farming marker, so a retry paid again; two
 *     concurrent identical requests both passed the findFirst pre-check; and two
 *     concurrent DISTINCT activities each wrote bond/stress computed from the
 *     same stale row, so one outcome was lost.
 *   - graduateFoal closed development, cleared assignments, set the user's
 *     firstGraduation flag and recorded foal milestones in separate commits; a
 *     foal with no FoalDevelopment row could graduate repeatedly.
 *
 * Fault injection uses a real, test-owned Postgres trigger scoped to ONE
 * fixture foal and dropped in `finally` — a genuine database failure at the
 * last step of each command, with nothing in Equoria mocked.
 *
 * CONCURRENCY: fan-out N=5 for the identical case (a 2-way race can serialize
 * by luck and false-pass on buggy code — Equoria-n4m5j lesson).
 */

import { randomBytes } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { completeEnrichmentActivity, graduateFoal } from '../models/foalModel.mjs';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const TAG = `ws1atom${randomBytes(4).toString('hex')}`;
const cleanup = createCleanupTracker();
const createdFoalIds = [];
const createdGroomIds = [];
let user;

function dobDaysAgo(days) {
  const d = new Date(Date.now() - days * MS_PER_DAY);
  d.setUTCHours(4, 0, 0, 0);
  return d;
}

async function makeFoal(suffix, { days = 0, age = 0, bondScore = 10, stressLevel = 50 } = {}) {
  const foal = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-${TAG}-${suffix}`,
      sex: 'Filly',
      dateOfBirth: dobDaysAgo(days),
      age,
      bondScore,
      stressLevel,
      userId: user.id,
    },
  });
  createdFoalIds.push(foal.id);
  return foal;
}

/**
 * Install a trigger on foal_development that raises for `foalId` once the
 * milestone store being written contains `milestoneKey`. Returns a drop fn.
 */
async function failMilestoneWrite(foalId, milestoneKey) {
  const fn = `test_${TAG}_fail_${foalId}`;
  const trg = `${fn}_trg`;
  await prisma.$executeRawUnsafe(`
    CREATE FUNCTION ${fn}() RETURNS trigger AS $$
    BEGIN
      IF NEW."foalId" = ${Number(foalId)} AND NEW."completedMilestones" ? '${milestoneKey}' THEN
        RAISE EXCEPTION 'injected test failure (${TAG})';
      END IF;
      RETURN NEW;
    END $$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER ${trg} BEFORE INSERT OR UPDATE ON foal_development FOR EACH ROW EXECUTE FUNCTION ${fn}()`,
  );
  return async () => {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trg} ON foal_development`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${fn}()`);
  };
}

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `${TAG}@test.com`,
      username: TAG,
      password: 'irrelevant-hash',
      firstName: 'WS1',
      lastName: 'Atomicity',
      money: 1000,
    },
  });
  cleanup.add(
    () => prisma.foalTrainingHistory.deleteMany({ where: { horseId: { in: createdFoalIds } } }),
    'foalTrainingHistory',
  );
  cleanup.add(
    () => prisma.groomAssignment.deleteMany({ where: { foalId: { in: createdFoalIds } } }),
    'groomAssignment',
  );
  cleanup.add(
    () => prisma.foalDevelopment.deleteMany({ where: { foalId: { in: createdFoalIds } } }),
    'foalDevelopment',
  );
  cleanup.add(() => prisma.groom.deleteMany({ where: { id: { in: createdGroomIds } } }), 'groom');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdFoalIds } } }), 'horse');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

describe('completeEnrichmentActivity atomicity', () => {
  it('concurrent identical requests: exactly one succeeds, one history row, outcome applied once', async () => {
    const foal = await makeFoal('dup', { bondScore: 10, stressLevel: 50 });

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => completeEnrichmentActivity(foal.id, 'gentle_touch')),
    );

    const ok = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(rejected).toHaveLength(4);
    for (const r of rejected) {
      expect(r.reason.message).toMatch(/already completed/i);
    }

    const history = await prisma.foalTrainingHistory.findMany({ where: { horseId: foal.id } });
    expect(history).toHaveLength(1);

    const after = await prisma.horse.findUnique({ where: { id: foal.id } });
    const { bondChange, stressChange } = ok[0].value.levels;
    expect(after.bondScore).toBe(10 + bondChange);
    expect(after.stressLevel).toBe(50 + stressChange);
  }, 30000);

  it('concurrent distinct activities: neither outcome is lost', async () => {
    const foal = await makeFoal('distinct', { bondScore: 10, stressLevel: 50 });

    const results = await Promise.all(
      ['gentle_touch', 'quiet_presence', 'soft_voice'].map(a => completeEnrichmentActivity(foal.id, a)),
    );

    const bondSum = results.reduce((s, r) => s + r.levels.bondChange, 0);
    const stressSum = results.reduce((s, r) => s + r.levels.stressChange, 0);
    const after = await prisma.horse.findUnique({ where: { id: foal.id } });
    expect(after.bondScore).toBe(10 + bondSum);
    expect(after.stressLevel).toBe(50 + stressSum);
    expect(await prisma.foalTrainingHistory.count({ where: { horseId: foal.id } })).toBe(3);
  }, 30000);

  it('a failure after the history reservation rolls back the reservation and every state change', async () => {
    // bond 24 + any Gentle Touch gain (3..7) crosses 25, so the milestone write
    // (the command's last step) runs and the injected trigger fails it.
    const foal = await makeFoal('rollback', { bondScore: 24, stressLevel: 50 });
    const drop = await failMilestoneWrite(foal.id, 'bond-25');
    try {
      await expect(completeEnrichmentActivity(foal.id, 'gentle_touch')).rejects.toMatchObject({
        message: expect.stringContaining('injected test failure'),
      });
    } finally {
      await drop();
    }

    const after = await prisma.horse.findUnique({ where: { id: foal.id } });
    expect(after.bondScore).toBe(24);
    expect(after.stressLevel).toBe(50);
    expect(await prisma.foalTrainingHistory.count({ where: { horseId: foal.id } })).toBe(0);
    expect(await prisma.foalDevelopment.findUnique({ where: { foalId: foal.id } })).toBeNull();

    // With the fault gone, the same activity is still available (no orphan marker).
    const retry = await completeEnrichmentActivity(foal.id, 'gentle_touch');
    expect(retry.success).toBe(true);
  }, 30000);
});

describe('graduateFoal atomicity', () => {
  async function makeGraduationFixture(suffix) {
    const foal = await makeFoal(suffix, { days: 21, age: 3 });
    await prisma.foalDevelopment.create({ data: { foalId: foal.id, isActive: true } });
    const groom = await prisma.groom.create({
      data: {
        name: `TestFixture-${TAG}-groom-${suffix}`,
        speciality: 'foal_care',
        personality: 'gentle',
        userId: user.id,
      },
    });
    createdGroomIds.push(groom.id);
    const assignment = await prisma.groomAssignment.create({
      data: { foalId: foal.id, groomId: groom.id, userId: user.id, isActive: true },
    });
    return { foal, assignment };
  }

  it('a failure at the last step rolls back closure, assignments, user milestone and foal milestones', async () => {
    const { foal, assignment } = await makeGraduationFixture('gradfail');
    const drop = await failMilestoneWrite(foal.id, 'graduation');
    try {
      await expect(graduateFoal(foal.id, user.id)).rejects.toMatchObject({
        message: expect.stringContaining('injected test failure'),
      });
    } finally {
      await drop();
    }

    const dev = await prisma.foalDevelopment.findUnique({ where: { foalId: foal.id } });
    expect(dev.isActive).toBe(true);
    expect(dev.completedMilestones).toEqual({});
    const asg = await prisma.groomAssignment.findUnique({ where: { id: assignment.id } });
    expect(asg.isActive).toBe(true);
    expect(asg.endDate).toBeNull();
    const u = await prisma.user.findUnique({ where: { id: user.id }, select: { settings: true } });
    expect(u.settings?.milestones?.firstGraduation).toBeUndefined();
  }, 30000);

  it('graduation without a prior development row cannot be repeated', async () => {
    const foal = await makeFoal('gradtwice', { days: 21, age: 3 });

    await graduateFoal(foal.id, user.id);
    await expect(graduateFoal(foal.id, user.id)).rejects.toThrow(/already graduated/i);

    const dev = await prisma.foalDevelopment.findUnique({ where: { foalId: foal.id } });
    expect(dev.isActive).toBe(false);
    expect(dev.completedMilestones.graduation).toBeDefined();
  }, 30000);

  it('concurrent graduations: exactly one succeeds', async () => {
    const { foal } = await makeGraduationFixture('gradrace');

    const results = await Promise.allSettled(Array.from({ length: 5 }, () => graduateFoal(foal.id, user.id)));

    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    for (const r of results.filter(r => r.status === 'rejected')) {
      expect(r.reason.message).toMatch(/already graduated/i);
    }
  }, 30000);
});
