/**
 * Foal milestone stretches are scored the night after they end (Equoria-gveno).
 *
 * Owner ruling 2026-11-03 (q352): score each milestone stretch the night after
 * it ends, so all of that stretch's grooming counts. The nightly job
 * (processFoalMilestoneEvaluations, 00:10 Eastern) used to score a stretch on
 * its FIRST day, before the stretch's later grooming had happened.
 *
 * Each pass below runs with the wall clock (Date only) frozen at 00:10 Eastern
 * on a chosen development day of the foal; the foal's care rows sit at noon
 * Eastern on each day of its curiosity/play stretch (days 8-14).
 *
 * Real database, real functions. No mocks.
 */

import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { processFoalMilestoneEvaluations } from '../../../utils/horseAgingSystem.mjs';
import { milestoneTypes } from '../../../utils/enhancedMilestoneEvaluationSystem.mjs';
import { calendarDateDayIndex, gameCalendarDate, startOfGameDayIndex } from '../../../utils/gameTime.mjs';
import { cleanupTestHorses, testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const PREFIX = `TestFixture-gvenoStretch-${randomBytes(4).toString('hex')}`;
const hour = 3600000;

const realExceptDate = [
  'hrtime',
  'nextTick',
  'performance',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
];

/** Run `fn` with the wall clock (Date only) frozen at `instant`. */
async function at(instant, fn) {
  jest.useFakeTimers({ now: instant, doNotFake: realExceptDate });
  try {
    return await fn();
  } finally {
    jest.useRealTimers();
  }
}

/** An instant `hours` after 00:00 Eastern on the foal's development day `day`. */
function onDay(foal, day, hours) {
  const birthIndex = calendarDateDayIndex(foal.dateOfBirth);
  return new Date(startOfGameDayIndex(birthIndex + day).getTime() + hours * hour);
}

/** The nightly pass for one foal, as the 00:10 Eastern job runs it on `day`. */
function nightlyPassOn(foal, day) {
  return at(onDay(foal, day, 10 / 60), () => processFoalMilestoneEvaluations({ specificHorseId: foal.id }));
}

function logsOf(foal, milestoneType) {
  return prisma.milestoneTraitLog.findMany({ where: { horseId: foal.id, milestoneType } });
}

const createdHorseIds = [];
const cleanup = createCleanupTracker();
let owner;
let groom;

async function makeFoal(daysOld) {
  const horse = await prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: `${PREFIX}-${createdHorseIds.length}`,
      sex: 'Filly',
      age: 0,
      bondScore: 50,
      dateOfBirth: gameCalendarDate(new Date(), -daysOld),
      user: { connect: { id: owner.id } },
    }),
  });
  createdHorseIds.push(horse.id);
  return horse;
}

/** Noon-Eastern care on every day of the curiosity/play stretch (days 8-14). */
async function groomEveryDayOfCuriosityStretch(foal) {
  const tasks = ['earlyTouch', 'grooming', 'handling', 'showingMisc', 'hoofCare', 'grooming', 'handling'];
  for (let day = 8; day <= 14; day++) {
    const taskType = tasks[day - 8];
    await prisma.groomInteraction.create({
      data: {
        foalId: foal.id,
        groomId: groom.id,
        interactionType: taskType,
        taskType,
        duration: 30,
        timestamp: onDay(foal, day, 12),
      },
    });
  }
}

beforeAll(async () => {
  cleanup.add(
    () => prisma.groomInteraction.deleteMany({ where: { foalId: { in: createdHorseIds } } }),
    'groomInteractions',
  );
  cleanup.add(
    () => prisma.milestoneTraitLog.deleteMany({ where: { horseId: { in: createdHorseIds } } }),
    'milestoneTraitLog',
  );
  cleanup.add(() => cleanupTestHorses(prisma, createdHorseIds), 'horses');
  cleanup.add(() => (groom ? prisma.groom.delete({ where: { id: groom.id } }) : undefined), 'groom');
  cleanup.add(() => (owner ? prisma.user.delete({ where: { id: owner.id } }) : undefined), 'user');

  owner = await prisma.user.create({
    data: {
      emailVerified: true,
      username: PREFIX,
      email: `${PREFIX}@example.com`,
      password: 'irrelevant-hash',
      firstName: 'Stretch',
      lastName: 'Scoring',
    },
  });
  groom = await prisma.groom.create({
    data: {
      name: `${PREFIX}-groom`,
      speciality: 'foalCare',
      personality: 'gentle',
      userId: owner.id,
      isActive: true,
    },
  });
}, 60000);

afterAll(() => cleanup.run(), 60000);

describe('foal milestone stretches are scored the night after they end (q352, Equoria-gveno)', () => {
  it('scores the curiosity/play stretch (days 8-14) on night 15, with all seven days of grooming', async () => {
    const foal = await makeFoal(16);
    await groomEveryDayOfCuriosityStretch(foal);

    // Night 8 opens the stretch: none of its grooming has happened yet.
    await nightlyPassOn(foal, 8);
    expect(await logsOf(foal, milestoneTypes.curiosityPlay)).toHaveLength(0);

    // Night 14 is the stretch's last day: its noon grooming is still ahead.
    await nightlyPassOn(foal, 14);
    expect(await logsOf(foal, milestoneTypes.curiosityPlay)).toHaveLength(0);

    // Night 15: the stretch is over and scored with every day of its care.
    const pass = await nightlyPassOn(foal, 15);
    expect(pass.errors).toBe(0);
    const [log, ...extra] = await logsOf(foal, milestoneTypes.curiosityPlay);
    expect(extra).toHaveLength(0);
    expect(log.ageInDays).toBe(15);
    // Seven of seven days groomed: round(7 / 7 * 5) = 5; five distinct tasks.
    expect(log.taskConsistency).toBe(5);
    expect(log.taskDiversity).toBe(5);
  });

  it('scores each stretch exactly once across repeated and later nights', async () => {
    const foal = await makeFoal(16);

    await nightlyPassOn(foal, 15);
    await nightlyPassOn(foal, 15);
    await nightlyPassOn(foal, 16);

    const logs = await prisma.milestoneTraitLog.findMany({ where: { horseId: foal.id } });
    const counts = {};
    for (const l of logs) {
      counts[l.milestoneType] = (counts[l.milestoneType] ?? 0) + 1;
    }
    expect(counts).toEqual({
      [milestoneTypes.IMPRINTING]: 1,
      [milestoneTypes.SOCIALIZATION]: 1,
      [milestoneTypes.curiosityPlay]: 1,
    });
  });

  it('scores the last stretch (days 15-21) on night 22, once, and never scores days 22-28', async () => {
    const foal = await makeFoal(16);

    await nightlyPassOn(foal, 21);
    expect(await logsOf(foal, milestoneTypes.trustHandling)).toHaveLength(0);

    const pass = await nightlyPassOn(foal, 22);
    expect(pass.errors).toBe(0);
    const trust = await logsOf(foal, milestoneTypes.trustHandling);
    expect(trust).toHaveLength(1);
    expect(trust[0].ageInDays).toBe(22);

    await nightlyPassOn(foal, 23);
    await nightlyPassOn(foal, 29);
    expect(await logsOf(foal, milestoneTypes.trustHandling)).toHaveLength(1);
    expect(await logsOf(foal, milestoneTypes.confidenceReactivity)).toHaveLength(0);
  });

  it('leaves a stretch already scored on its first day (before this change) as it is', async () => {
    const foal = await makeFoal(16);
    const early = await prisma.milestoneTraitLog.create({
      data: { horseId: foal.id, milestoneType: milestoneTypes.curiosityPlay, score: 0, ageInDays: 8 },
    });

    await nightlyPassOn(foal, 15);

    const logs = await logsOf(foal, milestoneTypes.curiosityPlay);
    expect(logs.map(l => l.id)).toEqual([early.id]);
  });
});
