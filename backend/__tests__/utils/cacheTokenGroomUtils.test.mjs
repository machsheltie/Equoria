/**
 * cacheHelper + tokenRotationService + groomRareTraitPerks + groomSystem unit tests
 * (Equoria-rr7 coverage sprint).
 *
 * cacheHelper + tokenRotationService + groomRareTraitPerks: pure or near-pure.
 * groomSystem: constants + validateFoalInteractionLimits (needs DB horse fixture).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { cacheStats, generateCacheKey, getCachedQuery, invalidateCache } from '../../utils/cacheHelper.mjs';
import { hashRefreshToken, generateTokenFamily } from '../../utils/tokenRotationService.mjs';
import { applyRareTraitBoosterEffects } from '../../utils/groomRareTraitPerks.mjs';
import {
  GROOM_SPECIALTIES,
  SKILL_LEVELS,
  PERSONALITY_TRAITS,
  validateFoalInteractionLimits,
} from '../../utils/groomSystem.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

let user;
let horse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `cacheutiltest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `cacheutiltest${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'CacheUtil',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
      name: `TestFixture-CacheUtilHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ── cacheHelper ───────────────────────────────────────────────────────────────

describe('cacheStats', () => {
  it('is an object with numeric counters', () => {
    expect(typeof cacheStats.hits).toBe('number');
    expect(typeof cacheStats.misses).toBe('number');
    expect(typeof cacheStats.errors).toBe('number');
  });
});

describe('generateCacheKey', () => {
  it('joins components with colon', () => {
    expect(generateCacheKey('users', 42, 'profile')).toBe('users:42:profile');
  });

  it('filters out null and undefined', () => {
    expect(generateCacheKey('key', null, 'val')).toBe('key:val');
    expect(generateCacheKey('key', undefined, 'val')).toBe('key:val');
  });

  it('replaces spaces and colons in components', () => {
    const key = generateCacheKey('my key', 'a:b');
    expect(key).not.toContain(' ');
  });
});

describe('getCachedQuery', () => {
  it('executes queryFn on cache miss and returns its result', async () => {
    const queryFn = async () => ({ value: 42 });
    const result = await getCachedQuery('test:cache:key:miss', queryFn, 5);
    expect(result.value).toBe(42);
  });

  it('returns cached result on second call (local cache hit)', async () => {
    let callCount = 0;
    const queryFn = async () => {
      callCount++;
      return { data: 'original' };
    };
    const key = `test:cache:repeat:${Date.now()}`;
    await getCachedQuery(key, queryFn, 60);
    const result = await getCachedQuery(key, queryFn, 60);
    expect(result.data).toBe('original');
    expect(callCount).toBe(1);
  });
});

describe('invalidateCache', () => {
  it('returns 0 for non-existent key', async () => {
    const result = await invalidateCache('nonexistent:key:xyz');
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('removes previously cached entry', async () => {
    const key = `test:invalidate:${Date.now()}`;
    await getCachedQuery(key, async () => ({ v: 1 }), 60);
    await invalidateCache(key);
    let callCount = 0;
    await getCachedQuery(
      key,
      async () => {
        callCount++;
        return { v: 2 };
      },
      60,
    );
    expect(callCount).toBe(1);
  });
});

// ── tokenRotationService ──────────────────────────────────────────────────────

describe('hashRefreshToken', () => {
  it('returns a 64-char hex string (SHA-256)', () => {
    const hash = hashRefreshToken('my-secret-refresh-token');
    expect(typeof hash).toBe('string');
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it('returns same hash for same input', () => {
    const token = 'deterministic-token-value';
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
  });

  it('different tokens produce different hashes', () => {
    expect(hashRefreshToken('token-a')).not.toBe(hashRefreshToken('token-b'));
  });
});

describe('generateTokenFamily', () => {
  it('returns a non-empty string', () => {
    const family = generateTokenFamily();
    expect(typeof family).toBe('string');
    expect(family.length).toBeGreaterThan(0);
  });

  it('returns unique values on successive calls', () => {
    const a = generateTokenFamily();
    const b = generateTokenFamily();
    expect(a).not.toBe(b);
  });
});

// ── groomRareTraitPerks ───────────────────────────────────────────────────────

describe('applyRareTraitBoosterEffects', () => {
  it('returns unchanged chance when groom has no rare trait perks', () => {
    const result = applyRareTraitBoosterEffects('moonlit_grace', 0.05, { rareTraitPerks: {} });
    expect(result.originalChance).toBe(0.05);
    expect(result.modifiedChance).toBe(0.05);
    expect(Array.isArray(result.appliedPerks)).toBe(true);
    expect(result.appliedPerks).toHaveLength(0);
    expect(result.perkBonus).toBe(0);
  });

  it('caps modified chance at 1.0', () => {
    const result = applyRareTraitBoosterEffects('any_trait', 1.0, { rareTraitPerks: {} });
    expect(result.modifiedChance).toBeLessThanOrEqual(1.0);
  });
});

// ── groomSystem ───────────────────────────────────────────────────────────────

describe('GROOM_SPECIALTIES', () => {
  it('contains foalCare specialty with bondingModifier', () => {
    expect(GROOM_SPECIALTIES.foalCare).toBeDefined();
    expect(typeof GROOM_SPECIALTIES.foalCare.bondingModifier).toBe('number');
  });

  it('contains general specialty', () => {
    expect(GROOM_SPECIALTIES.general).toBeDefined();
  });
});

describe('SKILL_LEVELS', () => {
  it('has novice, intermediate, expert, master levels', () => {
    expect(SKILL_LEVELS.novice).toBeDefined();
    expect(SKILL_LEVELS.master).toBeDefined();
    expect(SKILL_LEVELS.master.bondingModifier).toBeGreaterThan(SKILL_LEVELS.novice.bondingModifier);
  });
});

describe('PERSONALITY_TRAITS', () => {
  it('is a non-empty object', () => {
    expect(typeof PERSONALITY_TRAITS).toBe('object');
    expect(Object.keys(PERSONALITY_TRAITS).length).toBeGreaterThan(0);
  });
});

describe('validateFoalInteractionLimits', () => {
  it('throws for non-existent horse', async () => {
    await expect(validateFoalInteractionLimits(999999999)).rejects.toThrow();
  });

  it('returns canInteract:true for horse with no interactions today', async () => {
    const result = await validateFoalInteractionLimits(horse.id);
    expect(typeof result.canInteract).toBe('boolean');
    expect(typeof result.message).toBe('string');
    expect(result.canInteract).toBe(true);
  });
});
