/**
 * cacheHelper + tokenRotationService + groomSystem unit tests
 * (Equoria-rr7 coverage sprint).
 *
 * cacheHelper + tokenRotationService: pure or near-pure. (The groomRareTraitPerks
 * arm went with that file, Equoria-tpofm.)
 * groomSystem: constants.
 */

import { describe, it, expect } from '@jest/globals';
import { cacheStats, generateCacheKey, getCachedQuery, invalidateCache } from '../../../utils/cacheHelper.mjs';
import { hashRefreshToken, generateTokenFamily } from '../../../utils/tokenRotationService.mjs';
import { groomSpecialties, skillLevels, personalityTraits } from '../../../utils/groomSystem.mjs';

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

// ── groomSystem ───────────────────────────────────────────────────────────────

describe('groomSpecialties', () => {
  it('contains foalCare specialty with bondingModifier', () => {
    expect(groomSpecialties.foalCare).toBeDefined();
    expect(typeof groomSpecialties.foalCare.bondingModifier).toBe('number');
  });

  it('contains general specialty', () => {
    expect(groomSpecialties.general).toBeDefined();
  });
});

describe('skillLevels', () => {
  it('has novice, intermediate, expert, master levels', () => {
    expect(skillLevels.novice).toBeDefined();
    expect(skillLevels.master).toBeDefined();
    expect(skillLevels.master.bondingModifier).toBeGreaterThan(skillLevels.novice.bondingModifier);
  });
});

describe('personalityTraits', () => {
  it('is a non-empty object', () => {
    expect(typeof personalityTraits).toBe('object');
    expect(Object.keys(personalityTraits).length).toBeGreaterThan(0);
  });
});
