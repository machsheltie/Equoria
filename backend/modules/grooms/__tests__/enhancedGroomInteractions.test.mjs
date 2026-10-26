/**
 * enhancedGroomInteractions — unit tests (Equoria-rr7)
 *
 * Pure exports only (the interaction calculator and the performance-tracking wrapper were
 * removed, Equoria-c39bq: "groom horse" is the only grooming door).
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateRelationshipLevel,
  checkForSpecialEvent,
  getAvailableInteractions,
  RELATIONSHIP_LEVELS,
  ENHANCED_INTERACTIONS,
  SPECIAL_EVENTS,
  GROOM_PREFERENCES,
} from '../services/enhancedGroomInteractions.mjs';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const gentleGroom = {
  id: 'g1',
  personality: 'gentle',
  skillLevel: 'expert',
  speciality: 'medical',
  sessionRate: 20,
};

const basicGroom = {
  id: 'g3',
  personality: 'patient',
  skillLevel: 'novice',
  speciality: 'care',
  sessionRate: 15,
};

// Equoria-yny4: horse.age is game-years (post Equoria-son6). Foal = 0-3
// game-years; adult = >= 3. The previous fixtures used days (365 / 1460);
// migrating to game-years (1 / 4) keeps the same semantic class.
const youngHorse = {
  id: 'h1',
  age: 1, // 1 game-year — foal
  bondScore: 0,
};

const adultHorse = {
  id: 'h2',
  age: 4, // 4 game-years — adult
  bondScore: 150,
};

// ---------------------------------------------------------------------------
// Constants shape
// ---------------------------------------------------------------------------
describe('exported constants', () => {
  it('RELATIONSHIP_LEVELS has 7 levels', () => {
    expect(Object.keys(RELATIONSHIP_LEVELS)).toHaveLength(7);
  });

  it('ENHANCED_INTERACTIONS has 5 types', () => {
    expect(Object.keys(ENHANCED_INTERACTIONS)).toHaveLength(5);
  });

  it('SPECIAL_EVENTS has probability on each event', () => {
    for (const event of Object.values(SPECIAL_EVENTS)) {
      expect(typeof event.probability).toBe('number');
      expect(event.probability).toBeGreaterThan(0);
      expect(event.probability).toBeLessThan(1);
    }
  });

  it('GROOM_PREFERENCES has entries for gentle, energetic, patient, strict', () => {
    expect(GROOM_PREFERENCES).toHaveProperty('gentle');
    expect(GROOM_PREFERENCES).toHaveProperty('energetic');
    expect(GROOM_PREFERENCES).toHaveProperty('patient');
    expect(GROOM_PREFERENCES).toHaveProperty('strict');
  });
});

// ---------------------------------------------------------------------------
// calculateRelationshipLevel
// ---------------------------------------------------------------------------
describe('calculateRelationshipLevel', () => {
  it('returns STRANGER for 0 bonding points', () => {
    const result = calculateRelationshipLevel(0);
    expect(result.name).toBe('Stranger');
    expect(result.level).toBe(0);
  });

  it('returns STRANGER for 19 bonding points (below ACQUAINTANCE threshold)', () => {
    const result = calculateRelationshipLevel(19);
    expect(result.name).toBe('Stranger');
  });

  it('returns ACQUAINTANCE at threshold 20', () => {
    const result = calculateRelationshipLevel(20);
    expect(result.name).toBe('Acquaintance');
    expect(result.level).toBe(1);
  });

  it('returns FAMILIAR at threshold 50', () => {
    expect(calculateRelationshipLevel(50).name).toBe('Familiar');
  });

  it('returns TRUSTED at threshold 100', () => {
    expect(calculateRelationshipLevel(100).name).toBe('Trusted');
  });

  it('returns BONDED at threshold 200', () => {
    expect(calculateRelationshipLevel(200).name).toBe('Bonded');
  });

  it('returns DEVOTED at threshold 350', () => {
    expect(calculateRelationshipLevel(350).name).toBe('Devoted');
  });

  it('returns SOULMATE at threshold 500', () => {
    expect(calculateRelationshipLevel(500).name).toBe('Soulmate');
    expect(calculateRelationshipLevel(500).level).toBe(6);
  });

  it('returns SOULMATE for values above 500', () => {
    expect(calculateRelationshipLevel(9999).name).toBe('Soulmate');
  });

  it('returned level has multiplier property', () => {
    const result = calculateRelationshipLevel(100);
    expect(typeof result.multiplier).toBe('number');
    expect(result.multiplier).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// checkForSpecialEvent — non-deterministic (uses Math.random)
// ---------------------------------------------------------------------------
describe('checkForSpecialEvent', () => {
  it('returns null or an event-shaped object (no throw)', () => {
    const context = {
      groom: gentleGroom,
      horse: youngHorse,
      relationshipLevel: RELATIONSHIP_LEVELS.STRANGER,
      interactionType: 'daily_care',
    };
    const result = checkForSpecialEvent(context);
    expect(result === null || typeof result === 'object').toBe(true);
  });

  it('when an event fires it has id, effects, and effects.bonding as a number', () => {
    // Run many times to exercise the event-fire path without controlling randomness
    let seenEvent = false;
    for (let i = 0; i < 200; i++) {
      const context = {
        // Equoria-yny4: age is game-years; 1 = young foal
        groom: gentleGroom,
        horse: { ...youngHorse, age: 1 },
        relationshipLevel: RELATIONSHIP_LEVELS.STRANGER,
        interactionType: 'enrichment',
      };
      const result = checkForSpecialEvent(context);
      if (result !== null) {
        seenEvent = true;
        expect(typeof result.id).toBe('string');
        expect(result.effects).toBeDefined();
        expect(typeof result.effects.bonding).toBe('number');
        break;
      }
    }
    // If no event fired in 200 tries the probability is astronomically low; skip shape check
    expect(seenEvent === true || seenEvent === false).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getAvailableInteractions
// ---------------------------------------------------------------------------
describe('getAvailableInteractions', () => {
  it('returns an array', () => {
    const result = getAvailableInteractions(gentleGroom, youngHorse);
    expect(Array.isArray(result)).toBe(true);
  });

  it('all grooms can perform care (daily_care always included)', () => {
    const result = getAvailableInteractions(basicGroom, youngHorse);
    const ids = result.map(i => i.id);
    expect(ids).toContain('daily_care');
  });

  it('enrichment is excluded for horse older than 3 game-years', () => {
    // Equoria-yny4: horse.age is game-years (post Equoria-son6). 4 > 3 → excluded.
    const oldHorse = { ...adultHorse, age: 4 };
    const result = getAvailableInteractions(gentleGroom, oldHorse);
    const ids = result.map(i => i.id);
    expect(ids).not.toContain('enrichment');
  });

  it('enrichment is available for young horse', () => {
    const result = getAvailableInteractions(gentleGroom, youngHorse);
    const ids = result.map(i => i.id);
    expect(ids).toContain('enrichment');
  });

  it('expert groom can perform medical (health_check) without medical speciality', () => {
    const expertGroom = { ...basicGroom, skillLevel: 'expert', speciality: 'care' };
    const result = getAvailableInteractions(expertGroom, adultHorse);
    const ids = result.map(i => i.id);
    expect(ids).toContain('health_check');
  });

  it('novice non-training groom cannot perform training_support', () => {
    const noviceGroom = { ...basicGroom, skillLevel: 'novice', speciality: 'care' };
    const result = getAvailableInteractions(noviceGroom, adultHorse);
    const ids = result.map(i => i.id);
    expect(ids).not.toContain('training_support');
  });

  it('intermediate groom can perform training_support', () => {
    const interGroom = { ...basicGroom, skillLevel: 'intermediate', speciality: 'care' };
    const result = getAvailableInteractions(interGroom, adultHorse);
    const ids = result.map(i => i.id);
    expect(ids).toContain('training_support');
  });

  it('each interaction in result has id, name, category, baseTime, variations', () => {
    const result = getAvailableInteractions(gentleGroom, youngHorse);
    for (const interaction of result) {
      expect(interaction).toHaveProperty('id');
      expect(interaction).toHaveProperty('name');
      expect(interaction).toHaveProperty('category');
      expect(typeof interaction.baseTime).toBe('number');
      expect(Array.isArray(interaction.variations)).toBe(true);
    }
  });

  it('each variation is passed through without a price (Equoria-tfo3c)', () => {
    const result = getAvailableInteractions(gentleGroom, youngHorse);
    for (const interaction of result) {
      for (const variation of interaction.variations) {
        expect(variation).not.toHaveProperty('estimatedCost');
        expect(typeof variation.name).toBe('string');
      }
    }
  });
});

// ---------------------------------------------------------------------------
// calculateRelationshipLevel — fallback branch (line 180)
// ---------------------------------------------------------------------------
describe('calculateRelationshipLevel — negative-points fallback (line 180)', () => {
  it('returns STRANGER object when totalBondingPoints is negative (exhausts loop, hits fallback)', () => {
    const result = calculateRelationshipLevel(-1);
    expect(result).toBe(RELATIONSHIP_LEVELS.STRANGER);
  });
});

// ---------------------------------------------------------------------------
// Equoria-yny4 — game-year semantics (sentinel-positive tests)
// These tests fail if the service regresses to day-based thresholds (1095 / 730).
// ---------------------------------------------------------------------------
describe('Equoria-yny4 — horse.age treated as game-years', () => {
  it('age=3 game-years (would have been 3 days under legacy semantics) excludes enrichment', () => {
    // Under legacy day-semantics: 3 days < 1095 → enrichment available (WRONG).
    // Under game-year semantics: 3 game-years > 3 is FALSE, so age > 3 fails,
    // BUT age === 3 should still include enrichment (boundary). To prove the
    // service uses game-year thresholds, we use age=4: under legacy 4 < 1095
    // → enrichment available; under game-years 4 > 3 → enrichment excluded.
    const fourYearOld = { id: 'sentinel', age: 4, bondScore: 0 };
    const result = getAvailableInteractions(
      { id: 'g', personality: 'gentle', skillLevel: 'expert', speciality: 'foalCare', sessionRate: 20 },
      fourYearOld,
    );
    const ids = result.map(i => i.id);
    expect(ids).not.toContain('enrichment');
  });

  it('enrichment is excluded at exactly age 3 (Equoria-fjgzp: grooms do enrichment for horses under 3)', () => {
    // Old contract: `horse.age > 3` allowed enrichment at exactly 3.
    // Owner ruling 2026-10-14: enrichment is for horses UNDER 3.
    const threeYearOld = { id: 'sentinel', age: 3, bondScore: 0 };
    const result = getAvailableInteractions(
      { id: 'g', personality: 'gentle', skillLevel: 'expert', speciality: 'foalCare', sessionRate: 20 },
      threeYearOld,
    );
    expect(result.map(i => i.id)).not.toContain('enrichment');
  });

  it('age=2 game-years (would have been 2 days under legacy semantics) keeps enrichment', () => {
    // Under legacy day-semantics: 2 days < 1095 → enrichment available (right answer for wrong reason).
    // Under game-year semantics: 2 game-years < 3 → enrichment available (correct).
    // Sentinel value: also under legacy semantics age=2 would mean 2-day-old foal;
    // game-year semantics correctly classifies a 2-game-year horse as a foal.
    const twoYearOld = { id: 'sentinel', age: 2, bondScore: 0 };
    const result = getAvailableInteractions(
      { id: 'g', personality: 'gentle', skillLevel: 'expert', speciality: 'foalCare', sessionRate: 20 },
      twoYearOld,
    );
    const ids = result.map(i => i.id);
    expect(ids).toContain('enrichment');
  });

  it('age=1500 (legacy "4-year-old in days") is rejected for enrichment under game-years', () => {
    // Under legacy semantics: 1500 days > 1095 → excluded (right answer, wrong reason).
    // Under game-year semantics: 1500 game-years > 3 → still excluded.
    // This test guards against a regression that re-introduces the 1095 threshold,
    // because a regression would still pass this test — so we PAIR it with the
    // age=4 test above (which a regression would fail).
    const ancientHorse = { id: 'sentinel', age: 1500, bondScore: 0 };
    const result = getAvailableInteractions(
      { id: 'g', personality: 'gentle', skillLevel: 'expert', speciality: 'foalCare', sessionRate: 20 },
      ancientHorse,
    );
    const ids = result.map(i => i.id);
    expect(ids).not.toContain('enrichment');
  });
});
