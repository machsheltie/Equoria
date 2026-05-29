/**
 * groomLegacyService branch-coverage tests (Equoria-jkht coverage sprint).
 *
 * Pure-function tests (no DB):
 *   getLegacyPerks — known personalities (calm/energetic/methodical) + unknown → []
 *
 * DB-fixture branch coverage (checkLegacyEligibility):
 *   non-existent groomId → groom_not_found
 *   active groom (not retired) → not_retired
 *   retired, level < MINIMUM_MENTOR_LEVEL (7) → insufficient_level
 *   retired, level >= 7, existing legacy → legacy_already_created
 *   retired, level >= 7, no legacy → eligible: true
 *
 * generateLegacyProtege:
 *   eligible mentor → creates protégé + legacyLog + returns inherited perk
 *   ineligible mentor (not retired) → throws
 *
 * getUserLegacyHistory:
 *   non-existent userId → []
 *   after generating protégé → returns entry
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  LEGACY_CONSTANTS,
  LEGACY_PERKS,
  getLegacyPerks,
  checkLegacyEligibility,
  generateLegacyProtege,
  getUserLegacyHistory,
} from '../services/groomLegacyService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

// ── getLegacyPerks — pure function ────────────────────────────────────────────

describe('getLegacyPerks — pure function', () => {
  it('returns perks array for calm personality', () => {
    const perks = getLegacyPerks('calm');
    expect(Array.isArray(perks)).toBe(true);
    expect(perks.length).toBeGreaterThan(0);
    expect(perks[0]).toHaveProperty('id');
    expect(perks[0]).toHaveProperty('effect');
  });

  it('returns perks array for energetic personality', () => {
    const perks = getLegacyPerks('energetic');
    expect(perks.length).toBeGreaterThan(0);
  });

  it('returns perks array for methodical personality', () => {
    const perks = getLegacyPerks('methodical');
    expect(perks.length).toBeGreaterThan(0);
  });

  it('returns empty array for unknown personality (|| [] fallback branch)', () => {
    const perks = getLegacyPerks('unknown_personality');
    expect(perks).toEqual([]);
  });

  it('LEGACY_CONSTANTS and LEGACY_PERKS exports are correctly shaped', () => {
    expect(LEGACY_CONSTANTS.MINIMUM_MENTOR_LEVEL).toBe(7);
    expect(LEGACY_CONSTANTS.PROTEGE_EXPERIENCE_BONUS).toBe(50);
    expect(LEGACY_CONSTANTS.PROTEGE_LEVEL_BONUS).toBe(1);
    expect(typeof LEGACY_CONSTANTS.PROTEGE_SKILL_BONUS).toBe('number');
    expect(LEGACY_PERKS.calm).toHaveLength(3);
    expect(LEGACY_PERKS.energetic).toHaveLength(3);
    expect(LEGACY_PERKS.methodical).toHaveLength(3);
  });
});

// ── checkLegacyEligibility — non-existent groom ───────────────────────────────

describe('checkLegacyEligibility — non-existent groom', () => {
  it('returns groom_not_found for non-existent groomId', async () => {
    const result = await checkLegacyEligibility(999999999);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('groom_not_found');
  });
});

// ── getUserLegacyHistory — non-existent user ──────────────────────────────────

describe('getUserLegacyHistory — non-existent user', () => {
  it('returns empty array for user with no legacy relationships', async () => {
    const result = await getUserLegacyHistory('00000000-0000-0000-0000-000000000099');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });
});

// ── DB fixture branch coverage ────────────────────────────────────────────────

describe('groomLegacyService — DB fixture branch coverage (Equoria-jkht)', () => {
  let glsUser;
  let glsGroomActive; // not retired → not_retired
  let glsGroomLowLevel; // retired, level=3 → insufficient_level
  let glsGroomEligible; // retired, level=8 → eligible + used for generateLegacyProtege
  let glsGroomHasLegacy; // retired, level=8, existing legacy → legacy_already_created
  let glsProtegeStub; // stub groom as legacyGroomId for pre-created legacy log

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    glsUser = await prisma.user.create({
      data: {
        email: `gls-${ts}-${rand()}@test.com`,
        username: `gls${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'GLS',
        lastName: 'Tester',
        money: 1000,
      },
    });

    glsGroomActive = await prisma.groom.create({
      data: {
        name: `TestFixture-GLS-Active-${ts}`,
        speciality: 'general',
        personality: 'calm',
        retired: false,
        level: 8,
        userId: glsUser.id,
      },
    });

    glsGroomLowLevel = await prisma.groom.create({
      data: {
        name: `TestFixture-GLS-LowLevel-${ts}`,
        speciality: 'general',
        personality: 'calm',
        retired: true,
        level: 3,
        userId: glsUser.id,
      },
    });

    glsGroomEligible = await prisma.groom.create({
      data: {
        name: `TestFixture-GLS-Eligible-${ts}`,
        speciality: 'general',
        personality: 'methodical',
        retired: true,
        level: 8,
        experience: 200,
        userId: glsUser.id,
      },
    });

    glsGroomHasLegacy = await prisma.groom.create({
      data: {
        name: `TestFixture-GLS-HasLegacy-${ts}`,
        speciality: 'general',
        personality: 'energetic',
        retired: true,
        level: 9,
        userId: glsUser.id,
      },
    });

    // Stub protégé groom — only needed as legacyGroomId reference
    glsProtegeStub = await prisma.groom.create({
      data: {
        name: `TestFixture-GLS-ProtegeStub-${ts}`,
        speciality: 'general',
        personality: 'calm',
        userId: glsUser.id,
      },
    });

    // Pre-create a legacy log so glsGroomHasLegacy hits the 'legacy_already_created' branch
    await prisma.groomLegacyLog.create({
      data: {
        retiredGroomId: glsGroomHasLegacy.id,
        legacyGroomId: glsProtegeStub.id,
        inheritedPerk: 'playtime_pro',
        mentorLevel: glsGroomHasLegacy.level,
      },
    });
  }, 60000);

  afterAll(async () => {
    await prisma.groomLegacyLog
      .deleteMany({
        where: {
          retiredGroom: { name: { startsWith: 'TestFixture-GLS-' } },
        },
      })
      .catch(() => {});
    // Also delete any protégé grooms generated during the test
    await prisma.groomLegacyLog
      .deleteMany({
        where: {
          legacyGroom: { name: { startsWith: 'TestFixture-GLS-' } },
        },
      })
      .catch(() => {});
    await prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-GLS-' } } }).catch(() => {});
    await prisma.user.delete({ where: { id: glsUser?.id } }).catch(() => {});
  }, 30000);

  it('checkLegacyEligibility: active groom (not retired) → not_retired', async () => {
    const result = await checkLegacyEligibility(glsGroomActive.id);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('not_retired');
    expect(result.level).toBe(8);
  });

  it('checkLegacyEligibility: retired, level=3 < 7 → insufficient_level', async () => {
    const result = await checkLegacyEligibility(glsGroomLowLevel.id);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('insufficient_level');
    expect(result.level).toBe(3);
    expect(result.requiredLevel).toBe(LEGACY_CONSTANTS.MINIMUM_MENTOR_LEVEL);
  });

  it('checkLegacyEligibility: existing legacy → legacy_already_created', async () => {
    const result = await checkLegacyEligibility(glsGroomHasLegacy.id);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('legacy_already_created');
    expect(typeof result.existingLegacyId).toBe('number');
  });

  it('checkLegacyEligibility: retired, level=8, no legacy → eligible: true', async () => {
    const result = await checkLegacyEligibility(glsGroomEligible.id);
    expect(result.eligible).toBe(true);
    expect(result.level).toBe(8);
    expect(result.personality).toBe('methodical');
    expect(Array.isArray(result.availablePerks)).toBe(true);
    expect(result.availablePerks.length).toBeGreaterThan(0);
  });

  it('generateLegacyProtege: creates protégé and legacyLog for eligible mentor', async () => {
    const protegeData = {
      name: `TestFixture-GLS-Protege-${Date.now()}`,
      personality: 'calm',
      skillLevel: 'novice',
      speciality: 'general',
    };
    const result = await generateLegacyProtege(glsGroomEligible.id, protegeData, glsUser.id);
    expect(result.protege).toBeDefined();
    expect(result.protege.name).toBe(protegeData.name);
    expect(result.protege.experience).toBe(LEGACY_CONSTANTS.PROTEGE_EXPERIENCE_BONUS);
    expect(result.protege.level).toBe(1 + LEGACY_CONSTANTS.PROTEGE_LEVEL_BONUS);
    expect(result.legacyLog).toBeDefined();
    expect(result.legacyLog.retiredGroomId).toBe(glsGroomEligible.id);
    expect(result.inheritedPerk).toBeDefined();
    expect(typeof result.inheritedPerk.id).toBe('string');
  });

  it('generateLegacyProtege: ineligible mentor (not retired) → throws', async () => {
    const protegeData = {
      name: `TestFixture-GLS-ProtegeX-${Date.now()}`,
      personality: 'calm',
      skillLevel: 'novice',
      speciality: 'general',
    };
    await expect(generateLegacyProtege(glsGroomActive.id, protegeData, glsUser.id)).rejects.toThrow(
      'not eligible for legacy creation',
    );
  });

  it('getUserLegacyHistory: returns entries after generating protégé', async () => {
    const history = await getUserLegacyHistory(glsUser.id);
    // At minimum: the pre-created legacy for glsGroomHasLegacy + the protégé generated above
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThanOrEqual(1);
    const firstEntry = history[0];
    expect(typeof firstEntry.retiredGroomId).toBe('number');
    expect(typeof firstEntry.protegeGroomId).toBe('number');
    expect(typeof firstEntry.inheritedPerk).toBe('string');
  });
});
