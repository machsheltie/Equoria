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
 *
 * 📋 BUSINESS RULES TESTED:
 * - All traits have proper descriptions for UI display
 * - Every roster trait is a care (epigenetic) trait (owner roster 2026-10-27)
 * - Conflict relationships are bidirectional
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
const { getTraitDefinition, getTraitsByType, getTraitsByCategory, getTraitMetadata, checkTraitConflict } = await import(
  join(__dirname, '../../../utils/epigeneticTraits.mjs')
);

describe('Trait Metadata Validation', () => {
  // Owner ruling 2026-10-27 (q117, Equoria-2d55z): the roster is twenty traits,
  // all care (epigenetic) traits. "Do not add what each actually does yet": a
  // trait new to the roster has no description, type or rarity until the owner
  // rules them. The five traits already defined before (confident, resilient,
  // fearful, fragile, eagerLearner) keep their type, rarity and description.
  //
  // Old contract (2026-10-19 roster): presentationBoosted, bonded,
  // easilyOverwhelmed, calm, showCalm and crowdReady existed in bond and
  // situational categories, every trait had a description, and the rarity
  // spread included a legendary trait. The owner removed all of that.
  const ROSTER = [
    'brave',
    'confident',
    'outgoing',
    'affectionate',
    'resilient',
    'fearful',
    'insecure',
    'aloof',
    'fragile',
    'skittish',
    'eagerLearner',
    'peopleTrusting',
    'adaptable',
    'heart',
    'focused',
    'excitable',
    'curious',
    'playful',
    'biddable',
    'competitive',
  ];
  const alreadyDefined = ['confident', 'resilient', 'fearful', 'fragile', 'eagerLearner'];

  describe('Required Trait Structure', () => {
    ROSTER.forEach(trait => {
      it(`should have complete metadata for ${trait}`, () => {
        const metadata = getTraitMetadata(trait);

        expect(metadata).not.toBeNull();
        expect(metadata.name).toBe(trait);
        expect(typeof metadata.label).toBe('string');
        expect(metadata.label).toMatch(/^[A-Z][a-z]+( [A-Z][a-z]+)*$/);
        expect([null, 'positive', 'negative']).toContain(metadata.type);
        expect(metadata.category).toBe('epigenetic');
        expect([null, 'common', 'uncommon', 'rare', 'ultraRare', 'legendary']).toContain(metadata.rarity);
        expect(Array.isArray(metadata.conflicts)).toBe(true);
      });
    });
  });

  describe('Trait Categories', () => {
    it('every roster trait is a care (epigenetic) trait', () => {
      expect(getTraitsByCategory('epigenetic')).toEqual(ROSTER);
      expect(getTraitsByCategory('bond')).toEqual([]);
      expect(getTraitsByCategory('situational')).toEqual([]);
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

      expect(metadata.description).toBe('Takes challenges in stride.');
      expect(metadata.type).toBe('positive');
      expect(metadata.category).toBe('epigenetic');
    });

    it('should have proper description format for fearful trait', () => {
      const metadata = getTraitMetadata('fearful');

      expect(metadata).not.toBeNull();
      expect(metadata.description).toBe('Hesitation or spook-prone behavior under pressure.');
      expect(metadata.type).toBe('negative');
      expect(metadata.category).toBe('epigenetic');
    });

    it('already-defined traits keep a well-formed description; new traits have none yet', () => {
      ROSTER.forEach(trait => {
        const metadata = getTraitMetadata(trait);
        if (alreadyDefined.includes(trait)) {
          expect(metadata.description.length).toBeGreaterThan(5);
          expect(metadata.description).toMatch(/^[A-Z]/); // Starts with capital letter
          expect(metadata.description).toMatch(/\.$/); // Ends with period
        } else {
          expect(metadata.description).toBeNull();
          expect(metadata.type).toBeNull();
          expect(metadata.rarity).toBeNull();
        }
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
      expect(checkTraitConflict('confident', 'fearful')).toBe(true);
      expect(checkTraitConflict('resilient', 'fragile')).toBe(true);

      // Non-conflicting pairs
      expect(checkTraitConflict('confident', 'resilient')).toBe(false);
      expect(checkTraitConflict('heart', 'curious')).toBe(false);
      // Off-roster names conflict with nothing.
      expect(checkTraitConflict('confident', 'nervous')).toBe(false);
    });

    it('should not have self-conflicts', () => {
      const allTraits = getTraitsByType('all');

      allTraits.forEach(trait => {
        expect(checkTraitConflict(trait, trait)).toBe(false);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid trait names gracefully', () => {
      expect(getTraitMetadata('invalidTrait')).toBeNull();
      expect(getTraitDefinition('nonexistent')).toBeNull();
      expect(getTraitDefinition('toString')).toBeNull();
      expect(checkTraitConflict('invalid1', 'invalid2')).toBe(false);
    });

    it('should handle empty category queries', () => {
      expect(getTraitsByCategory('invalidCategory')).toEqual([]);
      expect(getTraitsByType('invalidType')).toEqual([]);
    });
  });
});
