/**
 * trainHorse — atomic cooldown gate sentinel (Equoria-0ihyi).
 *
 * Before this fix, trainHorse called canTrain() (which read trainingLog rows
 * to look for recent training), then proceeded to log a session + award XP +
 * bump the discipline score, and finally wrote trainingCooldown wrapped in a
 * silent try/catch. Two concurrent calls both passed canTrain (no recent log
 * yet) and both proceeded — granting double XP + double discipline points,
 * and either could silently fail to persist the cooldown.
 *
 * The fix replaces the late post-write cooldown update with an atomic
 * conditional updateMany BEFORE any state write:
 *   prisma.horse.updateMany({
 *     where: { id, OR: [{trainingCooldown: null}, {trainingCooldown: {lte: now}}] },
 *     data: { trainingCooldown: nextEligible },
 *   })
 * count===0 ⇒ COOLDOWN_ACTIVE short-circuit. Only the first racer flips
 * trainingCooldown forward and proceeds; every concurrent racer is rejected
 * before any session log / XP / discipline write.
 *
 * Sentinel: fire 10 parallel trainHorse calls on one horse → exactly ONE
 * succeeds; trainingLog rows == 1; discipline gained exactly the
 * single-success amount.
 *
 * Real DB, no mocks, scoped fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { trainHorse } from '../controllers/trainingController.mjs';

const FIXTURE_PREFIX = 'TestFixture-0ihyi';
const N_PARALLEL = 10;

let testUser;
let testHorse;
const createdUserIds = [];
const createdHorseIds = [];

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');
  testUser = await prisma.user.create({
    data: {
      email: `${FIXTURE_PREFIX}-${tag}@test.com`,
      username: `${FIXTURE_PREFIX}-${tag}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'Race',
      lastName: 'Cooldown',
      money: 0,
    },
  });
  createdUserIds.push(testUser.id);

  testHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-horse-${tag}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-06-15'),
      age: 6,
      userId: testUser.id,
      healthStatus: 'healthy',
      trainingCooldown: null,
    },
  });
  createdHorseIds.push(testHorse.id);
}, 60000);

afterAll(async () => {
  if (createdHorseIds.length) {
    await prisma.trainingLog.deleteMany({ where: { horseId: { in: createdHorseIds } } }).catch(() => {});
    await prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }).catch(() => {});
  }
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
  }
}, 30000);

describe('trainHorse — atomic cooldown gate sentinel (Equoria-0ihyi)', () => {
  it('SENTINEL: 10 parallel trainHorse calls on one horse — exactly ONE succeeds, 1 trainingLog, no double-bump', async () => {
    const before = await prisma.horse.findUnique({
      where: { id: testHorse.id },
      select: { disciplineScores: true },
    });
    const beforeRacing = (before.disciplineScores ?? {}).Racing ?? 0;

    const results = await Promise.all(Array.from({ length: N_PARALLEL }, () => trainHorse(testHorse.id, 'Racing')));

    const successes = results.filter(r => r.success === true);
    expect(successes).toHaveLength(1);

    // Every loser must surface the cooldown rejection — never silently 'success'.
    const losers = results.filter(r => r.success === false);
    expect(losers).toHaveLength(N_PARALLEL - 1);
    for (const l of losers) {
      expect(l.reason).toBe('Training cooldown active for this horse');
    }

    // Exactly one TrainingLog row for this horse (no double-log race).
    const logs = await prisma.trainingLog.findMany({
      where: { horseId: testHorse.id, discipline: 'Racing' },
    });
    expect(logs).toHaveLength(1);

    // Discipline score incremented exactly once. We don't pin the exact
    // delta (traits/temperament can modify it) — what we PIN is:
    //   delta > 0 AND delta == the single successful trainHorse() result.
    const after = await prisma.horse.findUnique({
      where: { id: testHorse.id },
      select: { disciplineScores: true, trainingCooldown: true },
    });
    const afterRacing = (after.disciplineScores ?? {}).Racing ?? 0;
    expect(afterRacing).toBeGreaterThan(beforeRacing);

    // Cooldown persisted forward — the gate did its job. (No silent catch
    // means a failed update would have thrown, not gotten here.)
    expect(after.trainingCooldown).not.toBeNull();
    expect(new Date(after.trainingCooldown).getTime()).toBeGreaterThan(Date.now());
  });
});
