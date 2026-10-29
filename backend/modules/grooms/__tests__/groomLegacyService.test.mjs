/**
 * groomLegacyService branch-coverage tests (Equoria-jkht coverage sprint).
 *
 * Pure-function tests (no DB):
 *   getLegacyPerks — known personalities (calm/energetic/methodical) + unknown → []
 *
 * DB-fixture branch coverage (checkLegacyEligibility):
 *   non-existent groomId → groomNotFound
 *   active groom (not retired) → notRetired
 *   retired, existing legacy → legacyAlreadyCreated
 *   retired, no legacy, any stars → insufficientLevel
 *
 * Owner rulings 2026-10-28 (q229, q244; Equoria-2xxvd): the old 1-10 level is gone and
 * the mentoring level is the old level 1 (staffCareerStarLevel) for every groom, below
 * MINIMUM_MENTOR_STAR_LEVEL (Advanced, the old 7), so no groom mentors for now. Old
 * contract: a retired level-8 groom was eligible and generated a protégé.
 *
 * generateLegacyProtege:
 *   mentor at Expert stars → throws insufficientLevel, creates nothing
 *   ineligible mentor (not retired) → throws
 *
 * buildProtegeGroomData (Equoria-ixya8): a protégé is stored as a Rookie with no
 * experience, whatever skill word the request carries. Owner rulings: staff never gain
 * XP (2026-10-21) and every groom starts as a Rookie (q177). Old contract:
 * LEGACY_CONSTANTS.PROTEGE_EXPERIENCE_BONUS = 50 was written to the protégé's
 * experience and fed its star level.
 *
 * Player-facing perks (Equoria-gghoi): the backend table is the only perk table; the
 * frontend reads authored names/descriptions from these responses, never effect codes.
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
  buildProtegeGroomData,
  getPlayerLegacyPerks,
  findPlayerLegacyPerk,
} from '../services/groomLegacyService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

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
    const perks = getLegacyPerks('unknownPersonality');
    expect(perks).toEqual([]);
  });

  it('LEGACY_CONSTANTS and LEGACY_PERKS exports are correctly shaped', () => {
    expect(LEGACY_CONSTANTS.MINIMUM_MENTOR_STAR_LEVEL).toBe('advanced');
    // Equoria-ixya8 (owner-changed behaviour, see header): no protégé experience bonus.
    expect(LEGACY_CONSTANTS).not.toHaveProperty('PROTEGE_EXPERIENCE_BONUS');
    expect(LEGACY_CONSTANTS).not.toHaveProperty('PROTEGE_LEVEL_BONUS');
    expect(typeof LEGACY_CONSTANTS.PROTEGE_SKILL_BONUS).toBe('number');
    expect(LEGACY_PERKS.calm).toHaveLength(3);
    expect(LEGACY_PERKS.energetic).toHaveLength(3);
    expect(LEGACY_PERKS.methodical).toHaveLength(3);
  });
});

// ── player-facing legacy perks (Equoria-gghoi) ───────────────────────────────

describe('player-facing legacy perks (Equoria-gghoi)', () => {
  it('getPlayerLegacyPerks gives the backend perks with authored labels only, no effect codes', () => {
    const perks = getPlayerLegacyPerks('methodical');
    expect(perks.map(p => p.id)).toEqual(['dataDriven', 'memoryBuilder', 'precisionTraining']);
    perks.forEach(perk => {
      expect(Object.keys(perk).sort()).toEqual(['description', 'id', 'name']);
      expect(perk.name).toBeTruthy();
      expect(perk.description).toBeTruthy();
    });
  });

  it('getPlayerLegacyPerks gives nothing for personalities the backend does not define', () => {
    expect(getPlayerLegacyPerks('playful')).toEqual([]);
    expect(getPlayerLegacyPerks('strict')).toEqual([]);
  });

  it('findPlayerLegacyPerk names a granted perk and refuses one the game never grants', () => {
    expect(findPlayerLegacyPerk('memoryBuilder')).toEqual({
      id: 'memoryBuilder',
      name: 'Memory Builder',
      description: 'Exceptional at building horse-groom synergy',
    });
    expect(findPlayerLegacyPerk('routineMastery')).toBeNull();
  });
});

// ── checkLegacyEligibility — non-existent groom ───────────────────────────────

describe('checkLegacyEligibility — non-existent groom', () => {
  it('returns groomNotFound for non-existent groomId', async () => {
    const result = await checkLegacyEligibility(999999999);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('groomNotFound');
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
  let glsGroomActive; // not retired → notRetired
  let glsGroomLowLevel; // retired, Rookie → insufficientLevel
  let glsGroomEligible; // retired, Expert → still insufficientLevel (q244)
  let glsGroomHasLegacy; // retired, existing legacy → legacyAlreadyCreated
  let glsProtegeStub; // stub groom as legacyGroomId for pre-created legacy log
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    glsUser = await prisma.user.create({
      data: {
        emailVerified: true,
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
        userId: glsUser.id,
      },
    });

    glsGroomLowLevel = await prisma.groom.create({
      data: {
        name: `TestFixture-GLS-LowLevel-${ts}`,
        speciality: 'general',
        personality: 'calm',
        retired: true,
        userId: glsUser.id,
      },
    });

    glsGroomEligible = await prisma.groom.create({
      data: {
        name: `TestFixture-GLS-Eligible-${ts}`,
        speciality: 'general',
        personality: 'methodical',
        retired: true,
        experience: 200,
        starLevel: 'expert',
        userId: glsUser.id,
      },
    });

    glsGroomHasLegacy = await prisma.groom.create({
      data: {
        name: `TestFixture-GLS-HasLegacy-${ts}`,
        speciality: 'general',
        personality: 'energetic',
        retired: true,
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

    // Pre-create a legacy log so glsGroomHasLegacy hits the 'legacyAlreadyCreated' branch
    await prisma.groomLegacyLog.create({
      data: {
        retiredGroomId: glsGroomHasLegacy.id,
        legacyGroomId: glsProtegeStub.id,
        inheritedPerk: 'playtimePro',
      },
    });

    // Scoped, fail-loud cleanup (Equoria-1ohys): swallowed catch arms replaced
    // by the tracker so a failed delete fails the suite instead of leaking a
    // fixture into the canonical DB. Name-prefix scoping ('TestFixture-GLS-')
    // preserved exactly. FK order — groomLegacyLog rows (both the retiredGroom
    // and legacyGroom relations are scoped to the prefix) before grooms
    // (Groom.userId is Restrict), then the user last.
    cleanup.add(
      () =>
        prisma.groomLegacyLog.deleteMany({
          where: { retiredGroom: { name: { startsWith: 'TestFixture-GLS-' } } },
        }),
      'groomLegacyLog:retiredGroom',
    );
    cleanup.add(
      () =>
        prisma.groomLegacyLog.deleteMany({
          where: { legacyGroom: { name: { startsWith: 'TestFixture-GLS-' } } },
        }),
      'groomLegacyLog:legacyGroom',
    );
    cleanup.add(() => prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-GLS-' } } }), 'groom');
    cleanup.add(() => prisma.user.delete({ where: { id: glsUser?.id } }), 'user');
  }, 60000);

  afterAll(() => cleanup.run(), 30000);

  it('checkLegacyEligibility: active groom (not retired) → notRetired', async () => {
    const result = await checkLegacyEligibility(glsGroomActive.id);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('notRetired');
    expect(result.starLevel).toBe('rookie');
  });

  it('checkLegacyEligibility: retired Rookie → insufficientLevel', async () => {
    const result = await checkLegacyEligibility(glsGroomLowLevel.id);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('insufficientLevel');
    expect(result.starLevel).toBe('rookie');
    expect(result.requiredStarLevel).toBe(LEGACY_CONSTANTS.MINIMUM_MENTOR_STAR_LEVEL);
  });

  it('checkLegacyEligibility: existing legacy → legacyAlreadyCreated', async () => {
    const result = await checkLegacyEligibility(glsGroomHasLegacy.id);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('legacyAlreadyCreated');
    expect(typeof result.existingLegacyId).toBe('number');
  });

  it('checkLegacyEligibility: retired Expert, no legacy → insufficientLevel (q244)', async () => {
    const result = await checkLegacyEligibility(glsGroomEligible.id);
    expect(result).toEqual({
      eligible: false,
      reason: 'insufficientLevel',
      starLevel: 'expert',
      requiredStarLevel: 'advanced',
    });
  });

  it('generateLegacyProtege: an Expert mentor is refused and nothing is created (q244)', async () => {
    const protegeData = {
      name: `TestFixture-GLS-Protege-${Date.now()}`,
      personality: 'calm',
      skillLevel: 'novice',
      speciality: 'general',
    };
    await expect(generateLegacyProtege(glsGroomEligible.id, protegeData, glsUser.id)).rejects.toThrow(
      'insufficientLevel',
    );
    await expect(prisma.groom.count({ where: { name: protegeData.name } })).resolves.toBe(0);
    await expect(prisma.groomLegacyLog.count({ where: { retiredGroomId: glsGroomEligible.id } })).resolves.toBe(0);
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

  it('buildProtegeGroomData: an expert-worded protégé is stored as a Rookie with no experience (Equoria-ixya8)', async () => {
    const perk = getLegacyPerks('methodical')[0];
    const data = buildProtegeGroomData(
      {
        name: `TestFixture-GLS-ProtegeRookie-${Date.now()}`,
        personality: 'calm',
        skillLevel: 'expert',
        speciality: 'general',
      },
      glsGroomEligible,
      perk,
      glsUser.id,
    );
    expect(data.starLevel).toBe('rookie');
    expect(data.experience).toBe(0);
    expect(data.bonusTraitMap.legacyPerk).toBe(perk.id);

    // The row the game would create, written to the real database.
    const stored = await prisma.groom.create({ data });
    expect(stored.starLevel).toBe('rookie');
    expect(stored.experience).toBe(0);
  });

  it('getUserLegacyHistory: returns entries after generating protégé', async () => {
    const history = await getUserLegacyHistory(glsUser.id);
    // At minimum: the pre-created legacy for glsGroomHasLegacy
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThanOrEqual(1);
    const firstEntry = history[0];
    expect(typeof firstEntry.retiredGroomId).toBe('number');
    expect(typeof firstEntry.protegeGroomId).toBe('number');
    expect(typeof firstEntry.inheritedPerk).toBe('string');
    // q229: the history names each groom's stars, never an old level.
    expect(firstEntry.retiredGroomStarLevel).toBe('rookie');
    expect(firstEntry).not.toHaveProperty('mentorLevel');
  });

  it('getUserLegacyHistory: names the inherited perk with its authored label (Equoria-gghoi)', async () => {
    const history = await getUserLegacyHistory(glsUser.id);
    const entry = history.find(h => h.retiredGroomId === glsGroomHasLegacy.id);
    expect(entry.inheritedPerk).toBe('playtimePro');
    expect(entry.inheritedPerkDetail).toEqual({
      id: 'playtimePro',
      name: 'Playtime Pro',
      description: 'Expert at engaging horses through play',
    });
  });
});
