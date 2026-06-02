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
 * Real DB, no mocks.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { processRetirement, RETIREMENT_REASONS } from '../services/groomRetirementService.mjs';
import { LEGACY_PERKS } from '../services/groomLegacyService.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const TAG = `c0vo-${randomBytes(4).toString('hex')}`;

describe('Equoria-c0vo: processRetirement auto-creates GroomLegacyLog for level-7+ mentors', () => {
  let user;
  const cleanup = createCleanupTracker();

  beforeEach(async () => {
    user = await prisma.user.create({
      data: {
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
    cleanup.add(() => prisma.groom.deleteMany({ where: { userId: uid } }), `groom:${uid}`);
    cleanup.add(() => prisma.user.delete({ where: { id: uid } }), `user:${uid}`);
  });

  afterEach(() => cleanup.run());

  it('creates GroomLegacyLog when a level-7+ groom retires with an active lower-level sibling', async () => {
    const mentor = await prisma.groom.create({
      data: {
        name: `${TAG}-Mentor`,
        userId: user.id,
        speciality: 'foal_care',
        skillLevel: 'expert',
        personality: 'calm',
        experience: 5000,
        level: 8,
        sessionRate: 25,
        isActive: true,
      },
    });

    const protege = await prisma.groom.create({
      data: {
        name: `${TAG}-Protege`,
        userId: user.id,
        speciality: 'foal_care',
        skillLevel: 'novice',
        personality: 'patient',
        experience: 50,
        level: 1,
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
    expect(result.legacyLog).not.toBeNull();

    const legacyRow = await prisma.groomLegacyLog.findFirst({
      where: { retiredGroomId: mentor.id },
    });
    expect(legacyRow).not.toBeNull();
    expect(legacyRow.legacyGroomId).toBe(protege.id);
    expect(legacyRow.mentorLevel).toBe(8);
    const calmPerkIds = LEGACY_PERKS.calm.map(p => p.id);
    expect(calmPerkIds).toContain(legacyRow.inheritedPerk);
  }, 30000);

  it('does NOT create GroomLegacyLog when retiree is below level 7', async () => {
    const lowMentor = await prisma.groom.create({
      data: {
        name: `${TAG}-LowMentor`,
        userId: user.id,
        speciality: 'foal_care',
        skillLevel: 'intermediate',
        personality: 'calm',
        experience: 1500,
        level: 6,
        sessionRate: 20,
        isActive: true,
      },
    });

    await prisma.groom.create({
      data: {
        name: `${TAG}-LowProtege`,
        userId: user.id,
        speciality: 'foal_care',
        skillLevel: 'novice',
        personality: 'patient',
        experience: 50,
        level: 1,
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
        speciality: 'foal_care',
        skillLevel: 'expert',
        personality: 'energetic',
        experience: 5000,
        level: 9,
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
});
