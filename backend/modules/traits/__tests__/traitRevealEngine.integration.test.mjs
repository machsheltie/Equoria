/**
 * Trait reveal engine against the real database (owner rulings 2026-10-26, q98,
 * and 2026-10-27, q113-q118; Equoria-2d55z).
 *
 * Drives evaluateHorseTraitReveal / runNightlyTraitReveal with real horses and
 * real GroomInteraction rows, using the owner's numbers from
 * traitRevealSettings (gates 3/6/12/16/19, 25% a day, first 21 days, birth day
 * is day 1). Only the per-trait rarity and polarity are test values, because
 * the owner has not ruled them yet. Rolls come from a seeded RNG or a fixed
 * winning/losing roll, so every run draws the same outcome.
 *
 * Old contract (2026-10-26 engine, before the owner's numbers): day 1 was the
 * first whole day after birth and a trait rolled on the day its count was
 * reached. The owner ruled on 2026-10-27 that the birth day is day 1 (q115)
 * and that rolls start on the qualifying days AFTER the gate (q113).
 */

import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestHorse, cleanupTestHorses } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { seededRng } from '../../../__tests__/helpers/seededRng.mjs';
import { gameCalendarDate, gameDayIndex, startOfGameDayIndex } from '../../../utils/gameTime.mjs';
import { traitRevealSettings } from '../config/traitRevealSettings.mjs';
import { evaluateHorseTraitReveal, runNightlyTraitReveal, revealProgressKey } from '../services/traitRevealEngine.mjs';

const RUN = randomBytes(5).toString('hex');
const HOUR = 3_600_000;

/** The owner's numbers, with test-only rulings for the traits these tests use. */
const SETTINGS = Object.freeze({
  ...traitRevealSettings,
  traitPolarity: {
    ...traitRevealSettings.traitPolarity,
    brave: 'positive',
    heart: 'positive',
    resilient: 'positive',
    fearful: 'negative',
    fragile: 'negative',
  },
  traitRarity: {
    ...traitRevealSettings.traitRarity,
    brave: 'common',
    heart: 'legendary',
    resilient: 'common',
    fearful: 'common',
    fragile: 'common',
  },
});
const always = () => 0;
const never = () => 0.999;
// Noon Eastern on a fixed game day, so "today" never moves under the test.
const NOW = new Date(startOfGameDayIndex(gameDayIndex(new Date())).getTime() + 12 * HOUR);
const TODAY = gameDayIndex(NOW);
const days = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

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

/**
 * A horse whose birth day was `livedDays` game days before today, so days of
 * life 1..livedDays are complete and today is day livedDays + 1. Groomed on
 * the listed days of life (day 1 is the birth day).
 */
async function makeHorse({ livedDays, modifiers, groomedOn = [] }) {
  const horse = await createTestHorse(
    prisma,
    {
      name: `TestFixture-reveal-${RUN}-${horseIds.length}`,
      sex: 'Filly',
      dateOfBirth: gameCalendarDate(NOW, -livedDays),
      userId: user.id,
      epigeneticModifiers: modifiers,
    },
    horseIds,
  );
  const birthDay = TODAY - livedDays;
  for (const dayOfLife of groomedOn) {
    await prisma.groomInteraction.create({
      data: {
        interactionType: 'groomHorse',
        duration: 0,
        foalId: horse.id,
        groomId: groom.id,
        timestamp: new Date(startOfGameDayIndex(birthDay + dayOfLife - 1).getTime() + 10 * HOUR),
      },
    });
  }
  return horse;
}

const stored = async id =>
  (await prisma.horse.findUnique({ where: { id }, select: { epigeneticModifiers: true } })).epigeneticModifiers;

describe('evaluateHorseTraitReveal — the owner ladder on real horses and grooming rows', () => {
  it('the birth day is day 1, and a common trait first rolls on the groomed day after its 3-day gate', async () => {
    // Groomed on days 1-4; day 1 is the birth day. The gate opens on day 3.
    const horse = await makeHorse({
      livedDays: 5,
      modifiers: { positive: [], negative: [], hidden: ['brave', 'fearful'] },
      groomedOn: [1, 2, 3, 4],
    });
    const result = await evaluateHorseTraitReveal(horse.id, {
      settings: SETTINGS,
      rng: always,
      now: NOW,
    });
    expect(result.daysEvaluated).toBe(5);
    // fearful: day 5 is the only neglected day, far short of its gate.
    expect(result.changes).toEqual([
      { trait: 'brave', change: 'revealed', polarity: 'positive', dayOfLife: 4, groomed: true },
    ]);
    const mods = await stored(horse.id);
    expect(mods.positive).toEqual(['brave']);
    expect(mods.hidden).toEqual(['fearful']);
    expect(mods[revealProgressKey]).toBe(5);

    const history = await prisma.traitHistoryLog.findMany({ where: { horseId: horse.id } });
    expect(history.map(h => [h.traitName, h.sourceType])).toEqual([['brave', 'grooming']]);
  }, 60_000);

  it('reaching the gate is not a reveal: three groomed days roll nothing', async () => {
    const horse = await makeHorse({
      livedDays: 3,
      modifiers: { positive: [], negative: [], hidden: ['brave'] },
      groomedOn: [1, 2, 3],
    });
    const result = await evaluateHorseTraitReveal(horse.id, {
      settings: SETTINGS,
      rng: always,
      now: NOW,
    });
    expect(result.changes).toEqual([]);
    expect(await stored(horse.id)).toMatchObject({ hidden: ['brave'], [revealProgressKey]: 3 });
  }, 60_000);

  it('a legendary trait waits for its 19-day gate while the common one keeps its chances; the window ends at day 21', async () => {
    // Groomed every day of a 25-day life; only days 1-21 are evaluated.
    const horse = await makeHorse({
      livedDays: 25,
      modifiers: { positive: [], negative: [], hidden: ['brave', 'heart'] },
      groomedOn: days(1, 25),
    });
    const result = await evaluateHorseTraitReveal(horse.id, {
      settings: SETTINGS,
      rng: always,
      now: NOW,
    });
    expect(result.daysEvaluated).toBe(21);
    expect(result.changes.map(c => [c.trait, c.dayOfLife])).toEqual([
      ['brave', 4],
      ['heart', 20],
    ]);
    expect((await stored(horse.id))[revealProgressKey]).toBe(21);
  }, 60_000);

  it('a groomed day past the gate keeps rolling: the same seed gives the same days on two horses', async () => {
    const outcome = async () => {
      const horse = await makeHorse({
        livedDays: 21,
        modifiers: { positive: [], negative: [], hidden: ['brave', 'heart'] },
        groomedOn: days(1, 21),
      });
      const result = await evaluateHorseTraitReveal(horse.id, {
        settings: SETTINGS,
        rng: seededRng(2026),
        now: NOW,
      });
      return { changes: result.changes, stored: await stored(horse.id) };
    };
    const first = await outcome();
    const second = await outcome();
    expect(second.changes).toEqual(first.changes);
    expect(second.stored).toEqual(first.stored);
    for (const change of first.changes) {
      // Never on or before a gate day: common rolls from day 4, legendary from day 20.
      expect(change.dayOfLife).toBeGreaterThan(change.trait === 'heart' ? 19 : 3);
    }
  }, 60_000);

  it('neglect mirrors grooming: a common negative reveals on the neglected day after three neglected days', async () => {
    const horse = await makeHorse({
      livedDays: 5,
      modifiers: { positive: [], negative: [], hidden: ['fearful'] },
    });
    const result = await evaluateHorseTraitReveal(horse.id, {
      settings: SETTINGS,
      rng: always,
      now: NOW,
    });
    expect(result.changes).toEqual([
      { trait: 'fearful', change: 'revealed', polarity: 'negative', dayOfLife: 4, groomed: false },
    ]);
    expect((await stored(horse.id)).negative).toEqual(['fearful']);
  }, 60_000);

  it('grooming switches any active negative off; neglect switches an active positive off, by the same counts', async () => {
    const groomedFoal = await makeHorse({
      livedDays: 5,
      modifiers: { positive: [], negative: ['fragile'], hidden: [] },
      groomedOn: [1, 2, 3, 4, 5],
    });
    const groomedResult = await evaluateHorseTraitReveal(groomedFoal.id, {
      settings: SETTINGS,
      rng: always,
      now: NOW,
    });
    expect(groomedResult.changes).toEqual([
      {
        trait: 'fragile',
        change: 'switchedOff',
        polarity: 'negative',
        dayOfLife: 4,
        groomed: true,
      },
    ]);
    expect(await stored(groomedFoal.id)).toMatchObject({ negative: [], hidden: ['fragile'] });

    const neglectedFoal = await makeHorse({
      livedDays: 4,
      modifiers: { positive: ['resilient'], negative: [], hidden: [] },
    });
    const neglectedResult = await evaluateHorseTraitReveal(neglectedFoal.id, {
      settings: SETTINGS,
      rng: always,
      now: NOW,
    });
    expect(neglectedResult.changes.map(c => [c.trait, c.change, c.dayOfLife])).toEqual([
      ['resilient', 'switchedOff', 4],
    ]);
    expect(await stored(neglectedFoal.id)).toMatchObject({ positive: [], hidden: ['resilient'] });
  }, 60_000);

  it('a losing roll leaves the trait where it was but still marks the day evaluated', async () => {
    const horse = await makeHorse({
      livedDays: 6,
      modifiers: { positive: [], negative: [], hidden: ['brave'] },
      groomedOn: days(1, 6),
    });
    const result = await evaluateHorseTraitReveal(horse.id, {
      settings: SETTINGS,
      rng: never,
      now: NOW,
    });
    expect(result.changes).toEqual([]);
    expect(await stored(horse.id)).toMatchObject({ hidden: ['brave'], [revealProgressKey]: 6 });
  }, 60_000);

  it('rolls each completed day once and carries the counts into later nights', async () => {
    const horse = await makeHorse({
      livedDays: 3,
      modifiers: { positive: [], negative: [], hidden: ['fearful'] },
    });
    const first = await evaluateHorseTraitReveal(horse.id, {
      settings: SETTINGS,
      rng: always,
      now: NOW,
    });
    expect(first.changes).toEqual([]);
    const again = await evaluateHorseTraitReveal(horse.id, {
      settings: SETTINGS,
      rng: always,
      now: NOW,
    });
    expect(again).toEqual({ horseId: horse.id, daysEvaluated: 0, changes: [] });
    // Tomorrow only day 4 is new; it is the fourth neglected day, past the gate.
    const tomorrow = new Date(NOW.getTime() + 24 * HOUR);
    const next = await evaluateHorseTraitReveal(horse.id, {
      settings: SETTINGS,
      rng: always,
      now: tomorrow,
    });
    expect(next.daysEvaluated).toBe(1);
    expect(next.changes.map(c => [c.trait, c.dayOfLife])).toEqual([['fearful', 4]]);
    expect((await stored(horse.id))[revealProgressKey]).toBe(4);
  }, 60_000);

  it('never touches a trait whose rarity or polarity is not ruled, and keeps keys it does not own', async () => {
    const horse = await makeHorse({
      livedDays: 21,
      modifiers: { positive: ['curious'], negative: [], hidden: ['playful'], ageOneTags: ['x'] },
      groomedOn: days(1, 10),
    });
    const result = await evaluateHorseTraitReveal(horse.id, {
      settings: SETTINGS,
      rng: always,
      now: NOW,
    });
    expect(result.changes).toEqual([]);
    expect(await stored(horse.id)).toMatchObject({
      positive: ['curious'],
      hidden: ['playful'],
      ageOneTags: ['x'],
    });
  }, 60_000);
});

describe('runNightlyTraitReveal — the nightly pass', () => {
  it('evaluates horses inside the 21-day window and skips horses past it', async () => {
    const young = await makeHorse({
      livedDays: 5,
      modifiers: { positive: [], negative: [], hidden: ['fearful'] },
    });
    const old = await makeHorse({
      livedDays: 40,
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
    expect(await stored(old.id)).toEqual({ positive: [], negative: [], hidden: ['fearful'] });
  }, 60_000);

  it('with the shipped settings (no trait ruled yet) it changes nothing and marks no day evaluated', async () => {
    const horse = await makeHorse({
      livedDays: 5,
      modifiers: { positive: [], negative: [], hidden: ['fearful'] },
    });
    const summary = await runNightlyTraitReveal({ rng: always, now: NOW, horseIds: [horse.id] });
    expect(summary).toEqual({ skipped: 'noTraitsRuled', horsesEvaluated: 0, changes: 0, errors: 0 });
    expect(await stored(horse.id)).toEqual({ positive: [], negative: [], hidden: ['fearful'] });
  }, 60_000);
});
