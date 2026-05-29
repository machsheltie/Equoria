/**
 * Sentinel test (Equoria-pi4nk): enterAndRunShow fires a DISTINCT
 * 'competition_placement' Notification on ANY top-3 finish, even when the
 * horse gains NO stat that run.
 *
 * Why this is sentinel-positive and RNG-independent:
 *   - A single valid horse entered into a show always places '1st' (it's the
 *     only scorer), so the placement is deterministic.
 *   - statGains is a 3-10% RNG roll (calculateStatGains, default Math.random),
 *     so on the vast majority of runs a 1st-place single entry gains NO stat.
 *   - BEFORE the fix, the only competition notification was inside
 *     `if (statGains)`, so this placing-but-no-stat-gain horse produced ZERO
 *     notifications. Run this test against the pre-fix controller and the
 *     'competition_placement' assertion fails (no such row, no such type).
 *   - AFTER the fix, a 'competition_placement' row is written on every top-3
 *     finish regardless of statGains — RNG-independent, so the assertion is
 *     deterministic.
 *
 * Real DB, no mocks, scoped TestFixture- fixtures, scoped cleanup.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { enterAndRunShow } from '../controllers/competitionController.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const PREFIX = 'TestFixture-PlaceNotif-';

function uid() {
  return randomBytes(6).toString('hex');
}

let user;
let horse;
let show;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      id: `${PREFIX}${uid()}`,
      username: `placenotif_${uid()}`,
      email: `${PREFIX}${uid()}@test.com`,
      password: 'irrelevant',
      firstName: 'Place',
      lastName: 'Notif',
      money: 10000,
    },
  });

  // Healthy horse WITH a rider — passes hasValidRider, the critical-health
  // gate, and isHorseEligibleForShow (level check skipped when level
  // undefined). As the sole valid entry it deterministically places 1st.
  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}Horse-${uid()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2020-01-01'),
      age: 5,
      userId: user.id,
      rider: { id: 1, name: 'Test Rider' },
      lastFedDate: new Date(),
    },
  });

  show = await prisma.show.create({
    data: {
      name: `${PREFIX}Show-${uid()}`,
      discipline: 'Dressage',
      runDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      prize: 5000,
      entryFee: 0,
      levelMin: 1,
      levelMax: 10,
      status: 'open',
      hostUserId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  // Scoped cleanup — only this suite's rows (never bare deleteMany).
  await prisma.notification.deleteMany({ where: { userId: user?.id } }).catch(() => {});
  await prisma.competitionResult.deleteMany({ where: { horseId: horse?.id } }).catch(() => {});
  if (show) {
    await prisma.show.delete({ where: { id: show.id } }).catch(() => {});
  }
  if (horse) {
    await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  }
  if (user) {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }
}, 30000);

describe('SENTINEL: enterAndRunShow → competition_placement notification on top-3 (Equoria-pi4nk)', () => {
  it('creates a competition_placement notification on a 1st-place finish regardless of stat gain', async () => {
    const result = await enterAndRunShow([horse.id], show);

    // Sanity: the sole valid horse placed (deterministically 1st).
    expect(result.success).toBe(true);
    expect(result.summary.topThree.length).toBeGreaterThanOrEqual(1);
    expect(result.summary.topThree[0].placement).toBe('1st');

    // Core sentinel: a DISTINCT competition_placement row exists.
    // This fails against the pre-fix controller (no such type was ever written
    // unless statGains was non-null — and statGains is a 3-10% RNG roll).
    const placementRows = await prisma.notification.findMany({
      where: { userId: user.id, type: 'competition_placement' },
    });

    expect(placementRows.length).toBeGreaterThanOrEqual(1);

    const row = placementRows[0];
    expect(row.payload).toHaveProperty('horseName', horse.name);
    expect(row.payload).toHaveProperty('placement', '1st');
    expect(row.payload).toHaveProperty('discipline', 'Dressage');
    expect(row.payload).toHaveProperty('showName', show.name);
    expect(row.payload).toHaveProperty('prizeWon');
  }, 30000);

  it('does not break the stat_gain path: when a stat is gained, a competition_stat_gain row also exists', async () => {
    // Read whatever was written by the run above. statGains is RNG-driven, so
    // a competition_stat_gain row MAY or MAY NOT exist on any given run. We
    // assert the invariant that holds either way:
    //   - placement notification ALWAYS exists (proven above)
    //   - IF a stat_gain notification exists, its payload is well-formed AND
    //     it co-exists with the placement notification (i.e. the placement fix
    //     did not replace or suppress the stat-gain path).
    const statGainRows = await prisma.notification.findMany({
      where: { userId: user.id, type: 'competition_stat_gain' },
    });
    const placementRows = await prisma.notification.findMany({
      where: { userId: user.id, type: 'competition_placement' },
    });

    // The placement path must still be intact.
    expect(placementRows.length).toBeGreaterThanOrEqual(1);

    if (statGainRows.length > 0) {
      const sg = statGainRows[0];
      expect(sg.payload).toHaveProperty('horseName', horse.name);
      expect(sg.payload).toHaveProperty('stat');
      expect(sg.payload).toHaveProperty('amount', 1);
      expect(sg.payload).toHaveProperty('placement', '1st');
      expect(sg.payload).toHaveProperty('discipline', 'Dressage');
      // Both events fire independently — neither suppresses the other.
      expect(placementRows.length).toBeGreaterThanOrEqual(1);
    }
  }, 30000);
});
