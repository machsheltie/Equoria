/**
 * A rider's hidden items change the horse's show score by flat points (Equoria-xlw03).
 *
 * Owner ruling q331, 2026-11-18 ("use the proposal as written"), flat points added to
 * the base BEFORE the percentages, like tack and the discipline trait:
 *   - a + discipline item +2 / a - discipline item -2 in a show of that discipline;
 *   - a + temperament item +2 / - temperament item -2 for a horse of that temperament;
 *   - a favorite breed +2 for a horse of that breed;
 *   - a + trait item +1 / - trait item -1 for a horse that shows that trait.
 * Hidden and revealed items work the same (owner ruling 10-28). An item that does not
 * match the horse or the show changes nothing.
 *
 * Real scorer and real DB rows; the only seam is the luck rng.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { careForHealth } from '../../../__tests__/helpers/healthFixture.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { neutralTemperament } from '../../../__tests__/helpers/neutralTemperament.mjs';
import { horseTemperamentValues } from '../../../constants/schema.mjs';
import { applyPercentTerms, scoreShowEntries } from '../services/competitionScoring.mjs';
import { scoreOrdering, scoringHorseSelect } from '../shows/showOrdering.mjs';

const fixturePrefix = 'TestFixture-xlw03-riderpts';
const tag = () => randomBytes(4).toString('hex');
const showDiscipline = 'Dressage';
const otherDiscipline = 'Racing';
const luckTen = () => 0.999999; // luck +10%

const flat = v => ({
  speed: v,
  stamina: v,
  agility: v,
  balance: v,
  precision: v,
  intelligence: v,
  boldness: v,
  flexibility: v,
  obedience: v,
  focus: v,
});

const item = (kind, value, sign = 'positive', revealed = false) => ({ kind, value, sign, revealed });

describe("a rider's hidden items at a show (scorer)", () => {
  const horse = {
    id: 1,
    name: 'TestFixture-xlw03-scorer',
    breedId: 7,
    epigeneticModifiers: { positive: ['brave'], negative: ['fearful'], hidden: ['confident'] },
    disciplineScores: {},
    ...careForHealth('Good'),
    ...flat(100),
  };

  const scoreWith = (items, { show = showDiscipline } = {}) =>
    scoreShowEntries({
      show: { id: 0, discipline: show },
      entries: [{ horseId: 1, horse: { ...horse, temperament: neutralTemperament(show) } }],
      assignmentByHorseId: new Map([[1, { riderId: 9, rider: null }]]),
      riderItemsByRiderId: new Map([[9, items]]),
      rng: luckTen,
    })[0];

  it('a rider with no matching item changes nothing', () => {
    const base = scoreWith([]);
    expect(base.breakdown.riderItemPoints).toBe(0);
    // 100 x 1.10 = 110
    expect(base.score).toBe(110);
    const unrelated = scoreWith([
      item('discipline', otherDiscipline),
      item('discipline', otherDiscipline, 'negative'),
      item(
        'temperament',
        horseTemperamentValues.find(t => t !== neutralTemperament(showDiscipline)),
      ),
      item('breed', 8),
      item('trait', 'outgoing'),
      item('trait', 'aloof', 'negative'),
    ]);
    expect(unrelated.breakdown.riderItemPoints).toBe(0);
    expect(unrelated.score).toBe(base.score);
  });

  it('a + discipline item is +2 and a - one is -2, in that discipline only', () => {
    const plus = scoreWith([item('discipline', showDiscipline)]);
    expect(plus.breakdown.riderItemPoints).toBe(2);
    // (100 + 2) x 1.10 = 112.2 -> 112: the points go in before the percent.
    expect(plus.score).toBe(112);
    const minus = scoreWith([item('discipline', showDiscipline, 'negative')]);
    expect(minus.breakdown.riderItemPoints).toBe(-2);
    // (100 - 2) x 1.10 = 107.8 -> 108
    expect(minus.score).toBe(108);
    const elsewhere = scoreWith([item('discipline', showDiscipline)], { show: otherDiscipline });
    expect(elsewhere.breakdown.riderItemPoints).toBe(0);
  });

  it('a + temperament item is +2 and a - one is -2 for a horse of that temperament', () => {
    const own = neutralTemperament(showDiscipline);
    const plus = scoreWith([item('temperament', own)]);
    expect(plus.breakdown.riderItemPoints).toBe(2);
    expect(plus.score).toBe(112);
    const minus = scoreWith([item('temperament', own, 'negative')]);
    expect(minus.breakdown.riderItemPoints).toBe(-2);
    expect(minus.score).toBe(108);
  });

  it('a favorite breed is +2 for a horse of that breed', () => {
    const match = scoreWith([item('breed', 7)]);
    expect(match.breakdown.riderItemPoints).toBe(2);
    expect(match.score).toBe(112);
    expect(scoreWith([item('breed', 8)]).breakdown.riderItemPoints).toBe(0);
  });

  it('a + trait item is +1 and a - one is -1 for a horse that shows that trait', () => {
    const plus = scoreWith([item('trait', 'brave')]);
    expect(plus.breakdown.riderItemPoints).toBe(1);
    // (100 + 1) x 1.10 = 111.1 -> 111
    expect(plus.score).toBe(111);
    const minus = scoreWith([item('trait', 'brave', 'negative')]);
    expect(minus.breakdown.riderItemPoints).toBe(-1);
    // (100 - 1) x 1.10 = 108.9 -> 109
    expect(minus.score).toBe(109);
    // A horse's negative trait counts as carried too.
    expect(scoreWith([item('trait', 'fearful')]).breakdown.riderItemPoints).toBe(1);
  });

  it("a horse's own hidden trait is inert, so a rider's item for it changes nothing", () => {
    expect(scoreWith([item('trait', 'confident')]).breakdown.riderItemPoints).toBe(0);
  });

  it('revealed and hidden items score alike, and several items add up', () => {
    const result = scoreWith([
      item('discipline', showDiscipline, 'positive', true),
      item('breed', 7, 'positive', false),
      item('trait', 'brave', 'negative', true),
    ]);
    expect(result.breakdown.riderItemPoints).toBe(2 + 2 - 1);
    // (100 + 3) x 1.10 = 113.3 -> 113
    expect(result.score).toBe(113);
  });

  it('a horse with no rider gets no rider points', () => {
    const [result] = scoreShowEntries({
      show: { id: 0, discipline: showDiscipline },
      entries: [{ horseId: 1, horse: { ...horse, temperament: neutralTemperament(showDiscipline) } }],
      assignmentByHorseId: new Map(),
      riderItemsByRiderId: new Map([[9, [item('discipline', showDiscipline)]]]),
      rng: luckTen,
    });
    expect(result.breakdown.riderItemPoints).toBe(0);
    expect(result.score).toBe(110);
  });
});

describe("a rider's stored hidden items reach the show ordering (real rows)", () => {
  const cleanup = createCleanupTracker();
  const horseIds = [];
  const riderIds = [];
  let user;
  let breedId;
  let otherBreedId;

  beforeAll(async () => {
    cleanup.add(() => prisma.riderAssignment.deleteMany({ where: { riderId: { in: riderIds } } }), 'riderAssignment');
    cleanup.add(() => prisma.rider.deleteMany({ where: { id: { in: riderIds } } }), 'rider');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horse');
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
    const t = tag();
    user = await prisma.user.create({
      data: {
        emailVerified: true,
        username: `${fixturePrefix}-${t}`,
        email: `${fixturePrefix}-${t}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Rider',
        lastName: 'Points',
        settings: {},
      },
    });
    const breeds = await prisma.breed.findMany({ select: { id: true }, orderBy: { id: 'asc' }, take: 2 });
    [{ id: breedId }, { id: otherBreedId }] = breeds;
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  async function scoreWithRiderItems(items) {
    const horse = await createTestHorse(
      prisma,
      {
        name: `${fixturePrefix}-horse-${tag()}`,
        sex: 'Mare',
        userId: user.id,
        breedId,
        temperament: neutralTemperament(showDiscipline),
        epigeneticModifiers: { positive: ['brave'], negative: [], hidden: [] },
        ...flat(100),
        ...careForHealth('Good'),
      },
      horseIds,
    );
    const rider = await prisma.rider.create({
      data: {
        userId: user.id,
        firstName: 'TestFixture',
        lastName: `xlw03-pts-${tag()}`,
        personality: 'methodical',
        starLevel: 'rookie',
      },
    });
    riderIds.push(rider.id);
    await prisma.riderGrowthProfile.create({ data: { riderId: rider.id, items } });
    await prisma.riderAssignment.create({
      data: { riderId: rider.id, horseId: horse.id, userId: user.id, isActive: true },
    });
    const entryHorse = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: scoringHorseSelect,
    });
    const [row] = await scoreOrdering(
      { id: 0, discipline: showDiscipline },
      [{ horseId: horse.id, userId: user.id, horse: entryHorse }],
      luckTen,
      new Date(),
    );
    return row;
  }

  it('no matching item: the plain score; each matching item moves it by the ruled amount', async () => {
    const plain = await scoreWithRiderItems([item('breed', otherBreedId), item('trait', 'outgoing')]);
    expect(plain.scoreInputs.riderItemPoints).toBe(0);

    const matched = await scoreWithRiderItems([
      item('discipline', showDiscipline), // +2
      item('breed', breedId), // +2
      item('trait', 'brave', 'negative'), // -1
      item('temperament', neutralTemperament(showDiscipline), 'negative'), // -2
    ]);
    expect(matched.scoreInputs.riderItemPoints).toBe(1);

    // The same horse stats and the same real rider percent: the matched score is the plain
    // flat total plus exactly the 1 point, before the percentages.
    const flatOf = r => r.scoreInputs.base + r.scoreInputs.trainingPoints + r.scoreInputs.tackPoints;
    const percentsOf = r => [
      r.scoreInputs.luckPercent,
      r.scoreInputs.riderPercent,
      r.scoreInputs.temperamentPercent,
      r.scoreInputs.healthPercent,
    ];
    expect(plain.score).toBe(applyPercentTerms(flatOf(plain), percentsOf(plain)));
    expect(matched.score).toBe(applyPercentTerms(flatOf(matched) + 1, percentsOf(matched)));
  }, 60000);
});
