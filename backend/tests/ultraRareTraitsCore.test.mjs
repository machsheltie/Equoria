/**
 * Ultra-Rare & Exotic Traits Core Functionality Tests
 * Tests the core trait definitions and mechanical effects without database dependencies
 * 
 * Testing Approach: Pure unit tests for core functionality
 * Focus: Trait definitions, mechanical effects, groom perks
 */

import { jest } from '@jest/globals';
import { getAllUltraRareTraits, getAllExoticTraits, getUltraRareTraitDefinition } from '../utils/ultraRareTraits.mjs';
import { applyRareTraitBoosterEffects } from '../utils/groomRareTraitPerks.mjs';
import { applyUltraRareStressEffects, applyUltraRareCompetitionEffects, hasUltraRareAbility } from '../utils/ultraRareMechanicalEffects.mjs';

describe('Ultra-Rare & Exotic Traits Core Functionality', () => {
  describe('Trait Definitions System', () => {
    test('should retrieve all ultra-rare trait definitions', () => {
      const ultraRareTraits = getAllUltraRareTraits();
      
      expect(ultraRareTraits).toBeDefined();
      expect(Object.keys(ultraRareTraits)).toHaveLength(5);
      
      // Verify Phoenix-Born trait definition
      expect(ultraRareTraits['phoenix-born']).toBeDefined();
      expect(ultraRareTraits['phoenix-born'].name).toBe('Phoenix-Born');
      expect(ultraRareTraits['phoenix-born'].rarity).toBe('ultra-rare');
      expect(ultraRareTraits['phoenix-born'].baseChance).toBe(0.02);
      expect(ultraRareTraits['phoenix-born'].mechanicalEffects.stressDecayMultiplier).toBe(1.3);
    });

    test('should retrieve all exotic trait definitions', () => {
      const exoticTraits = getAllExoticTraits();
      
      expect(exoticTraits).toBeDefined();
      expect(Object.keys(exoticTraits)).toHaveLength(5);
      
      // Verify Fey-Kissed trait definition
      expect(exoticTraits['fey-kissed']).toBeDefined();
      expect(exoticTraits['fey-kissed'].name).toBe('Fey-Kissed');
      expect(exoticTraits['fey-kissed'].rarity).toBe('exotic');
      expect(exoticTraits['fey-kissed'].mechanicalEffects.allStatBonus).toBe(3);
    });

    test('should get specific trait definition by name', () => {
      const phoenixBorn = getUltraRareTraitDefinition('phoenix-born');
      expect(phoenixBorn).toBeDefined();
      expect(phoenixBorn.tier).toBe('ultra-rare');
      
      const soulbonded = getUltraRareTraitDefinition('soulbonded');
      expect(soulbonded).toBeDefined();
      expect(soulbonded.tier).toBe('exotic');
      
      const nonExistent = getUltraRareTraitDefinition('non-existent-trait');
      expect(nonExistent).toBeNull();
    });

    test('should have correct trait structure for all ultra-rare traits', () => {
      const ultraRareTraits = getAllUltraRareTraits();
      
      Object.values(ultraRareTraits).forEach(trait => {
        expect(trait).toHaveProperty('name');
        expect(trait).toHaveProperty('rarity', 'ultra-rare');
        expect(trait).toHaveProperty('baseChance');
        expect(trait).toHaveProperty('mechanicalEffects');
        expect(trait).toHaveProperty('triggerConditions');
        expect(trait).toHaveProperty('groomBonusTags');
        expect(trait.baseChance).toBeGreaterThan(0);
        expect(trait.baseChance).toBeLessThan(0.05); // Less than 5%
      });
    });

    test('should have correct trait structure for all exotic traits', () => {
      const exoticTraits = getAllExoticTraits();
      
      Object.values(exoticTraits).forEach(trait => {
        expect(trait).toHaveProperty('name');
        expect(trait).toHaveProperty('rarity', 'exotic');
        expect(trait).toHaveProperty('mechanicalEffects');
        expect(trait).toHaveProperty('unlockConditions');
        expect(trait).toHaveProperty('groomBonusTags');
      });
    });
  });

  describe('Groom Perk System', () => {
    test('should apply rare trait booster effects to probability calculations', () => {
      const groomData = {
        id: 1,
        rareTraitPerks: {
          'phoenix-born-booster': {
            name: 'Phoenix Whisperer',
            baseBonus: 0.25,
            stackedBonus: 0.15,
            triggerCount: 1,
            revealed: false,
          },
        },
      };

      const baseChance = 0.02;
      const conditions = {
        stressEvents: true,
        recoveries: true,
      };

      const result = applyRareTraitBoosterEffects('phoenix-born', baseChance, groomData, conditions);
      
      expect(result.originalChance).toBe(0.02);
      expect(result.modifiedChance).toBeGreaterThan(0.02);
      expect(result.appliedPerks).toHaveLength(2); // Base bonus + stacked bonus
      expect(result.perkBonus).toBeGreaterThan(0);
      expect(result.perkBonus).toBe(0.4); // 0.25 + 0.15
    });

    test('should not apply bonuses when no conditions are met', () => {
      const groomData = {
        id: 1,
        rareTraitPerks: {
          'phoenix-born-booster': {
            name: 'Phoenix Whisperer',
            baseBonus: 0.25,
            stackedBonus: 0.15,
            triggerCount: 1,
            revealed: false,
          },
        },
      };

      const baseChance = 0;
      const conditions = {};

      const result = applyRareTraitBoosterEffects('phoenix-born', baseChance, groomData, conditions);
      
      expect(result.originalChance).toBe(0);
      expect(result.modifiedChance).toBe(0);
      expect(result.appliedPerks).toHaveLength(0);
      expect(result.perkBonus).toBe(0);
    });
  });

  describe('Mechanical Effects Integration', () => {
    test('should apply ultra-rare stress effects correctly', () => {
      const horseWithPhoenixBorn = {
        ultraRareTraits: {
          ultraRare: [{ name: 'Phoenix-Born' }],
          exotic: [],
        },
      };

      const baseStress = 50;
      const result = applyUltraRareStressEffects(horseWithPhoenixBorn, baseStress);
      
      expect(result.originalStress).toBe(50);
      expect(result.modifiedStress).toBeLessThan(50); // 20% stress resistance
      expect(result.modifiedStress).toBe(40); // 50 - (50 * 0.2) = 40
      expect(result.appliedEffects).toHaveLength(1);
      expect(result.appliedEffects[0].trait).toBe('Phoenix-Born');
      expect(result.appliedEffects[0].effect).toBe('stress_resistance');
    });

    test('should apply ultra-rare competition effects correctly', () => {
      const horseWithBornLeader = {
        ultraRareTraits: {
          ultraRare: [{ name: 'Born Leader' }],
          exotic: [],
        },
      };

      const baseScore = 100;
      const competitionContext = { isPairEvent: false };
      const result = applyUltraRareCompetitionEffects(horseWithBornLeader, baseScore, competitionContext);
      
      expect(result.originalScore).toBe(100);
      expect(result.modifiedScore).toBeGreaterThan(100);
      expect(result.appliedEffects.length).toBeGreaterThan(0);
      
      // Should have competition presence bonus
      const presenceEffect = result.appliedEffects.find(effect => effect.effect === 'competition_presence');
      expect(presenceEffect).toBeDefined();
      expect(presenceEffect.trait).toBe('Born Leader');
    });

    test('should check ultra-rare abilities correctly', () => {
      const horseWithIronWilled = {
        ultraRareTraits: {
          ultraRare: [{ name: 'Iron-Willed' }],
          exotic: [],
        },
      };

      const horseWithGhostwalker = {
        ultraRareTraits: {
          ultraRare: [],
          exotic: [{ name: 'Ghostwalker' }],
        },
      };

      expect(hasUltraRareAbility(horseWithIronWilled, 'burnout_immunity')).toBe(true);
      expect(hasUltraRareAbility(horseWithIronWilled, 'stress_immunity')).toBe(false);
      
      expect(hasUltraRareAbility(horseWithGhostwalker, 'stress_immunity')).toBe(true);
      expect(hasUltraRareAbility(horseWithGhostwalker, 'burnout_immunity')).toBe(false);
    });

    test('should handle multiple ultra-rare traits correctly', () => {
      const horseWithMultipleTraits = {
        ultraRareTraits: {
          ultraRare: [{ name: 'Phoenix-Born' }, { name: 'Stormtouched' }],
          exotic: [],
        },
      };

      const baseStress = 100;
      const result = applyUltraRareStressEffects(horseWithMultipleTraits, baseStress);

      expect(result.originalStress).toBe(100);
      expect(result.appliedEffects.length).toBeGreaterThan(0);

      // Should have effects from both traits
      const phoenixEffect = result.appliedEffects.find(effect => effect.trait === 'Phoenix-Born');
      const stormtouchedEffect = result.appliedEffects.find(effect => effect.trait === 'Stormtouched');

      expect(phoenixEffect).toBeDefined();
      expect(stormtouchedEffect).toBeDefined();

      // Phoenix-Born reduces stress, Stormtouched increases it
      expect(phoenixEffect.effect).toBe('stress_resistance');
      expect(stormtouchedEffect.effect).toBe('stress_gain_multiplier');
    });

    test('should handle stress immunity correctly', () => {
      const horseWithGhostwalker = {
        ultraRareTraits: {
          ultraRare: [],
          exotic: [{ name: 'Ghostwalker' }],
        },
      };

      const baseStress = 100;
      const result = applyUltraRareStressEffects(horseWithGhostwalker, baseStress);
      
      expect(result.originalStress).toBe(100);
      expect(result.modifiedStress).toBe(0); // Complete immunity
      expect(result.appliedEffects).toHaveLength(1);
      expect(result.appliedEffects[0].effect).toBe('stress_immunity');
      expect(result.totalReduction).toBe(100);
    });
  });

  describe('Trait Conflicts and Stacking', () => {
    test('should define proper trait conflicts', () => {
      const phoenixBorn = getUltraRareTraitDefinition('phoenix-born');
      expect(phoenixBorn.conflicts).toContain('fragile');
      expect(phoenixBorn.conflicts).toContain('nervous');
      
      const ghostwalker = getUltraRareTraitDefinition('ghostwalker');
      expect(ghostwalker.conflicts).toContain('social');
      expect(ghostwalker.conflicts).toContain('empathic-mirror');
    });

    test('should define proper trait stacking', () => {
      const phoenixBorn = getUltraRareTraitDefinition('phoenix-born');
      expect(phoenixBorn.stacksWith).toContain('resilient');
      expect(phoenixBorn.stacksWith).toContain('calm');
      
      const feyKissed = getUltraRareTraitDefinition('fey-kissed');
      expect(feyKissed.stacksWith).toContain('all');
    });
  });
});
