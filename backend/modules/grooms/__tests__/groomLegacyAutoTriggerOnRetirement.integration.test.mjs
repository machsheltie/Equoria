/**
 * Integration test (Equoria-c0vo): processRetirement auto-creates a
 * GroomLegacyLog when a mentor-eligible (level >= 7) groom retires.
 *
 * Pre-fix behavior: processRetirement set retired=true but never invoked
 * groomLegacyService — so the mentor-protégé relationship was dormant.
 *
 * Post-fix behavior:
 *   - level-7+ retiree + an active lower-level groom of same user
 *     → GroomLegacyLog row created with retiredGroomId, legacyGroomId, perk.
 *   - level-6 retiree → no GroomLegacyLog (below threshold).
 *   - level-7+ retiree with no active siblings → no row (deferred, logged).
 *
 * Owner rulings 2026-10-28 (q229, q244; Equoria-2xxvd): grooms carry no 1-10 level, the
 * threshold is the equivalent star level (Advanced), and the mentoring level is the old
 * level 1 (staffCareerStarLevel) for every groom, so no retirement creates a legacy log
 * for now. Old contract: a level-8 retiree with an active sibling got one.
 *
 * Real DB, no mocks.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { processRetirement, RETIREMENT_REASONS } from '../services/groomRetirementService.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const TAG = `c0vo-${randomBytes(4).toString('hex')}`;

describe('Equoria-c0vo: processRetirement auto-creates GroomLegacyLog for level-7+ mentors', () => {
  let user;
  const cleanup = createCleanupTracker();

  beforeEach(async () => {
    user = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `${TAG}-${randomBytes(2).toString('hex')}@test.com`,
        username: `${TAG}-${randomBytes(2).toString('hex')}`,
        password: 'irrelevant',
        firstName: 'Test',
        lastName: 'C0VO',
        money: 5000,
      },
    });

    // Scoped, fail-loud cleanup (Equoria-1ohys): a failed delete must fail the
    // suite, not be hidden by a swallowed catch arm. FK order — groomLegacyLog
    // children (Cascade on groomId, but the row references retiredGroom via the
    // user-scoped where) first, then grooms (Groom.userId is Restrict so they
    // must go before the user), then the user. run() drains the queue each cycle.
    const uid = user.id;
    cleanup.add(
      () => prisma.groomLegacyLog.deleteMany({ where: { retiredGroom: { userId: uid } } }),
      `groomLegacyLog:${uid}`,
    );
    // Equoria-m9lz1: processRetirement now also writes a `groomRetired`
    // Notification (in the same transaction as the retirement) and a
    // GroomRetirementSchedule row may exist for these grooms. Both are Cascade
    // children, but they are deleted explicitly and narrowly so a leak fails
    // loudly here instead of surfacing as a mystery row later. Schedules go
    // before grooms; notifications before the user.
    cleanup.add(
      () => prisma.groomRetirementSchedule.deleteMany({ where: { groom: { userId: uid } } }),
      `groomRetirementSchedule:${uid}`,
    );
    cleanup.add(() => prisma.groom.deleteMany({ where: { userId: uid } }), `groom:${uid}`);
    cleanup.add(() => prisma.notification.deleteMany({ where: { userId: uid } }), `notification:${uid}`);
    cleanup.add(() => prisma.user.delete({ where: { id: uid } }), `user:${uid}`);
  });

  afterEach(() => cleanup.run());

  it('an Expert groom retiring with an active sibling creates no GroomLegacyLog for now (q244)', async () => {
    const mentor = await prisma.groom.create({
      data: {
        name: `${TAG}-Mentor`,
        userId: user.id,
        speciality: 'foalCare',
        skillLevel: 'expert',
        starLevel: 'expert',
        personality: 'calm',
        experience: 5000,
        sessionRate: 25,
        isActive: true,
      },
    });

    const protege = await prisma.groom.create({
      data: {
        name: `${TAG}-Protege`,
        userId: user.id,
        speciality: 'foalCare',
        skillLevel: 'novice',
        personality: 'patient',
        experience: 50,
        sessionRate: 10,
        isActive: true,
      },
    });

    // Sanity: no legacy log exists before retirement.
    const preLogs = await prisma.groomLegacyLog.count({
      where: { retiredGroomId: mentor.id },
    });
    expect(preLogs).toBe(0);

    const result = await processRetirement(mentor.id, RETIREMENT_REASONS.VOLUNTARY, true);
    expect(result.legacyLog).toBeNull();

    expect(await prisma.groomLegacyLog.count({ where: { retiredGroomId: mentor.id } })).toBe(0);
    expect(await prisma.groomLegacyLog.count({ where: { legacyGroomId: protege.id } })).toBe(0);
    // The retirement itself happened.
    const retired = await prisma.groom.findUnique({ where: { id: mentor.id }, select: { retired: true } });
    expect(retired).toEqual({ retired: true });
  }, 30000);

  it('does NOT create GroomLegacyLog when retiree is below level 7', async () => {
    const lowMentor = await prisma.groom.create({
      data: {
        name: `${TAG}-LowMentor`,
        userId: user.id,
        speciality: 'foalCare',
        skillLevel: 'intermediate',
        personality: 'calm',
        experience: 1500,
        sessionRate: 20,
        isActive: true,
      },
    });

    await prisma.groom.create({
      data: {
        name: `${TAG}-LowProtege`,
        userId: user.id,
        speciality: 'foalCare',
        skillLevel: 'novice',
        personality: 'patient',
        experience: 50,
        sessionRate: 10,
        isActive: true,
      },
    });

    const result = await processRetirement(lowMentor.id, RETIREMENT_REASONS.VOLUNTARY, true);
    expect(result.legacyLog).toBeNull();

    const legacyRow = await prisma.groomLegacyLog.findFirst({
      where: { retiredGroomId: lowMentor.id },
    });
    expect(legacyRow).toBeNull();
  }, 30000);

  it('does NOT create GroomLegacyLog when no eligible protégé exists', async () => {
    // Only the mentor groom — no other active grooms for this user.
    const soloMentor = await prisma.groom.create({
      data: {
        name: `${TAG}-SoloMentor`,
        userId: user.id,
        speciality: 'foalCare',
        skillLevel: 'expert',
        personality: 'energetic',
        experience: 5000,
        sessionRate: 30,
        isActive: true,
      },
    });

    const result = await processRetirement(soloMentor.id, RETIREMENT_REASONS.VOLUNTARY, true);
    expect(result.legacyLog).toBeNull();

    const legacyRow = await prisma.groomLegacyLog.findFirst({
      where: { retiredGroomId: soloMentor.id },
    });
    expect(legacyRow).toBeNull();
  }, 30000);

  /**
   * Equoria-m9lz1 fix round 3, finding 2 — `userId: null` is not a matching key.
   *
   * `Groom.userId` is `String?`. The protégé query filters
   * `userId: retiredGroom.userId`, and in Prisma that compiles to
   * `WHERE "userId" IS NULL` when the value is null — so an OWNERLESS mentor
   * matched ANY ownerless groom in the database and the game paired two grooms
   * who have nothing to do with each other (and nothing to do with any player)
   * as mentor and protégé. There were 62 ownerless non-retired grooms in the
   * local database when this was written, so the pre-fix query had 62 candidates
   * to choose from and would have picked the lowest-level one, not the fixture
   * below.
   *
   * The code was MOVED here rather than written here, so this was latent — but
   * this branch made ownerless retirement a supported path (processRetirement
   * now falls back to the ended assignments' owners for the notification), so it
   * became reachable.
   *
   * WHY THIS ASSERTION DETECTS THE OLD DEFECT: it asserts no legacy log exists
   * for the mentor AT ALL, which is a claim about the database rather than about
   * the fixture pair. Pre-fix the mentor is paired with SOMETHING — the fixture
   * sibling if it is the lowest-level ownerless groom, otherwise some unrelated
   * ownerless row — and either way a `GroomLegacyLog` row for this mentor exists
   * and the assertion fails. Verified RED against the pre-fix service.
   */
  it('does NOT pair two OWNERLESS grooms as mentor and protégé', async () => {
    // Ownerless grooms exist in this database (marketplace stock that no player
    // has hired). Both of these are ownerless, mutually unrelated, and neither
    // belongs to `user`.

    // Narrow, id-scoped cleanup: these rows are NOT reachable from `user`, so
    // the userId-scoped entries registered in beforeEach cannot reclaim them.
    // Registered before the creates (Equoria-bfqna); each id is pushed as its groom is
    // created and the list is read when the cleanup runs, so a throw on the second
    // create still reclaims the first. FK order: any legacy log first, then the
    // schedules, then the grooms.
    const ownerlessIds = [];
    cleanup.add(
      () => prisma.groomLegacyLog.deleteMany({ where: { retiredGroomId: { in: ownerlessIds } } }),
      'groomLegacyLog:ownerless',
    );
    cleanup.add(
      () => prisma.groomRetirementSchedule.deleteMany({ where: { groomId: { in: ownerlessIds } } }),
      'groomRetirementSchedule:ownerless',
    );
    cleanup.add(() => prisma.groom.deleteMany({ where: { id: { in: ownerlessIds } } }), 'groom:ownerless');

    const ownerlessMentor = await prisma.groom.create({
      data: {
        name: `${TAG}-OwnerlessMentor`,
        userId: null,
        speciality: 'foalCare',
        skillLevel: 'expert',
        personality: 'calm',
        experience: 5000,
        sessionRate: 30,
        isActive: true,
      },
    });
    ownerlessIds.push(ownerlessMentor.id);
    const ownerlessStranger = await prisma.groom.create({
      data: {
        name: `${TAG}-OwnerlessStranger`,
        userId: null,
        speciality: 'foalCare',
        skillLevel: 'novice',
        personality: 'patient',
        experience: 0,
        sessionRate: 10,
        isActive: true,
      },
    });

    const result = await processRetirement(ownerlessMentor.id, RETIREMENT_REASONS.VOLUNTARY, true);

    // Since q244 no groom clears the mentor level, so the level guard refuses first;
    // the ownerless guard still stands behind it for when staff growth arrives.
    expect(result.legacyLog).toBeNull();
    expect(await prisma.groomLegacyLog.count({ where: { retiredGroomId: ownerlessMentor.id } })).toBe(0);
    // And specifically: the unrelated ownerless groom was not conscripted, from
    // either side of the relation.
    expect(await prisma.groomLegacyLog.count({ where: { legacyGroomId: ownerlessStranger.id } })).toBe(0);

    // The retirement itself still happened — the guard skips the legacy, not the
    // retirement.
    const retired = await prisma.groom.findUnique({
      where: { id: ownerlessMentor.id },
      select: { retired: true, isActive: true },
    });
    expect(retired).toEqual({ retired: true, isActive: false });
  }, 30000);
});
