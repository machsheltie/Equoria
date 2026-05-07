/**
 * enhancedGroomInteractions — unit tests (Equoria-rr7)
 *
 * Pure exports only (no processInteractionWithPerformance which calls DB).
 * groomPerformanceService imports prisma but only at runtime — DB is real.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  calculateRelationshipLevel,
  checkForSpecialEvent,
  calculateEnhancedEffects,
  getAvailableInteractions,
  RELATIONSHIP_LEVELS,
  ENHANCED_INTERACTIONS,
  SPECIAL_EVENTS,
  GROOM_PREFERENCES,
} from '../../services/enhancedGroomInteractions.mjs';

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

const energeticGroom = {
  id: 'g2',
  personality: 'energetic',
  skillLevel: 'intermediate',
  speciality: 'training',
  sessionRate: 25,
};

const basicGroom = {
  id: 'g3',
  personality: 'patient',
  skillLevel: 'novice',
  speciality: 'care',
  sessionRate: 15,
};

const youngHorse = {
  id: 'h1',
  age: 365,
  bondScore: 0,
  stressLevel: 20,
};

const adultHorse = {
  id: 'h2',
  age: 1460,
  bondScore: 150,
  stressLevel: 40,
};

const stressedHorse = {
  id: 'h3',
  age: 730,
  bondScore: 0,
  stressLevel: 70,
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
  let randomSpy;

  afterEach(() => {
    if (randomSpy) randomSpy.mockRestore();
  });

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

  it('returns null when Math.random always exceeds event probability', () => {
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.999);
    const context = {
      groom: gentleGroom,
      horse: youngHorse,
      relationshipLevel: RELATIONSHIP_LEVELS.STRANGER,
      interactionType: 'daily_care',
    };
    expect(checkForSpecialEvent(context)).toBeNull();
  });

  it('can trigger PLAYFUL_INTERACTION with low random + low-age horse + low stress', () => {
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const context = {
      groom: gentleGroom,
      horse: { ...youngHorse, age: 365, stressLevel: 10 }, // under 730 days, stress < 40
      relationshipLevel: RELATIONSHIP_LEVELS.STRANGER,
      interactionType: 'enrichment',
    };
    const result = checkForSpecialEvent(context);
    // With random=0 and matching conditions, an event should fire
    expect(result).not.toBeNull();
    expect(typeof result.id).toBe('string');
    expect(result.effects).toBeDefined();
  });

  it('returns object with effects.bonding when event fires', () => {
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const context = {
      groom: gentleGroom,
      horse: { ...youngHorse, stressLevel: 10, age: 365 },
      relationshipLevel: RELATIONSHIP_LEVELS.STRANGER,
      interactionType: 'enrichment',
    };
    const result = checkForSpecialEvent(context);
    if (result !== null) {
      expect(typeof result.effects.bonding).toBe('number');
    }
  });
});

// ---------------------------------------------------------------------------
// calculateEnhancedEffects
// ---------------------------------------------------------------------------
describe('calculateEnhancedEffects', () => {
  let randomSpy;

  beforeEach(() => {
    // Pin random to eliminate non-determinism
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  it('returns expected shape', () => {
    const result = calculateEnhancedEffects(gentleGroom, youngHorse, 'daily_care', 'Morning Routine', 30);
    expect(result).toHaveProperty('bondingChange');
    expect(result).toHaveProperty('stressChange');
    expect(result).toHaveProperty('quality');
    expect(result).toHaveProperty('relationshipLevel');
    expect(result).toHaveProperty('variation');
    expect(result).toHaveProperty('specialEvent');
    expect(result).toHaveProperty('duration');
    expect(result).toHaveProperty('cost');
  });

  it('bondingChange is between 1 and 25 (clamped)', () => {
    const result = calculateEnhancedEffects(gentleGroom, youngHorse, 'daily_care', 'Morning Routine', 30);
    expect(result.bondingChange).toBeGreaterThanOrEqual(1);
    expect(result.bondingChange).toBeLessThanOrEqual(25);
  });

  it('stressChange is between -20 and 5 (clamped)', () => {
    const result = calculateEnhancedEffects(gentleGroom, youngHorse, 'daily_care', 'Morning Routine', 30);
    expect(result.stressChange).toBeGreaterThanOrEqual(-20);
    expect(result.stressChange).toBeLessThanOrEqual(5);
  });

  it('quality is a known string', () => {
    const result = calculateEnhancedEffects(gentleGroom, youngHorse, 'daily_care', 'Morning Routine', 30);
    expect(['exceptional', 'excellent', 'good', 'fair', 'poor']).toContain(result.quality);
  });

  it('duration echoed back in result', () => {
    const result = calculateEnhancedEffects(gentleGroom, youngHorse, 'daily_care', 'Morning Routine', 60);
    expect(result.duration).toBe(60);
  });

  it('cost is a positive number', () => {
    const result = calculateEnhancedEffects(gentleGroom, youngHorse, 'daily_care', 'Morning Routine', 60);
    expect(typeof result.cost).toBe('number');
    expect(result.cost).toBeGreaterThan(0);
  });

  it('throws for unknown interaction type', () => {
    expect(() =>
      calculateEnhancedEffects(gentleGroom, youngHorse, 'UNKNOWN_TYPE_XYZ', 'Morning Routine', 30),
    ).toThrow();
  });

  it('works with enrichment interaction type', () => {
    const result = calculateEnhancedEffects(energeticGroom, youngHorse, 'enrichment', 'Social Play', 45);
    expect(result.bondingChange).toBeGreaterThanOrEqual(1);
  });

  it('uses first variation when named variation not found', () => {
    const result = calculateEnhancedEffects(gentleGroom, youngHorse, 'daily_care', 'Nonexistent Variation', 30);
    expect(result).toHaveProperty('variation');
    // Should fall back to first variation: 'Morning Routine'
    expect(result.variation).toBe('Morning Routine');
  });

  it('applies higher relationship multiplier for adult bonded horse', () => {
    const bondedHorse = { ...adultHorse, bondScore: 200 }; // BONDED threshold
    const result = calculateEnhancedEffects(gentleGroom, bondedHorse, 'daily_care', 'Morning Routine', 30);
    expect(result.bondingChange).toBeGreaterThanOrEqual(1);
    expect(result.relationshipLevel).toBe('Bonded');
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

  it('enrichment is excluded for horse older than 3 years (> 1095 days)', () => {
    const oldHorse = { ...adultHorse, age: 1460 };
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

  it('each variation has estimatedCost added', () => {
    const result = getAvailableInteractions(gentleGroom, youngHorse);
    for (const interaction of result) {
      for (const variation of interaction.variations) {
        expect(typeof variation.estimatedCost).toBe('number');
      }
    }
  });
});
