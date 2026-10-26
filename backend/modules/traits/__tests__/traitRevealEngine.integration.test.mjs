/**
 * Trait reveal engine against the real database (owner ruling 2026-10-26, q98;
 * Equoria-2d55z).
 *
 * Drives evaluateHorseTraitReveal / runNightlyTraitReveal with real horses and
 * real GroomInteraction rows: groomed days reveal positives and switch
 * negatives off, neglected days the reverse, each completed game day is rolled
 * exactly once, other epigeneticModifiers keys are kept, and the window ends
 * where the settings say. Numbers are test values; the owner has not ruled them.
 */

import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestHorse, cleanupTestHorses } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate, gameDayIndex, startOfGameDayIndex } from '../../../utils/gameTime.mjs';
import { evaluateHorseTraitReveal, runNightlyTraitReveal, revealProgressKey } from '../services/traitRevealEngine.mjs';

const RUN = randomBytes(5).toString('hex');
const HOUR = 3_600_000;
const byRarity = (common, rare) => ({
  common,
  uncommon: common,
  rare,
  ultraRare: rare,
  legendary: rare,
});
const SETTINGS = Object.freeze({
  revealDays: { positive: byRarity(2, 5), negative: byRarity(2, 5) },
  switchOffDays: { positive: byRarity(2, 5), negative: byRarity(3, 5) },
  dailyChance: byRarity(1, 1),
  lastDayOfLife: 21,
  traitRarity: { brave: 'common', fearful: 'common', fragile: 'common', resilient: 'common' },
});
const always = () => 0;
// Noon Eastern on a fixed game day, so "today" never moves under the test.
const NOW = new Date(startOfGameDayIndex(gameDayIndex(new Date())).getTime() + 12 * HOUR);
const TODAY = gameDayIndex(NOW);

let user;
let groom;
const horseIds = [];

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      username: `tf-reveal-${RUN}`,
      email: `tf-reveal-${RUN}@example.com`,
      password: 'x',
      firstName: 'Test',
      lastName: 'Fixture',
    },
  });
  groom = await prisma.groom.create({
    data: {
      name: `tf-reveal-groom-${RUN}`,
      speciality: 'general',
      personality: 'gentle',
      skillLevel: 'novice',
      userId: user.id,
    },
  });
}, 60_000);

afterAll(async () => {
  const cleanup = createCleanupTracker();
  const ids = [...horseIds];
  cleanup.add(() => prisma.traitHistoryLog.deleteMany({ where: { horseId: { in: ids } } }), 'traitHistoryLog');
  cleanup.add(() => prisma.groomInteraction.deleteMany({ where: { groomId: groom?.id ?? -1 } }), 'groomInteractions');
  cleanup.add(() => cleanupTestHorses(prisma, horseIds), 'horses');
  cleanup.add(() => prisma.groom.deleteMany({ where: { id: groom?.id ?? -1 } }), 'groom');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user?.id ?? 'none' } }), 'user');
  await cleanup.run();
}, 60_000);

/** A horse born `ageDays` game days before NOW, groomed on the listed days of life. */
async function makeHorse({ ageDays, modifiers, groomedOn = [] }) {
  const horse = await createTestHorse(
    prisma,
    {
      name: `TestFixture-reveal-${RUN}-${horseIds.length}`,
      sex: 'Filly',
      dateOfBirth: gameCalendarDate(NOW, -ageDays),
      userId: user.id,
      epigeneticModifiers: modifiers,
    },
    horseIds,
  );
  const birthDay = TODAY - ageDays;
  for (const dayOfLife of groomedOn) {
    await prisma.groomInteraction.create({
      data: {
        interactionType: 'brushing',
        duration: 30,
        foalId: horse.id,
        groomId: groom.id,
        timestamp: new Date(startOfGameDayIndex(birthDay + dayOfLife).getTime() + 10 * HOUR),
      },
    });
  }
  return horse;
}

const stored = async id =>
  (await prisma.horse.findUnique({ where: { id }, select: { epigeneticModifiers: true } })).epigeneticModifiers;

describe('evaluateHorseTraitReveal — real horses, real grooming rows', () => {
  it('grooming days reveal a hidden positive; neglect days reveal a hidden negative', async () => {
    // Born 4 days ago: days 1-3 are complete. Groomed days 1 and 2, neglected day 3.
    const horse = await makeHorse({
      ageDays: 4,
      modifiers: { positive: [], negative: [], hidden: ['brave', 'fearful'] },
      groomedOn: [1, 2],
    });
    const result = await evaluateHorseTraitReveal(horse.id, {
      settings: SETTINGS,
      rng: always,
      now: NOW,
    });
    expect(result.daysEvaluated).toBe(3);
    // brave: 2 grooming days reached on day 2. fearful: only 1 neglect day by day 3.
    expect(result.changes).toEqual([
      { trait: 'brave', change: 'revealed', polarity: 'positive', dayOfLife: 2, groomed: true },
    ]);
    const mods = await stored(horse.id);
    expect(mods.positive).toEqual(['brave']);
    expect(mods.hidden).toEqual(['fearful']);
    expect(mods[revealProgressKey]).toBe(3);

    const history = await prisma.traitHistoryLog.findMany({ where: { horseId: horse.id } });
    expect(history.map(h => [h.traitName, h.sourceType])).toEqual([['brave', 'grooming']]);
  }, 60_000);

  it('rolls each completed day once: a second run the same day changes nothing', async () => {
    const horse = await makeHorse({
      ageDays: 3,
      modifiers: { positive: [], negative: [], hidden: ['fearful'] },
    });
    const first = await evaluateHorseTraitReveal(horse.id, {
      settings: SETTINGS,
      rng: always,
      now: NOW,
    });
    expect(first.changes.map(c => c.trait)).toEqual(['fearful']);
    const again = await evaluateHorseTraitReveal(horse.id, {
      settings: SETTINGS,
      rng: always,
      now: NOW,
    });
    expect(again).toEqual({ horseId: horse.id, daysEvaluated: 0, changes: [] });
    // A later night evaluates only the new day, carrying the earlier counts.
    const tomorrow = new Date(NOW.getTime() + 24 * HOUR);
    const next = await evaluateHorseTraitReveal(horse.id, {
      settings: SETTINGS,
      rng: always,
      now: tomorrow,
    });
    expect(next.daysEvaluated).toBe(1);
    expect((await stored(horse.id))[revealProgressKey]).toBe(3);
  }, 60_000);

  it('grooming switches a born-active negative off; neglect switches an active positive off', async () => {
    const groomedFoal = await makeHorse({
      ageDays: 5,
      modifiers: { positive: [], negative: ['fragile'], hidden: [] },
      groomedOn: [1, 2, 3, 4],
    });
    const groomedResult = await evaluateHorseTraitReveal(groomedFoal.id, {
      settings: SETTINGS,
      rng: always,
      now: NOW,
    });
    expect(groomedResult.changes).toEqual([
      { trait: 'fragile', change: 'switchedOff', polarity: 'negative', dayOfLife: 3, groomed: true },
    ]);
    expect(await stored(groomedFoal.id)).toMatchObject({ negative: [], hidden: ['fragile'] });

    const neglectedFoal = await makeHorse({
      ageDays: 3,
      modifiers: { positive: ['resilient'], negative: [], hidden: [] },
    });
    await evaluateHorseTraitReveal(neglectedFoal.id, { settings: SETTINGS, rng: always, now: NOW });
    expect(await stored(neglectedFoal.id)).toMatchObject({ positive: [], hidden: ['resilient'] });
  }, 60_000);

  it('a losing roll leaves the trait where it was but still marks the day evaluated', async () => {
    const horse = await makeHorse({
      ageDays: 4,
      modifiers: { positive: [], negative: [], hidden: ['brave'] },
      groomedOn: [1, 2, 3],
    });
    const result = await evaluateHorseTraitReveal(horse.id, {
      settings: { ...SETTINGS, dailyChance: byRarity(0.5, 0.5) },
      rng: () => 0.999,
      now: NOW,
    });
    expect(result.changes).toEqual([]);
    expect(await stored(horse.id)).toMatchObject({ hidden: ['brave'], [revealProgressKey]: 3 });
  }, 60_000);

  it('keeps every other epigeneticModifiers key it does not own', async () => {
    const horse = await makeHorse({
      ageDays: 3,
      modifiers: { positive: [], negative: [], hidden: ['brave'], ageOneTags: ['x'] },
      groomedOn: [1, 2],
    });
    await evaluateHorseTraitReveal(horse.id, { settings: SETTINGS, rng: always, now: NOW });
    expect(await stored(horse.id)).toMatchObject({ positive: ['brave'], ageOneTags: ['x'] });
  }, 60_000);

  it('stops at the last day of life in the settings', async () => {
    const horse = await makeHorse({
      ageDays: 30,
      modifiers: { positive: [], negative: [], hidden: ['fearful'] },
    });
    const result = await evaluateHorseTraitReveal(horse.id, {
      settings: { ...SETTINGS, lastDayOfLife: 1 },
      rng: always,
      now: NOW,
    });
    expect(result.daysEvaluated).toBe(1);
    // One neglect day is short of the two needed.
    expect(result.changes).toEqual([]);
    expect((await stored(horse.id))[revealProgressKey]).toBe(1);
  }, 60_000);
});

describe('runNightlyTraitReveal — the nightly pass', () => {
  it('evaluates horses inside the window and skips horses past it', async () => {
    const young = await makeHorse({
      ageDays: 3,
      modifiers: { positive: [], negative: [], hidden: ['fearful'] },
    });
    const old = await makeHorse({
      ageDays: 40,
      modifiers: { positive: [], negative: [], hidden: ['fearful'] },
    });
    const summary = await runNightlyTraitReveal({
      settings: SETTINGS,
      rng: always,
      now: NOW,
      horseIds: [young.id, old.id],
    });
    expect(summary).toEqual({ skipped: null, horsesEvaluated: 1, changes: 1, errors: 0 });
    expect((await stored(young.id)).negative).toEqual(['fearful']);
    expect((await stored(old.id)).hidden).toEqual(['fearful']);
  }, 60_000);
});
