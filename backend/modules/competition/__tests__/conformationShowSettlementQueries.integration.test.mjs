/**
 * Conformation show settlement does a bounded amount of database work
 * (Equoria-cmw85.11).
 *
 * The defects: settling a conformation show (executeConformationShow) loaded
 * every entrant's whole horse row (every JSONB column) when scoring reads five
 * fields; looked up the active groom of every legacy entry (one entered before
 * entries recorded their groom) with its own query; and wrote each entrant's
 * rewards and result with two to four statements of its own, all inside the one
 * 30-second settlement transaction holding a connection of the three-connection
 * production pool.
 *
 * The contract now, for a 16-entry show with 4 legacy entries:
 *   - the legacy groom lookup is one query, not one per entry;
 *   - no statement reads the horses' JSONB columns the scorer never uses;
 *   - the results are one INSERT, and the horse updates are grouped by reward
 *     tier (title points, breeding-value boost, newly reached title) instead of
 *     one per entrant;
 * while every reward is exactly what the scoring rules give (golden values
 * computed from the pure scorer and reward table).
 *
 * Mechanism (no Prisma mock, no spy), as in dynamicCompatibilityReads: the
 * shared client module adopts a `globalThis.__prisma` handle installed before
 * it loads, pointed at a REAL PrismaClient with query-event logging.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';

let observedClient = null;
const appClientHandle = new Proxy(
  {},
  {
    get(_target, prop) {
      if (!observedClient) {
        return prop === '$disconnect' ? async () => {} : undefined;
      }
      const value = Reflect.get(observedClient, prop);
      return typeof value === 'function' ? value.bind(observedClient) : value;
    },
  },
);
globalThis.__prisma = appClientHandle;

const { default: prisma, PrismaClient } = await import('../../../../packages/database/prismaClient.mjs');
const { buildDatabaseUrl } = await import('../../../../packages/database/dbPoolConfig.mjs');

observedClient = new PrismaClient({
  datasources: { db: { url: buildDatabaseUrl(process.env.DATABASE_URL, process.env) } },
  log: [{ emit: 'event', level: 'query' }],
  errorFormat: 'minimal',
});
const { createQueryEventRecorder } = await import('../../../__tests__/helpers/queryEventRecorder.mjs');
const recorder = createQueryEventRecorder(observedClient);

const {
  executeConformationShow,
  calculateConformationShowScore,
  resolveReward,
  resolveTitle,
  applyBreedingValueBoost,
} = await import('../services/conformationShowService.mjs');
const { fixtureColor } = await import('../../../tests/helpers/fixtureColor.mjs');
const { createCleanupTracker } = await import('../../../__tests__/helpers/failLoudCleanup.mjs');

const PREFIX = 'TestFixture-cmw8511';
// Settlement scores with a class-neutral default; the class never changes a
// score, so any valid class gives the same golden value.
const scoringClass = 'Mares';
const RECORDED = 12;
const LEGACY = 4;
const tag = randomBytes(4).toString('hex');
const cleanup = createCleanupTracker();

let showId;
let fixtures; // [{ horse, groom }] in entry order
const userIds = [];
const groomIds = [];
const horseIds = [];
const showIds = [];

// Dependency order: results, entries and the show, then horses (their groom
// assignments cascade), grooms, and the user last.
cleanup.add(() => prisma.competitionResult.deleteMany({ where: { showId: { in: showIds } } }), 'results');
cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: { in: showIds } } }), 'entries');
cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'show');
cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
cleanup.add(() => prisma.groom.deleteMany({ where: { id: { in: groomIds } } }), 'grooms');
cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'user');

const conformationFor = i => {
  const v = 30 + i * 3; // a spread of scores across the field
  return {
    head: v,
    neck: v,
    shoulders: v,
    back: v,
    legs: v,
    hooves: v,
    topline: v,
    hindquarters: v,
    overallConformation: v,
  };
};

beforeAll(async () => {
  expect(prisma).toBe(appClientHandle);
  const user = await prisma.user.create({
    data: {
      email: `${PREFIX}-${tag}@test.local`,
      username: `${PREFIX}-${tag}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'Conformation',
      lastName: 'Queries',
      money: 0,
    },
  });
  userIds.push(user.id);
  const makeGroom = async (label, skill, personality) => {
    const groom = await prisma.groom.create({
      data: {
        name: `${PREFIX}-${label}-${tag}`,
        speciality: 'showHandling',
        personality,
        showHandlingSkill: skill,
        userId: user.id,
      },
    });
    groomIds.push(groom.id);
    return groom;
  };
  const recordedGroom = await makeGroom('recorded', 'expert', 'gentle');
  const legacyGroom = await makeGroom('legacy', 'novice', 'energetic');

  const show = await prisma.show.create({
    data: {
      name: `${PREFIX}-show-${tag}`,
      discipline: 'conformation',
      levelMin: 0,
      levelMax: 10,
      entryFee: 0,
      prize: 0,
      runDate: new Date(),
      closeDate: new Date(Date.now() - 60 * 60 * 1000),
      showType: 'conformation',
    },
  });
  showId = show.id;
  showIds.push(showId);

  fixtures = [];
  for (let i = 0; i < RECORDED + LEGACY; i++) {
    const legacy = i >= RECORDED;
    const horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${PREFIX}-horse-${i}-${tag}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 2,
        userId: user.id,
        healthStatus: 'Good',
        bondScore: 40 + i,
        temperament: i % 2 === 0 ? 'Calm' : 'Spirited',
        conformationScores: conformationFor(i),
        // Some horses sit just under a title threshold or the boost cap, so
        // the settlement crosses them.
        titlePoints: i % 4 === 0 ? 23 : i % 4 === 1 ? 45 : 0,
        currentTitle: i % 4 === 1 ? 'Noteworthy' : null,
        breedingValueBoost: i % 3 === 0 ? 0.14 : 0,
      },
    });
    horseIds.push(horse.id);
    const groom = legacy ? legacyGroom : recordedGroom;
    if (legacy) {
      await prisma.groomAssignment.create({
        data: { groomId: legacyGroom.id, foalId: horse.id, userId: user.id, isActive: true, priority: 1 },
      });
      await prisma.showEntry.create({ data: { showId, horseId: horse.id, userId: user.id } });
    } else {
      await prisma.showEntry.create({
        data: {
          showId,
          horseId: horse.id,
          userId: user.id,
          groomId: recordedGroom.id,
          groomSnapshot: {
            id: recordedGroom.id,
            name: recordedGroom.name,
            showHandlingSkill: recordedGroom.showHandlingSkill,
            personality: recordedGroom.personality,
          },
        },
      });
    }
    fixtures.push({ horse, groom });
  }
}, 120000);

afterAll(async () => {
  await cleanup.run();
  await observedClient.$disconnect();
}, 60000);

const onTable = (statements, verb, table) =>
  statements.filter(sql => new RegExp(`^${verb}\\b[\\s\\S]*"(?:public"\\.")?${table}"`, 'i').test(sql.trim()));

describe('conformation show settlement work (Equoria-cmw85.11)', () => {
  it('scores every entrant with bounded queries and pays exactly the rule rewards', async () => {
    // Golden values from the pure scorer: ranked by score, reward by placement.
    // Equal scores keep entry order (the settlement reads entries by createdAt,
    // then id; fixtures are in creation order and the sort is stable).
    const ranked = fixtures
      .map(({ horse, groom }) => ({
        horse,
        score: calculateConformationShowScore(horse, groom, scoringClass).finalScore,
      }))
      .sort((a, b) => b.score - a.score);

    const { result, statements } = await recorder.measure(() => executeConformationShow(showId));

    // Queries: one legacy groom lookup, no unused horse JSONB, one INSERT, and
    // horse UPDATEs grouped by tier (4 title-point tiers + 3 boost tiers + the
    // titles newly reached), not one or more per entrant.
    expect(onTable(statements, 'SELECT', 'groom_assignments')).toHaveLength(1);
    const horseReads = onTable(statements, 'SELECT', 'horses');
    expect(horseReads.length).toBeGreaterThan(0);
    for (const sql of horseReads) {
      expect(sql).not.toMatch(/"epigeneticModifiers"|"genotype"|"colorGenotype"|"disciplineScores"/);
    }
    expect(onTable(statements, 'INSERT', 'competition_results')).toHaveLength(1);
    const horseUpdates = onTable(statements, 'UPDATE', 'horses');
    expect(horseUpdates.length).toBeLessThanOrEqual(12);
    expect(horseUpdates.length).toBeLessThan(RECORDED + LEGACY);

    // Rewards: exactly the rule values.
    expect(result).toHaveLength(ranked.length);
    const rows = await prisma.competitionResult.findMany({ where: { showId } });
    const horses = await prisma.horse.findMany({
      where: { id: { in: ranked.map(r => r.horse.id) } },
      select: { id: true, titlePoints: true, currentTitle: true, breedingValueBoost: true },
    });
    for (const [index, { horse, score }] of ranked.entries()) {
      const placement = index + 1;
      const reward = resolveReward(placement);
      const points = horse.titlePoints + reward.titlePoints;
      const boost = applyBreedingValueBoost(horse.breedingValueBoost, reward.breedingBoostDelta);

      const row = rows.find(r => r.horseId === horse.id);
      expect(row.placement).toBe(String(placement));
      expect(Number(row.score)).toBe(score);
      expect(row.prizeWon).toBeNull();
      expect(row.statGains).toEqual({ ribbon: reward.ribbon, titlePoints: reward.titlePoints });

      const after = horses.find(h => h.id === horse.id);
      expect(after.titlePoints).toBe(points);
      expect(after.currentTitle).toBe(resolveTitle(points));
      expect(after.breedingValueBoost).toBeCloseTo(boost, 10);

      const returned = result.find(r => r.horseId === horse.id);
      expect(returned).toMatchObject({
        placement,
        score,
        ribbon: reward.ribbon,
        titlePoints: reward.titlePoints,
        newTitle: resolveTitle(points),
      });
      expect(returned.breedingValueBoost).toBeCloseTo(boost, 10);
    }

    const show = await prisma.show.findUnique({ where: { id: showId }, select: { status: true } });
    expect(show.status).toBe('completed');
  }, 120000);
});
