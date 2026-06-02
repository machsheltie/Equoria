/**
 * Rider modifier integration test for showController.executeClosedShows
 *
 * Bug fix for Equoria-5bkh: prior code computed
 *   `score = Math.round(base + luck)`
 * with NO RiderAssignment lookup affecting the score — only post-hoc
 * stat tracking. This test creates two horses with identical stats, assigns
 * an elite Rider to one, runs `executeClosedShows`, and asserts the
 * rider-assigned horse's score is higher than the unassigned horse's score
 * averaged across multiple runs (the ±9% luck noise washes out at N runs).
 *
 * Failing-test-first per .claude/rules/EDGE_CASE_FIX_DISCIPLINE.md §1:
 *   Before the fix, the rider-assigned horse scores no better than the
 *   unassigned horse — luck dominates entirely. After the fix, the elite
 *   rider's ~9% bonus shifts win frequency materially above 50%.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { executeClosedShows } from '../shows/showController.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const TAG = `RiderModFix-${randomBytes(4).toString('hex')}`;

let user;
let horseWithRider;
let horseWithoutRider;
let elitRider;
const createdShowIds = [];
const cleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `${TAG}@test.local`,
      username: `${TAG}-user`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'RiderMod',
      lastName: 'Test',
      money: 0,
    },
  });

  // Two horses with IDENTICAL stats so any score delta is rider-attributable
  const horseStats = {
    ...fixtureColor(),
    sex: 'Mare',
    dateOfBirth: new Date('2018-01-01'),
    age: 7,
    userId: user.id,
    healthStatus: 'healthy',
    speed: 70,
    stamina: 70,
    agility: 70,
    balance: 70,
    precision: 70,
    boldness: 70,
  };

  horseWithRider = await prisma.horse.create({
    data: { ...horseStats, name: `TestFixture-${TAG}-WithRider` },
  });
  horseWithoutRider = await prisma.horse.create({
    data: { ...horseStats, name: `TestFixture-${TAG}-NoRider` },
  });

  // Create an elite rider: experienced + max level/prestige + matching discipline
  elitRider = await prisma.rider.create({
    data: {
      firstName: 'TestFixture',
      lastName: `${TAG}-EliteRider`,
      personality: 'methodical', // Dressage affinity = high (+2%)
      skillLevel: 'experienced', // +3%
      speciality: 'Dressage',
      level: 10, // +3.6%
      prestige: 100, // +4%
      userId: user.id,
    },
  });

  await prisma.riderAssignment.create({
    data: {
      riderId: elitRider.id,
      horseId: horseWithRider.id,
      userId: user.id,
      isActive: true,
    },
  });

  // Scoped, fail-loud cleanup (Equoria-1ohys). createdShowIds is populated by
  // the tests, so the closures read it at run() time. FK order: results +
  // entries -> shows; riderAssignment -> rider; horses -> user (Horse.userId is
  // onDelete:Restrict). A cleanup failure now fails the suite instead of being
  // swallowed.
  cleanup.add(
    () => prisma.competitionResult.deleteMany({ where: { showId: { in: createdShowIds } } }),
    'competitionResult',
  );
  cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: { in: createdShowIds } } }), 'showEntry');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: createdShowIds } } }), 'show');
  cleanup.add(
    () => prisma.riderAssignment.deleteMany({ where: { horseId: { in: [horseWithRider.id, horseWithoutRider.id] } } }),
    'riderAssignment',
  );
  cleanup.add(() => (elitRider ? prisma.rider.delete({ where: { id: elitRider.id } }) : undefined), 'rider');
  cleanup.add(
    () => (horseWithRider ? prisma.horse.delete({ where: { id: horseWithRider.id } }) : undefined),
    'horseWithRider',
  );
  cleanup.add(
    () => (horseWithoutRider ? prisma.horse.delete({ where: { id: horseWithoutRider.id } }) : undefined),
    'horseWithoutRider',
  );
  cleanup.add(() => (user ? prisma.user.delete({ where: { id: user.id } }) : undefined), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

describe('executeClosedShows — RiderAssignment modifier (Equoria-5bkh)', () => {
  /**
   * Statistical soundness note (Equoria-j91px):
   *
   * The prior version of this test ran RUNS=20 head-to-head runs and asserted
   * `riderWins >= 13`. That was an under-powered binomial test that flaked in
   * CI (run 26163475806 re-run: Received 11). The fix is NOT to loosen the
   * threshold — that would weaken the test's power to detect a broken/zero
   * modifier (EDGE_CASE_FIX_DISCIPLINE §2). Instead we (a) raise N so the
   * law-of-large-numbers tightens the confidence interval on the win
   * proportion, and (b) derive the pass threshold from a binomial bound rather
   * than a hand-picked number.
   *
   * Model of each independent head-to-head run (both horses base = 70):
   *   noRider score = round(70 + U1),  U1 ~ Uniform[-9, +9]   (RANDOM_LUCK ±9%)
   *   rider  score  = round((70 + U2) * 1.10), U2 ~ Uniform[-9, +9]
   * The elite rider's modifier is experienced(+3%) + level10(+3.6%) +
   * prestige100(+4%) + methodical/Dressage-high(+2%) = 12.6%, capped at the
   * BONUS_CAP of 10% by computeRiderModifiers. A 5M-trial Monte Carlo of this
   * exact model gives P(rider strictly wins) ≈ 0.784.
   *
   * With N = 300 and p = 0.784: mean = 235.2, sd = sqrt(N·p·(1−p)) ≈ 7.13.
   * The pass threshold MIN_RIDER_WINS = 199 sits at (mean − 5.08·sd) — a real
   * (healthy) modifier dips below it with probability < 1e-6, so no flake.
   * Under the null hypothesis of NO edge (broken modifier ⇒ p = 0.5, mean =
   * 150, null-sd ≈ 8.66), the threshold 199 is 5.66 null-sd ABOVE the 50%
   * center — a broken/zero modifier fails this assertion essentially always.
   * The test therefore stays MEANINGFUL (detects a broken modifier) while no
   * longer flaking on normal RNG variance.
   *
   * N shows are created up front and scored in a SINGLE executeClosedShows()
   * call (the scorer processes every open/closed show, each entry getting an
   * independent luck roll), so raising N does not multiply executeClosedShows
   * overhead.
   */
  it('elite rider wins a statistically-bounded majority of head-to-head runs vs no-rider horse', async () => {
    const RUNS = 300;
    // Binomial lower bound: mean(235.2) − ~5σ for the true p≈0.784 model.
    // Far below the rider's expected wins, far above the no-edge null (150).
    const MIN_RIDER_WINS = 199;

    const openDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const closeDate = new Date(Date.now() - 60 * 60 * 1000);
    const now = Date.now();

    // Create RUNS shows up front (one batch), each a head-to-head of the two
    // identical-stat horses. Names are TestFixture-scoped for cleanup.
    const showData = Array.from({ length: RUNS }, (_, i) => ({
      name: `TestFixture-${TAG}-Show-${i}-${now}`,
      discipline: 'Dressage',
      entryFee: 0,
      levelMin: 1,
      levelMax: 999,
      prize: 0,
      runDate: closeDate,
      status: 'open',
      openDate,
      closeDate,
      createdByUserId: user.id,
    }));

    // createMany does not return ids, so create-then-collect by our unique tag.
    await prisma.show.createMany({ data: showData });
    const myShows = await prisma.show.findMany({
      where: { createdByUserId: user.id, name: { startsWith: `TestFixture-${TAG}-Show-` } },
      select: { id: true },
    });
    expect(myShows.length).toBe(RUNS);
    const myShowIds = myShows.map(s => s.id);
    createdShowIds.push(...myShowIds);

    await prisma.showEntry.createMany({
      data: myShowIds.flatMap(showId => [
        { showId, horseId: horseWithRider.id, userId: user.id, feePaid: 0 },
        { showId, horseId: horseWithoutRider.id, userId: user.id, feePaid: 0 },
      ]),
    });

    // ONE execute call scores all RUNS shows (each entry = independent luck).
    // Equoria-rsss0: scope to this suite's shows so the global executor does
    // not sweep up a parallel competition suite's past-due open shows (and so
    // a sibling's global executor is not the only thing keeping this robust).
    await executeClosedShows({ body: { showIds: myShowIds } }, null);

    // Tally results scoped to OUR shows only (real DB may hold other shows).
    // NOTE on duplicates: executeClosedShows queries `status:'open'` globally
    // and only flips to 'executing' AFTER the find, so a concurrent invocation
    // (another suite, a scheduled task, or a parallel agent) can re-score the
    // same show, producing >2 rows for it. competitionResult has no per-(show,
    // horse) uniqueness. We therefore deterministically pick ONE result per
    // (showId, horseId) — the lowest result id, i.e. the first scoring — so
    // each counted run is exactly one independent rider-vs-no-rider luck-roll
    // pair. This makes the statistic robust to real-DB concurrency without
    // weakening it: every counted pair is still a genuine head-to-head.
    const results = await prisma.competitionResult.findMany({
      where: { showId: { in: myShowIds } },
      select: { id: true, showId: true, horseId: true, score: true },
      orderBy: { id: 'asc' },
    });

    // First (lowest-id) result per (showId, horseId).
    const firstByShowHorse = new Map();
    for (const r of results) {
      const key = `${r.showId}:${r.horseId}`;
      if (!firstByShowHorse.has(key)) {
        firstByShowHorse.set(key, r);
      }
    }

    let riderWins = 0;
    let totalRiderScore = 0;
    let totalNoRiderScore = 0;
    let scoredRuns = 0;

    for (const showId of myShowIds) {
      const riderResult = firstByShowHorse.get(`${showId}:${horseWithRider.id}`);
      const noRiderResult = firstByShowHorse.get(`${showId}:${horseWithoutRider.id}`);
      // Every one of OUR shows must have produced a scored pair.
      expect(riderResult).toBeTruthy();
      expect(noRiderResult).toBeTruthy();

      const riderScore = Number(riderResult.score);
      const noRiderScore = Number(noRiderResult.score);

      totalRiderScore += riderScore;
      totalNoRiderScore += noRiderScore;
      scoredRuns++;
      if (riderScore > noRiderScore) {
        riderWins++;
      }
    }

    expect(scoredRuns).toBe(RUNS);

    const avgRider = totalRiderScore / RUNS;
    const avgNoRider = totalNoRiderScore / RUNS;

    // Primary statistical assertion: the rider's win count clears a ~5σ lower
    // bound for the true p≈0.784 model — reliable under healthy variance, but
    // 5.66 null-σ above the no-edge (p=0.5) center, so a broken modifier fails.
    expect(riderWins).toBeGreaterThanOrEqual(MIN_RIDER_WINS);

    // Average advantage should be materially positive — luck is symmetric so
    // averages converge to the rider's ~10% bonus contribution.
    expect(avgRider).toBeGreaterThan(avgNoRider);
  }, 180000);
});
