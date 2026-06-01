/**
 * Sentinel test (Equoria-dfet1 / Equoria-o26xc): executeClosedShows fires a
 * DISTINCT 'competition_placement' Notification on EVERY top-3 finish.
 *
 * Re-anchor of the deleted Equoria-toqet sentinel
 * (enhancedCompetitionPlacementNotification.sentinel.test.mjs), now bound
 * to the canonical post-toqet cron-driven executor in
 * backend/modules/competition/shows/showController.mjs#executeClosedShows.
 *
 * Why this is sentinel-positive and RNG-independent:
 *   - A single valid horse entered into a show always places 1st (it is
 *     the only scorer), so the placement is deterministic regardless of
 *     the ±9% luck factor inside the scorer.
 *   - executeClosedShows performs NO stat-gain RNG roll on the cron path,
 *     so there is no statGains coupling at all — the placement
 *     notification leg is the ONLY notification the cron path writes for
 *     top-3 finishers.
 *   - BEFORE the o26xc fix, executeClosedShows imported zero notification
 *     helpers and called createNotification zero times. Running this
 *     sentinel against the pre-fix controller produces ZERO
 *     'competition_placement' rows → the assertion below fails
 *     (length === 0, not >= 1).
 *   - AFTER the o26xc fix, a 'competition_placement' row is written on
 *     every top-3 finish, FAIL-SOFT (try/catch outside the prize-payout
 *     transaction). The assertion is deterministic.
 *
 * Scoped showIds parameter is used on the execute call so this suite never
 * claims/scores another parallel suite's open shows.
 *
 * Real DB, no mocks, scoped TestFixture- fixtures, scoped LOUD-catch
 * cleanup (per silent-cleanup-catch doctrine — see CONTRIBUTING.md).
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { executeClosedShows } from '../shows/showController.mjs';
import logger from '../../../utils/logger.mjs';

const PREFIX = 'TestFixture-ExecClosedNotif-';

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
      username: `execnotif_${uid()}`,
      email: `${PREFIX}${uid()}@test.com`,
      password: 'irrelevant',
      firstName: 'Exec',
      lastName: 'Notif',
      money: 10000,
    },
  });

  // Healthy horse with explicit non-default stats so it scores deterministically.
  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}Horse-${uid()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2018-01-01'),
      age: 7,
      userId: user.id,
      healthStatus: 'healthy',
      speed: 60,
      stamina: 60,
      agility: 60,
      balance: 60,
      precision: 60,
      boldness: 60,
    },
  });

  // closeDate in the past so executeClosedShows picks it up on the first run.
  const pastClose = new Date(Date.now() - 60 * 60 * 1000);
  show = await prisma.show.create({
    data: {
      name: `${PREFIX}Show-${uid()}`,
      discipline: 'Dressage',
      entryFee: 0,
      levelMin: 1,
      levelMax: 999,
      prize: 1000,
      runDate: pastClose,
      status: 'open',
      openDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      closeDate: pastClose,
      createdByUserId: user.id,
    },
  });

  await prisma.showEntry.create({
    data: { showId: show.id, horseId: horse.id, userId: user.id, feePaid: 0 },
  });
}, 30000);

afterAll(async () => {
  // Scoped cleanup — only this suite's rows. LOUD .catch per silent-cleanup
  // doctrine ratchet (must NOT swallow errors silently — see CONTRIBUTING.md).
  if (user) {
    await prisma.notification
      .deleteMany({ where: { userId: user.id } })
      .catch(err => logger.warn(`[dfet1 cleanup] notification.deleteMany failed: ${err.message}`));
  }
  if (show) {
    await prisma.competitionResult
      .deleteMany({ where: { showId: show.id } })
      .catch(err => logger.warn(`[dfet1 cleanup] competitionResult.deleteMany failed: ${err.message}`));
    await prisma.showEntry
      .deleteMany({ where: { showId: show.id } })
      .catch(err => logger.warn(`[dfet1 cleanup] showEntry.deleteMany failed: ${err.message}`));
    await prisma.show
      .delete({ where: { id: show.id } })
      .catch(err => logger.warn(`[dfet1 cleanup] show.delete failed: ${err.message}`));
  }
  if (horse) {
    await prisma.horse
      .delete({ where: { id: horse.id } })
      .catch(err => logger.warn(`[dfet1 cleanup] horse.delete failed: ${err.message}`));
  }
  if (user) {
    await prisma.user
      .delete({ where: { id: user.id } })
      .catch(err => logger.warn(`[dfet1 cleanup] user.delete failed: ${err.message}`));
  }
}, 30000);

describe('SENTINEL: executeClosedShows → competition_placement notification on top-3 (Equoria-dfet1 / Equoria-o26xc)', () => {
  it('creates a competition_placement notification on a 1st-place cron-executed finish', async () => {
    // Scope to ONLY this suite's show — never claim another parallel suite's
    // open shows.
    await executeClosedShows({ body: { showIds: [show.id] } }, null);

    // The sole valid horse must have placed 1st.
    const result = await prisma.competitionResult.findFirst({
      where: { showId: show.id, horseId: horse.id },
    });
    expect(result).not.toBeNull();
    expect(result.placement).toBe('1');

    // Core sentinel: a DISTINCT competition_placement row exists for the
    // horse owner. Against the pre-o26xc controller this assertion fails
    // (no createNotification call exists on the executeClosedShows path).
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

  it('SENTINEL: a second executeClosedShows run does NOT duplicate the placement notification (claim-the-work is intact)', async () => {
    // Per Equoria-koodu, executeClosedShows must NOT re-process a completed
    // show. The notification leg piggy-backs on the resultOps loop, so if
    // the koodu claim-and-mark-completed pattern is ever weakened, this
    // sentinel surfaces it as a duplicate notification.
    const before = await prisma.notification.count({
      where: { userId: user.id, type: 'competition_placement' },
    });

    await executeClosedShows({ body: { showIds: [show.id] } }, null);

    const after = await prisma.notification.count({
      where: { userId: user.id, type: 'competition_placement' },
    });

    expect(after).toBe(before);
  }, 30000);
});
