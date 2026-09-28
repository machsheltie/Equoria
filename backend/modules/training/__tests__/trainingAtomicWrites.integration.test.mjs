/**
 * trainHorse — one atomic unit of work (Equoria-bvddn.17, covers Equoria-bvddn.26).
 *
 * Before this fix a training session was four independent autocommit writes:
 * the cooldown claim, the TrainingLog insert, a read-then-write of the
 * discipline-score JSONB, and a read-then-write of the gained stat. So:
 *   (1) a failure at the score update left the week's cooldown spent and a
 *       TrainingLog row written, with no gain;
 *   (2) a concurrent stat write from another writer (e.g. a show payout)
 *       landing between training's SELECT and UPDATE was overwritten by
 *       training's stale absolute value;
 *   (3) a string horseId reached `prisma.horse.findUnique({ where: { id } })`
 *       un-parsed, the stat update threw, and the error was swallowed — the
 *       response claimed success with no stat gain (Equoria-bvddn.26).
 *
 * Real DB, real trainHorse, no mocks. Failure (1) is injected with a real
 * Postgres CHECK constraint scoped to the fixture horse; interleaving (2) uses
 * a second real Postgres session in a worker thread (see
 * helpers/horseRowLockHolder.worker.mjs). `_randomFn` is trainHorse's existing
 * RNG seam: () => 0 forces a stat gain of +1 on the discipline's first stat.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import prisma, { Prisma } from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { trainHorse } from '../controllers/trainingController.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const FIXTURE_PREFIX = 'TestFixture-bvddn17';
const tag = randomBytes(4).toString('hex');
const constraintName = `tf_bvddn17_block_score_${tag}`;

let testUser;
const createdHorseIds = [];
const cleanup = createCleanupTracker();

async function createHorse(label, extra = {}) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-${label}-${tag}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-06-15'),
      age: 6,
      userId: testUser.id,
      healthStatus: 'healthy',
      trainingCooldown: null,
      ...extra,
    },
  });
  createdHorseIds.push(horse.id);
  return horse;
}

beforeAll(async () => {
  testUser = await prisma.user.create({
    data: {
      email: `${FIXTURE_PREFIX}-${tag}@test.com`,
      username: `${FIXTURE_PREFIX}-${tag}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'Atomic',
      lastName: 'Training',
      money: 0,
    },
  });
}, 60000);

afterAll(async () => {
  cleanup.add(
    () => prisma.$executeRaw(Prisma.sql`ALTER TABLE horses DROP CONSTRAINT IF EXISTS ${Prisma.raw(constraintName)}`),
    'check constraint',
  );
  if (createdHorseIds.length) {
    cleanup.add(() => prisma.trainingLog.deleteMany({ where: { horseId: { in: createdHorseIds } } }), 'trainingLogs');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }), 'horses');
  }
  if (testUser) {
    cleanup.add(() => prisma.xpEvent.deleteMany({ where: { userId: testUser.id } }), 'xpEvents');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: testUser.id } }), 'users');
  }
  await cleanup.run();
}, 30000);

describe('trainHorse — all training writes commit or roll back together (Equoria-bvddn.17)', () => {
  it('a real DB failure at the discipline-score write leaves the cooldown unclaimed, no log, no XP', async () => {
    const horse = await createHorse('scorefail');
    const xpBefore = (await prisma.user.findUnique({ where: { id: testUser.id }, select: { xp: true } })).xp;

    // Genuine DB-level failure at the score step only: this row may never hold
    // a Dressage score. The cooldown claim (same row, no Dressage key yet)
    // still satisfies it; the score write that adds the key violates it.
    await prisma.$executeRaw(
      Prisma.sql`ALTER TABLE horses ADD CONSTRAINT ${Prisma.raw(constraintName)} CHECK (id <> ${Prisma.raw(
        String(horse.id),
      )} OR NOT ("disciplineScores" ? 'Dressage')) NOT VALID`,
    );
    let outcome;
    try {
      outcome = await trainHorse(horse.id, 'Dressage', () => 0.999).then(
        value => ({ threw: false, value }),
        error => ({ threw: true, error }),
      );
    } finally {
      await prisma.$executeRaw(Prisma.sql`ALTER TABLE horses DROP CONSTRAINT IF EXISTS ${Prisma.raw(constraintName)}`);
    }

    expect(outcome.threw).toBe(true);

    const after = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { trainingCooldown: true, disciplineScores: true },
    });
    expect(after.trainingCooldown).toBeNull();
    expect(after.disciplineScores?.Dressage).toBeUndefined();
    expect(await prisma.trainingLog.count({ where: { horseId: horse.id } })).toBe(0);
    const xpAfter = (await prisma.user.findUnique({ where: { id: testUser.id }, select: { xp: true } })).xp;
    expect(xpAfter).toBe(xpBefore);
  });

  it('a concurrent stat write from another session is not overwritten by the training stat gain', async () => {
    const horse = await createHorse('concurrent', { speed: 50 });
    const flag = new SharedArrayBuffer(4);
    const flagView = new Int32Array(flag);
    const worker = new Worker(new URL('./helpers/horseRowLockHolder.worker.mjs', import.meta.url), {
      workerData: {
        connectionString: process.env.DATABASE_URL,
        horseId: horse.id,
        stat: 'speed',
        amount: 5,
        flag,
      },
    });
    const workerDone = new Promise((resolve, reject) => {
      worker.once('message', resolve);
      worker.once('error', reject);
    });

    let triggered = false;
    // () => 0 forces: stat gain roll passes, stat = Racing[0] = speed, amount = +1.
    // On the FIRST RNG call (after training has decided to run, before its stat
    // write) the other session takes the horse row lock; this thread blocks
    // until it holds it.
    const rng = () => {
      if (!triggered) {
        triggered = true;
        worker.postMessage('lock');
        Atomics.wait(flagView, 0, 0, 10000);
        if (Atomics.load(flagView, 0) !== 1) {
          throw new Error('row-lock holder worker failed to take the lock');
        }
      }
      return 0;
    };

    let result;
    try {
      result = await trainHorse(horse.id, 'Racing', rng);
    } finally {
      const msg = triggered ? await workerDone : { done: false, error: 'rng never called' };
      await worker.terminate();
      expect(msg).toEqual({ done: true, sawWaiter: true });
    }

    expect(result.success).toBe(true);
    expect(result.statGain).toEqual(expect.objectContaining({ stat: 'speed', amount: 1 }));
    const after = await prisma.horse.findUnique({ where: { id: horse.id }, select: { speed: true } });
    // 50 + 5 (other writer) + 1 (training) — neither gain lost.
    expect(after.speed).toBe(56);
  });

  it('stat gain is applied when horseId arrives as a numeric string (Equoria-bvddn.26)', async () => {
    const horse = await createHorse('stringid', { speed: 40 });

    const result = await trainHorse(String(horse.id), 'Racing', () => 0);

    expect(result.success).toBe(true);
    expect(result.statGain).toEqual(expect.objectContaining({ stat: 'speed', amount: 1 }));
    const after = await prisma.horse.findUnique({ where: { id: horse.id }, select: { speed: true } });
    expect(after.speed).toBe(41);
  });

  it('the stat gain is capped at 100 in the database', async () => {
    const horse = await createHorse('cap', { speed: 100 });

    const result = await trainHorse(horse.id, 'Racing', () => 0);

    expect(result.success).toBe(true);
    const after = await prisma.horse.findUnique({ where: { id: horse.id }, select: { speed: true } });
    expect(after.speed).toBe(100);
  });
});
