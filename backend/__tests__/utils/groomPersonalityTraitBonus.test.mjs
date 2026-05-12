/**
 * groomPersonalityTraitBonus — unit tests (Equoria-rr7)
 *
 * Pure compatibility logic, no DB required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  GROOM_PERSONALITY_TYPES,
  FOAL_TEMPERAMENT_TYPES,
  PERSONALITY_TEMPERAMENT_COMPATIBILITY,
  calculatePersonalityCompatibility,
  getCompatibleGroomsForTemperament,
  validatePersonalityTemperament,
} from '../../utils/groomPersonalityTraitBonus.mjs';

// ---------------------------------------------------------------------------
// Exported constants
// ---------------------------------------------------------------------------
describe('GROOM_PERSONALITY_TYPES', () => {
  it('contains at least 5 personality types', () => {
    expect(Object.keys(GROOM_PERSONALITY_TYPES).length).toBeGreaterThanOrEqual(5);
  });

  it('has CALM, ENERGETIC, ASSERTIVE', () => {
    expect(GROOM_PERSONALITY_TYPES.CALM).toBe('Calm');
    expect(GROOM_PERSONALITY_TYPES.ENERGETIC).toBe('Energetic');
    expect(GROOM_PERSONALITY_TYPES.ASSERTIVE).toBe('Assertive');
  });
});

describe('FOAL_TEMPERAMENT_TYPES', () => {
  it('contains at least 7 temperament types', () => {
    expect(Object.keys(FOAL_TEMPERAMENT_TYPES).length).toBeGreaterThanOrEqual(7);
  });

  it('includes SPIRITED, STEADY, REACTIVE, STUBBORN', () => {
    expect(FOAL_TEMPERAMENT_TYPES.SPIRITED).toBe('Spirited');
    expect(FOAL_TEMPERAMENT_TYPES.STEADY).toBe('Steady');
    expect(FOAL_TEMPERAMENT_TYPES.REACTIVE).toBe('Reactive');
    expect(FOAL_TEMPERAMENT_TYPES.STUBBORN).toBe('Stubborn');
  });
});

describe('PERSONALITY_TEMPERAMENT_COMPATIBILITY', () => {
  it('has an entry for every personality type', () => {
    for (const personality of Object.values(GROOM_PERSONALITY_TYPES)) {
      expect(PERSONALITY_TEMPERAMENT_COMPATIBILITY[personality]).toBeDefined();
    }
  });

  it('each entry has idealMatches, traitDevBonus, stressMod, bondModifier, description', () => {
    for (const config of Object.values(PERSONALITY_TEMPERAMENT_COMPATIBILITY)) {
      expect(config).toHaveProperty('idealMatches');
      expect(config).toHaveProperty('traitDevBonus');
      expect(config).toHaveProperty('stressMod');
      expect(config).toHaveProperty('bondModifier');
      expect(config).toHaveProperty('description');
      expect(Array.isArray(config.idealMatches)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// calculatePersonalityCompatibility
// ---------------------------------------------------------------------------
describe('calculatePersonalityCompatibility', () => {
  it('returns isMatch=true for a known ideal pairing', () => {
    // Calm groom + Reactive foal is an ideal match
    const result = calculatePersonalityCompatibility('Calm', 'Reactive', 0);
    expect(result.isMatch).toBe(true);
  });

  it('returns isMatch=false for a non-ideal pairing', () => {
    // Calm groom + Stubborn foal is not an ideal match
    const result = calculatePersonalityCompatibility('Calm', 'Stubborn', 0);
    expect(result.isMatch).toBe(false);
  });

  it('returns isStrongMatch=true when bond > 60 and it is an ideal match', () => {
    const result = calculatePersonalityCompatibility('Calm', 'Reactive', 80);
    expect(result.isStrongMatch).toBe(true);
  });

  it('returns isStrongMatch=false when bond <= 60 even with ideal match', () => {
    const result = calculatePersonalityCompatibility('Calm', 'Reactive', 50);
    expect(result.isStrongMatch).toBe(false);
  });

  it('returns traitModifierScore=2 for strong match', () => {
    const result = calculatePersonalityCompatibility('Calm', 'Reactive', 80);
    expect(result.traitModifierScore).toBe(2);
  });

  it('returns traitModifierScore=-1 for mismatch', () => {
    const result = calculatePersonalityCompatibility('Calm', 'Stubborn', 0);
    expect(result.traitModifierScore).toBe(-1);
  });

  it('returns structured response for unknown personality', () => {
    const result = calculatePersonalityCompatibility('Telepathic', 'Calm', 0);
    expect(result.isMatch).toBe(false);
    expect(result.traitModifierScore).toBe(0);
    expect(result.description).toBe('Unknown personality type');
  });

  it('returns stressResistanceBonus as decimal (stressMod / 100)', () => {
    const result = calculatePersonalityCompatibility('Calm', 'Reactive', 0);
    // Calm groom has stressMod: -15 → stressResistanceBonus = -0.15
    expect(result.stressResistanceBonus).toBeCloseTo(-0.15);
  });

  it('returns bondModifier from compatibility config', () => {
    const result = calculatePersonalityCompatibility('Calm', 'Reactive', 0);
    expect(typeof result.bondModifier).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// getCompatibleGroomsForTemperament
// ---------------------------------------------------------------------------
describe('getCompatibleGroomsForTemperament', () => {
  it('returns an array', () => {
    expect(Array.isArray(getCompatibleGroomsForTemperament('Reactive'))).toBe(true);
  });

  it('Calm groom appears for Reactive temperament', () => {
    const groomNames = getCompatibleGroomsForTemperament('Reactive').map(g => g.personality);
    expect(groomNames).toContain('Calm');
  });

  it('returns empty array for a temperament with no ideal matches', () => {
    // Use a totally fake temperament
    const result = getCompatibleGroomsForTemperament('AlienTemperament');
    expect(result).toEqual([]);
  });

  it('each returned entry has personality, traitDevBonus, stressMod, bondModifier, description', () => {
    const result = getCompatibleGroomsForTemperament('Spirited');
    for (const entry of result) {
      expect(entry).toHaveProperty('personality');
      expect(entry).toHaveProperty('traitDevBonus');
      expect(entry).toHaveProperty('stressMod');
      expect(entry).toHaveProperty('bondModifier');
      expect(entry).toHaveProperty('description');
    }
  });
});

// ---------------------------------------------------------------------------
// validatePersonalityTemperament
// ---------------------------------------------------------------------------
describe('validatePersonalityTemperament', () => {
  it('validates a known personality and temperament as true', () => {
    const result = validatePersonalityTemperament('Calm', 'Reactive');
    expect(result.isValidPersonality).toBe(true);
    expect(result.isValidTemperament).toBe(true);
  });

  it('invalidates unknown personality', () => {
    const result = validatePersonalityTemperament('Supernatural', 'Reactive');
    expect(result.isValidPersonality).toBe(false);
    expect(result.isValidTemperament).toBe(true);
  });

  it('invalidates unknown temperament', () => {
    const result = validatePersonalityTemperament('Calm', 'Extraterrestrial');
    expect(result.isValidPersonality).toBe(true);
    expect(result.isValidTemperament).toBe(false);
  });

  it('returns validPersonalities and validTemperaments arrays', () => {
    const result = validatePersonalityTemperament('Calm', 'Reactive');
    expect(Array.isArray(result.validPersonalities)).toBe(true);
    expect(Array.isArray(result.validTemperaments)).toBe(true);
    expect(result.validPersonalities.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// calculatePersonalityCompatibility — default bondScore parameter (line 164)
// ---------------------------------------------------------------------------
describe('calculatePersonalityCompatibility — default bondScore=0 branch (line 164)', () => {
  it('omitting bondScore uses default 0 → isStrongMatch is false for match with low default bond', () => {
    // Calm + Reactive is an ideal match; bond defaults to 0 (not > 60) → isStrongMatch false
    const result = calculatePersonalityCompatibility('Calm', 'Reactive');
    expect(result.isMatch).toBe(true);
    expect(result.isStrongMatch).toBe(false);
    expect(result.traitModifierScore).toBe(1); // traitDevBonus for regular match
  });
});

// ---------------------------------------------------------------------------
// calculatePersonalityCompatibility — catch block (lines 213-215)
// ---------------------------------------------------------------------------
describe('calculatePersonalityCompatibility — catch block (lines 213-215)', () => {
  it('returns error fallback when bondScore.valueOf() throws during isStrongMatch evaluation', () => {
    // Strategy: pick a known personality+temperament that IS a match (isMatch=true),
    // then pass a bondScore whose valueOf() throws.  JavaScript ToPrimitive calls
    // valueOf() when evaluating `bondScore > 60`, which throws and lands in catch.
    const throwingBond = {
      valueOf() {
        throw new Error('bond evaluation bomb');
      },
    };
    const result = calculatePersonalityCompatibility('Calm', 'Reactive', throwingBond);
    expect(result.isMatch).toBe(false);
    expect(result.isStrongMatch).toBe(false);
    expect(result.traitModifierScore).toBe(0);
    expect(result.stressResistanceBonus).toBe(0);
    expect(result.bondModifier).toBe(0);
    expect(result.description).toBe('Error calculating compatibility');
  });
});
