/**
 * Rider modifier integration test for showExecutionService.executeClosedShows
 *
 * Bug fix for Equoria-5bkh: prior code computed
 *   `score = Math.round(base + luck)`
 * with NO RiderAssignment lookup affecting the score — only post-hoc
 * stat tracking. This test creates two horses with identical stats, assigns
 * an elite Rider to one, runs `executeClosedShows`, and asserts the
 * rider-assigned horse's score is higher than the unassigned horse's score
 * across many runs. Since Equoria-576c0 B5 (owner rulings C1/C2) the score is
 * round(base x (1 + luck% + rider%)), luck a whole +1..+10% per horse per
 * show, so the rider's percent is summed with luck and applied once.
 *
 * Failing-test-first per .claude/rules/EDGE_CASE_FIX_DISCIPLINE.md §1:
 *   Before the fix, the rider-assigned horse scores no better than the
 *   unassigned horse — luck dominates entirely. After the fix, the elite
 *   rider's ~9% bonus shifts win frequency materially above 50%.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { executeClosedShows } from '../shows/showExecutionService.mjs';
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

  // Two horses with IDENTICAL stats so any score delta is rider-attributable.
  // Owner ruling R8 (Equoria-576c0 B4a): the base is the discipline's 50/30/20
  // (Dressage: precision, focus, obedience). Old contract: the flat average of
  // five stats, so focus/obedience were never set; all ten are now 70, base 70.
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
    intelligence: 70,
    flexibility: 70,
    obedience: 70,
    focus: 70,
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
   * Model of each independent head-to-head run (both horses base = 70; B5,
   * owner rulings C1/C2):
   *   noRider score = round(70 * (1 + L1/100)),       L1 uniform on 1..10
   *   rider  score  = round(70 * (1 + (L2 + 10)/100)), L2 uniform on 1..10
   * The elite rider's modifier is experienced(+3%) + level10(+3.6%) +
   * prestige100(+4%) + methodical/Dressage-high(+2%) = 12.6%, capped at the
   * BONUS_CAP of 10% by computeRiderModifiers. Exact enumeration of the 100
   * (L1, L2) pairs: the rider always wins (lowest rider 77.7 -> 78 beats the
   * highest no-rider 77), so P(rider strictly wins) = 1 and riderWins = 300.
   *
   * Under the null hypothesis of NO edge (broken modifier, rider term 0),
   * exact enumeration gives P(strict win) = 0.42 (ties are common with
   * whole-percent luck): mean 126, null-sd ≈ 8.55, so the threshold
   * MIN_RIDER_WINS = 199 is ≈ 8.5 null-sd ABOVE it — a broken/zero modifier
   * fails this assertion essentially always.
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
    // Binomial bound: the healthy model wins all 300 (p = 1, B5); the no-edge
    // null averages 126, ≈ 8.5σ below this threshold.
    // Far below the rider's expected wins, far above the no-edge null (150).
    const MIN_RIDER_WINS = 199;

    const openDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const closeDate = new Date(Date.now() - 60 * 60 * 1000);
    // Equoria-2a095: the shows are created NOT yet due and only made due once
    // both entries exist. Created already past their close date, a show was
    // claimable by any executor scanning globally (a sibling suite, the cron
    // path's tests) in the gap before its entries were inserted; that run
    // settled it with no entries, so this suite later found no result for it
    // (`expect(riderResult).toBeTruthy()` failing in parallel runs).
    const notYetDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
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
      runDate: notYetDue,
      status: 'open',
      openDate,
      closeDate: notYetDue,
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

    // Both entries are in: now the shows are due.
    await prisma.show.updateMany({
      where: { id: { in: myShowIds } },
      data: { closeDate, runDate: closeDate },
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

    // Primary statistical assertion: the healthy model (p = 1 since B5) always
    // clears it, and it sits ≈ 8.5 null-σ above the no-edge center (p = 0.42),
    // so a broken modifier fails.
    expect(riderWins).toBeGreaterThanOrEqual(MIN_RIDER_WINS);

    // Average advantage should be materially positive — both horses draw luck
    // from the same +1..+10%, so averages differ by the rider's ~10% term.
    expect(avgRider).toBeGreaterThan(avgNoRider);
  }, 180000);
});
