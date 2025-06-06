/**
 * Trait Metadata Validation Test Suite
 * Validates trait definitions, descriptions, categories, and integration
 *
 * 🎯 FEATURES TESTED:
 * - Trait structure validation (description, type, category)
 * - Required traits from task influence map exist
 * - Trait conflict consistency
 * - Category classification accuracy
 * - Description quality and completeness
 * - Integration with foal development system
 *
 * 🔧 DEPENDENCIES:
 * - epigeneticTraits.mjs (trait definitions)
 * - taskInfluenceConfig.mjs (task-trait mapping)
 *
 * 📋 BUSINESS RULES TESTED:
 * - All traits have proper descriptions for UI display
 * - Traits are categorized correctly (epigenetic, bond, situational)
 * - Conflict relationships are bidirectional
 * - Task influence map references valid traits
 * - Required traits for foal development exist
 *
 * 🧪 TESTING APPROACH:
 * - Mock: None (pure validation)
 * - Real: All trait definitions, metadata, and relationships
 */

import { describe, it, expect } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import trait functions and definitions
const {
  getTraitDefinition,
  getTraitsByType,
  getTraitsByCategory,
  getTraitMetadata,
  checkTraitConflict,
} = await import(join(__dirname, '../utils/epigeneticTraits.js'));

const { TASK_TRAIT_INFLUENCE_MAP } = await import(
  join(__dirname, '../config/taskInfluenceConfig.js')
);

describe('Trait Metadata Validation', () => {
  describe('Required Trait Structure', () => {
    const requiredTraits = ['confident', 'resilient', 'presentation_boosted', 'bonded'];

    requiredTraits.forEach(trait => {
      it(`should have complete metadata for ${trait}`, () => {
        const metadata = getTraitMetadata(trait);

        expect(metadata).not.toBeNull();
        expect(metadata.name).toBe(trait);
        expect(metadata.description).toBeDefined();
        expect(metadata.description.length).toBeGreaterThan(10);
        expect(metadata.type).toMatch(/^(positive|negative)$/);
        expect(metadata.category).toMatch(/^(epigenetic|bond|situational)$/);
        expect(metadata.rarity).toMatch(/^(common|rare|legendary)$/);
        expect(Array.isArray(metadata.conflicts)).toBe(true);
      });
    });
  });

  describe('Trait Categories', () => {
    it('should have epigenetic traits', () => {
      const epigeneticTraits = getTraitsByCategory('epigenetic');

      expect(epigeneticTraits).toContain('confident');
      expect(epigeneticTraits).toContain('resilient');
      expect(epigeneticTraits).toContain('calm');
      expect(epigeneticTraits.length).toBeGreaterThan(5);
    });

    it('should have bond traits', () => {
      const bondTraits = getTraitsByCategory('bond');

      expect(bondTraits).toContain('bonded');
      expect(bondTraits.length).toBeGreaterThanOrEqual(1);
    });

    it('should have situational traits', () => {
      const situationalTraits = getTraitsByCategory('situational');

      expect(situationalTraits).toContain('presentation_boosted');
      expect(situationalTraits).toContain('show_calm');
      expect(situationalTraits).toContain('crowd_ready');
      expect(situationalTraits.length).toBeGreaterThanOrEqual(3);
    });

    it('should categorize all traits correctly', () => {
      const allTraits = getTraitsByType('all');
      const epigenetic = getTraitsByCategory('epigenetic');
      const bond = getTraitsByCategory('bond');
      const situational = getTraitsByCategory('situational');

      const totalCategorized = epigenetic.length + bond.length + situational.length;
      expect(totalCategorized).toBe(allTraits.length);
    });
  });

  describe('Trait Descriptions', () => {
    it('should have proper description format for confident trait', () => {
      const metadata = getTraitMetadata('confident');

      expect(metadata.description).toBe('This horse is brave in new situations.');
      expect(metadata.type).toBe('positive');
      expect(metadata.category).toBe('epigenetic');
    });

    it('should have proper description format for resilient trait', () => {
      const metadata = getTraitMetadata('resilient');

      expect(metadata.description).toBe('Less likely to be affected by stress.');
      expect(metadata.type).toBe('positive');
      expect(metadata.category).toBe('epigenetic');
    });

    it('should have proper description format for presentation_boosted trait', () => {
      const metadata = getTraitMetadata('presentation_boosted');

      expect(metadata.description).toBe('Scores higher in appearance-based events.');
      expect(metadata.type).toBe('positive');
      expect(metadata.category).toBe('situational');
    });

    it('should have proper description format for bonded trait', () => {
      const metadata = getTraitMetadata('bonded');

      expect(metadata.description).toBe('Forms deeper trust with specific handlers.');
      expect(metadata.type).toBe('positive');
      expect(metadata.category).toBe('bond');
    });

    it('should have descriptions for all traits', () => {
      const allTraits = getTraitsByType('all');

      allTraits.forEach(trait => {
        const metadata = getTraitMetadata(trait);
        expect(metadata.description).toBeDefined();
        expect(metadata.description.length).toBeGreaterThan(5);
        expect(metadata.description).toMatch(/^[A-Z]/); // Starts with capital letter
        expect(metadata.description).toMatch(/\.$/); // Ends with period
      });
    });
  });

  describe('Trait Conflicts', () => {
    it('should have bidirectional conflicts', () => {
      const allTraits = getTraitsByType('all');

      allTraits.forEach(trait1 => {
        const metadata1 = getTraitMetadata(trait1);

        metadata1.conflicts.forEach(trait2 => {
          const metadata2 = getTraitMetadata(trait2);
          expect(metadata2).not.toBeNull();
          expect(metadata2.conflicts).toContain(trait1);
        });
      });
    });

    it('should validate specific conflict relationships', () => {
      expect(checkTraitConflict('confident', 'nervous')).toBe(true);
      expect(checkTraitConflict('resilient', 'fragile')).toBe(true);
      expect(checkTraitConflict('calm', 'aggressive')).toBe(true);
      expect(checkTraitConflict('bonded', 'aggressive')).toBe(true);

      // Non-conflicting pairs
      expect(checkTraitConflict('confident', 'resilient')).toBe(false);
      expect(checkTraitConflict('bonded', 'calm')).toBe(false);
      expect(checkTraitConflict('presentation_boosted', 'show_calm')).toBe(false);
    });

    it('should not have self-conflicts', () => {
      const allTraits = getTraitsByType('all');

      allTraits.forEach(trait => {
        expect(checkTraitConflict(trait, trait)).toBe(false);
      });
    });
  });

  describe('Task Influence Map Integration', () => {
    it('should have all traits referenced in task influence map', () => {
      const referencedTraits = new Set();

      Object.values(TASK_TRAIT_INFLUENCE_MAP).forEach(influence => {
        influence.traits.forEach(trait => {
          referencedTraits.add(trait);
        });
      });

      referencedTraits.forEach(trait => {
        const metadata = getTraitMetadata(trait);
        expect(metadata).not.toBeNull();
        expect(metadata.description).toBeDefined();
      });
    });

    it('should validate specific task-trait mappings', () => {
      // Desensitization -> confident
      expect(TASK_TRAIT_INFLUENCE_MAP.desensitization.traits).toContain('confident');

      // Trust building -> bonded, resilient
      expect(TASK_TRAIT_INFLUENCE_MAP.trust_building.traits).toContain('bonded');
      expect(TASK_TRAIT_INFLUENCE_MAP.trust_building.traits).toContain('resilient');

      // Sponge bath -> presentation_boosted, show_calm
      expect(TASK_TRAIT_INFLUENCE_MAP.sponge_bath.traits).toContain('presentation_boosted');
      expect(TASK_TRAIT_INFLUENCE_MAP.sponge_bath.traits).toContain('show_calm');

      // Showground exposure -> crowd_ready, confident
      expect(TASK_TRAIT_INFLUENCE_MAP.showground_exposure.traits).toContain('crowd_ready');
      expect(TASK_TRAIT_INFLUENCE_MAP.showground_exposure.traits).toContain('confident');
    });

    it('should have valid daily values for all tasks', () => {
      Object.entries(TASK_TRAIT_INFLUENCE_MAP).forEach(([_task, influence]) => {
        expect(influence.dailyValue).toBeGreaterThan(0);
        expect(influence.dailyValue).toBeLessThanOrEqual(10);
        expect(Array.isArray(influence.traits)).toBe(true);
        expect(influence.traits.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Trait Type Distribution', () => {
    it('should have balanced positive and negative traits', () => {
      const positiveTraits = getTraitsByType('positive');
      const negativeTraits = getTraitsByType('negative');

      expect(positiveTraits.length).toBeGreaterThan(5);
      expect(negativeTraits.length).toBeGreaterThan(3);

      // Should have more positive traits than negative (game design choice)
      expect(positiveTraits.length).toBeGreaterThan(negativeTraits.length);
    });

    it('should have appropriate rarity distribution', () => {
      const allTraits = getTraitsByType('all');
      const commonTraits = allTraits.filter(trait => getTraitMetadata(trait).rarity === 'common');
      const rareTraits = allTraits.filter(trait => getTraitMetadata(trait).rarity === 'rare');
      const legendaryTraits = allTraits.filter(
        trait => getTraitMetadata(trait).rarity === 'legendary',
      );

      expect(commonTraits.length).toBeGreaterThan(rareTraits.length);
      expect(rareTraits.length).toBeGreaterThan(legendaryTraits.length);
      expect(legendaryTraits.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Foal Development Integration', () => {
    it('should support foal milestone evaluation traits', () => {
      const foalTraits = ['confident', 'bonded', 'resilient', 'calm'];

      foalTraits.forEach(trait => {
        const metadata = getTraitMetadata(trait);
        expect(metadata).not.toBeNull();
        expect(metadata.type).toBe('positive');
        expect(['epigenetic', 'bond'].includes(metadata.category)).toBe(true);
      });
    });

    it('should support presentation and show traits', () => {
      const showTraits = ['presentation_boosted', 'show_calm', 'crowd_ready'];

      showTraits.forEach(trait => {
        const metadata = getTraitMetadata(trait);
        expect(metadata).not.toBeNull();
        expect(metadata.type).toBe('positive');
        expect(metadata.category).toBe('situational');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid trait names gracefully', () => {
      expect(getTraitMetadata('invalid_trait')).toBeNull();
      expect(getTraitDefinition('nonexistent')).toBeNull();
      expect(checkTraitConflict('invalid1', 'invalid2')).toBe(false);
    });

    it('should handle empty category queries', () => {
      expect(getTraitsByCategory('invalid_category')).toEqual([]);
      expect(getTraitsByType('invalid_type')).toEqual([]);
    });
  });
});
