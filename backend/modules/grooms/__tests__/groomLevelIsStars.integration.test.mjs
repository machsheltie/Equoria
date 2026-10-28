/**
 * Grooms: the star level replaces the old 1-10 level (Equoria-2xxvd).
 *
 * Owner rulings 2026-10-28:
 *   q229 - grooms show only their stars; the old 1-10 level is replaced by the star level
 *          behind the scenes too (as riders and trainers were).
 *   q244 - stars give no bonus for now: whatever read the old level reads the constant old
 *          level 1 (staffCareerLevel / staffCareerStarLevel), where every game-made groom
 *          sat. So an Expert groom opens no talent tier and mentors nobody, exactly as a
 *          level-1 groom did before.
 *   q177 - every groom the game makes for the hiring list starts as a Rookie.
 *
 * Real DB and real HTTP, no mocks, id-scoped fail-loud cleanup.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { validateTalentSelection, TALENT_REQUIREMENTS } from '../services/groomTalentService.mjs';
import {
  autoCreateLegacyOnRetirement,
  checkLegacyEligibility,
  LEGACY_CONSTANTS,
} from '../services/groomLegacyService.mjs';
import { generateRandomGroom } from '../services/groomMarketplace.mjs';

const ORIGIN = 'http://localhost:3000';
const FIXTURE_PREFIX = 'TestFixture-2xxvd';
const tag = () => randomBytes(6).toString('hex');

describe('grooms carry star levels, not the old 1-10 level (Equoria-2xxvd)', () => {
  const cleanup = createCleanupTracker();
  let user;
  let token;
  let expertGroom;
  let retiredExpert;
  let rookieOnStaff;

  beforeAll(async () => {
    const suffix = tag();
    user = await prisma.user.create({
      data: {
        username: `${FIXTURE_PREFIX}-${suffix}`,
        email: `${FIXTURE_PREFIX}-${suffix}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Stars',
        lastName: 'Only',
        money: 1000,
        settings: {},
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

    const groomData = (label, extra) => ({
      name: `${FIXTURE_PREFIX}-${label}-${tag()}`,
      speciality: 'general',
      personality: 'calm',
      userId: user.id,
      ...extra,
    });
    expertGroom = await prisma.groom.create({
      data: groomData('expert', { skillLevel: 'master', starLevel: 'expert', experience: 18 }),
    });
    retiredExpert = await prisma.groom.create({
      data: groomData('retired', {
        skillLevel: 'master',
        starLevel: 'expert',
        experience: 20,
        retired: true,
        isActive: false,
      }),
    });
    rookieOnStaff = await prisma.groom.create({
      data: groomData('rookie', { skillLevel: 'novice', starLevel: 'rookie', experience: 1 }),
    });

    const groomIds = [expertGroom.id, retiredExpert.id, rookieOnStaff.id];
    cleanup.add(
      () =>
        prisma.groomLegacyLog.deleteMany({
          where: { OR: [{ retiredGroomId: { in: groomIds } }, { legacyGroomId: { in: groomIds } }] },
        }),
      'legacy logs',
    );
    cleanup.add(() => prisma.groom.deleteMany({ where: { id: { in: groomIds } } }), 'grooms');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
  });

  afterAll(() => cleanup.run(), 60000);

  it("the player's groom list shows each groom's stars and no old level", async () => {
    const res = await request(app)
      .get(`/api/v1/grooms/user/${user.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const byId = new Map(res.body.grooms.map(g => [g.id, g]));
    expect(byId.get(expertGroom.id).starLevel).toBe('expert');
    expect(byId.get(rookieOnStaff.id).starLevel).toBe('rookie');
    for (const groom of res.body.grooms) {
      expect(groom).not.toHaveProperty('level');
    }
  });

  it('talent tiers are written as star levels equivalent to the old levels 3, 5 and 8', () => {
    expect(TALENT_REQUIREMENTS).toEqual({
      tier1: { minStarLevel: 'novice' },
      tier2: { minStarLevel: 'intermediate' },
      tier3: { minStarLevel: 'advanced' },
    });
  });

  it('stars open no talent tier for now (q244): an Expert groom is refused like a level-1 groom', async () => {
    const result = await validateTalentSelection(expertGroom.id, 'tier1', 'gentle_hands');

    expect(result).toEqual({
      valid: false,
      reason: 'insufficient_level',
      requiredStarLevel: 'novice',
    });
  });

  it('mentoring needs Advanced, and stars give no mentoring for now (q244)', async () => {
    expect(LEGACY_CONSTANTS.MINIMUM_MENTOR_STAR_LEVEL).toBe('advanced');
    expect(LEGACY_CONSTANTS).not.toHaveProperty('PROTEGE_LEVEL_BONUS');

    const eligibility = await checkLegacyEligibility(retiredExpert.id);
    expect(eligibility).toEqual({
      eligible: false,
      reason: 'insufficient_level',
      starLevel: 'expert',
      requiredStarLevel: 'advanced',
    });

    const retiredRow = await prisma.groom.findUnique({ where: { id: retiredExpert.id } });
    expect(retiredRow).not.toHaveProperty('level');
    await expect(autoCreateLegacyOnRetirement(retiredRow)).resolves.toBeNull();
    await expect(prisma.groomLegacyLog.count({ where: { retiredGroomId: retiredExpert.id } })).resolves.toBe(0);
  });

  it('every groom the game makes for the hiring list is a Rookie priced at 100 (q177)', () => {
    for (let i = 0; i < 200; i += 1) {
      const offer = generateRandomGroom();
      expect(offer.starLevel).toBe('rookie');
      expect(offer.weeklyFee).toBe(100);
      expect(offer.skillLevel).toBe('novice');
      expect(offer.experience).toBeGreaterThanOrEqual(1);
      expect(offer.experience).toBeLessThanOrEqual(2);
    }
  });
});
