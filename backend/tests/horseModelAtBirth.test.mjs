/**
 * 🧪 UNIT TEST: Horse Model At-Birth Traits - Creation Integration Testing
 *
 * This test validates the horse creation process with at-birth trait application
 * using comprehensive mocking to isolate the horse model logic.
 *
 * 📋 BUSINESS RULES TESTED:
 * - At-birth trait application: Only for newborn foals (age 0) with both parents
 * - Trait merging logic: Existing traits combined with at-birth traits
 * - Environmental factors: Mare stress and feed quality affect trait generation
 * - Error handling: Graceful fallback when trait application fails
 * - Parent validation: Both sire and dam required for trait application
 * - Age restrictions: No at-birth traits for horses older than 0
 * - Breeding analysis logging: Lineage specialization and inbreeding detection
 * - Database integration: Proper Prisma create calls with trait data
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. createHorse() - Complete horse creation with trait integration
 * 2. At-birth trait application conditions and validation
 * 3. Trait merging: Existing + at-birth traits combination
 * 4. Environmental parameter passing: mareStress, feedQuality
 * 5. Error handling: Failed trait application doesn't break creation
 * 6. Edge cases: Missing parents, older horses, foundling horses
 * 7. Logging integration: Breeding analysis information capture
 * 8. Database operations: Proper Prisma calls with correct data structure
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Horse creation logic, trait merging algorithms, validation rules
 * ✅ REAL: Business rule enforcement, error handling, data structure management
 * 🔧 MOCK: Database operations (Prisma), external trait calculation service, logger
 * 🔧 MOCK: At-birth trait generation - external dependency with complex calculations
 *
 * 💡 TEST STRATEGY: Unit testing with strategic mocking of external dependencies
 *    while preserving core business logic validation and integration workflows
 *
 * ⚠️  NOTE: This represents GOOD balanced mocking - mocks external services while
 *    testing real business logic, data flow, and integration patterns.
 */

import { jest, describe, beforeEach, afterEach, expect, it } from '@jest/globals';

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock dependencies
const mockPrisma = {
  horse: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  competitionResult: {
    findMany: jest.fn(),
  },
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

const mockAtBirthTraits = {
  applyEpigeneticTraitsAtBirth: jest.fn(),
};

// Mock the imports
jest.unstable_mockModule(join(__dirname, '../db/index.js'), () => ({
  default: mockPrisma,
}));

jest.unstable_mockModule(join(__dirname, '../utils/logger.mjs'), () => ({
  default: mockLogger,
}));

jest.unstable_mockModule(join(__dirname, '../utils/atBirthTraits.js'), () => mockAtBirthTraits);

// Import the function after mocking
const { createHorse } = await import(join(__dirname, '../models/horseModel.js'));

describe('🐴 UNIT: Horse Model At-Birth Traits - Creation Integration Testing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('createHorse with at-birth traits', () => {
    const mockCreatedHorse = {
      id: 1,
      name: 'Test Foal',
      age: 0,
      sireId: 10,
      damId: 20,
      epigeneticModifiers: {
        positive: ['hardy'],
        negative: [],
        hidden: [],
      },
      breed: { id: 1, name: 'Thoroughbred' },
    };

    it('should apply at-birth traits for newborn with parents', async () => {
      const horseData = {
        name: 'Test Foal',
        age: 0,
        breedId: 1,
        sireId: 10,
        damId: 20,
      };

      const mockAtBirthResult = {
        traits: {
          positive: ['hardy'],
          negative: [],
          hidden: [],
        },
        breedingAnalysis: {
          lineage: { disciplineSpecialization: false },
          inbreeding: { inbreedingDetected: false },
          conditions: { mareStress: 25, feedQuality: 70 },
        },
      };

      mockAtBirthTraits.applyEpigeneticTraitsAtBirth.mockResolvedValue(mockAtBirthResult);
      mockPrisma.horse.create.mockResolvedValue(mockCreatedHorse);

      const result = await createHorse(horseData);

      expect(mockAtBirthTraits.applyEpigeneticTraitsAtBirth).toHaveBeenCalledWith({
        sireId: 10,
        damId: 20,
        mareStress: undefined,
        feedQuality: undefined,
      });

      expect(mockPrisma.horse.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Test Foal',
          age: 0,
          breedId: 1,
          sireId: 10,
          damId: 20,
          epigeneticModifiers: {
            positive: ['hardy'],
            negative: [],
            hidden: [],
          },
        }),
        include: {
          breed: true,
          user: true,
          stable: true,
        },
      });

      expect(result).toEqual(mockCreatedHorse);
    });

    it('should pass custom mare stress and feed quality', async () => {
      const horseData = {
        name: 'Test Foal',
        age: 0,
        breedId: 1,
        sireId: 10,
        damId: 20,
        mareStress: 15,
        feedQuality: 85,
      };

      const mockAtBirthResult = {
        traits: {
          positive: ['hardy', 'premium_care'],
          negative: [],
          hidden: [],
        },
        breedingAnalysis: {
          lineage: { disciplineSpecialization: false },
          inbreeding: { inbreedingDetected: false },
          conditions: { mareStress: 15, feedQuality: 85 },
        },
      };

      mockAtBirthTraits.applyEpigeneticTraitsAtBirth.mockResolvedValue(mockAtBirthResult);
      mockPrisma.horse.create.mockResolvedValue({
        ...mockCreatedHorse,
        epigeneticModifiers: mockAtBirthResult.traits,
      });

      await createHorse(horseData);

      expect(mockAtBirthTraits.applyEpigeneticTraitsAtBirth).toHaveBeenCalledWith({
        sireId: 10,
        damId: 20,
        mareStress: 15,
        feedQuality: 85,
      });
    });

    it('should merge at-birth traits with existing traits', async () => {
      const horseData = {
        name: 'Test Foal',
        age: 0,
        breedId: 1,
        sireId: 10,
        damId: 20,
        epigeneticModifiers: {
          positive: ['existing_trait'],
          negative: ['existing_negative'],
          hidden: [],
        },
      };

      const mockAtBirthResult = {
        traits: {
          positive: ['hardy'],
          negative: [],
          hidden: ['hidden_trait'],
        },
        breedingAnalysis: {},
      };

      mockAtBirthTraits.applyEpigeneticTraitsAtBirth.mockResolvedValue(mockAtBirthResult);
      mockPrisma.horse.create.mockResolvedValue(mockCreatedHorse);

      await createHorse(horseData);

      expect(mockPrisma.horse.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          epigeneticModifiers: {
            positive: ['existing_trait', 'hardy'],
            negative: ['existing_negative'],
            hidden: ['hidden_trait'],
          },
        }),
        include: expect.any(Object),
      });
    });

    it('should not apply at-birth traits for older horses', async () => {
      const horseData = {
        name: 'Adult Horse',
        age: 5,
        breedId: 1,
        sireId: 10,
        damId: 20,
      };

      mockPrisma.horse.create.mockResolvedValue({
        ...mockCreatedHorse,
        name: 'Adult Horse',
        age: 5,
      });

      await createHorse(horseData);

      expect(mockAtBirthTraits.applyEpigeneticTraitsAtBirth).not.toHaveBeenCalled();

      expect(mockPrisma.horse.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          epigeneticModifiers: { positive: [], negative: [], hidden: [] },
        }),
        include: expect.any(Object),
      });
    });

    it('should not apply at-birth traits for horses without parents', async () => {
      const horseData = {
        name: 'Foundling Horse',
        age: 0,
        breedId: 1,
      };

      mockPrisma.horse.create.mockResolvedValue({
        ...mockCreatedHorse,
        name: 'Foundling Horse',
        sireId: null,
        damId: null,
      });

      await createHorse(horseData);

      expect(mockAtBirthTraits.applyEpigeneticTraitsAtBirth).not.toHaveBeenCalled();
    });

    it('should continue horse creation even if at-birth trait application fails', async () => {
      const horseData = {
        name: 'Test Foal',
        age: 0,
        breedId: 1,
        sireId: 10,
        damId: 20,
      };

      mockAtBirthTraits.applyEpigeneticTraitsAtBirth.mockRejectedValue(
        new Error('Trait application failed'),
      );
      mockPrisma.horse.create.mockResolvedValue(mockCreatedHorse);

      const result = await createHorse(horseData);

      expect(mockPrisma.horse.create).toHaveBeenCalled();
      expect(result).toEqual(mockCreatedHorse);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error applying at-birth traits: Trait application failed'),
      );
    });

    it('should handle missing sireId gracefully', async () => {
      const horseData = {
        name: 'Test Foal',
        age: 0,
        breedId: 1,
        damId: 20,
      };

      mockPrisma.horse.create.mockResolvedValue(mockCreatedHorse);

      await createHorse(horseData);

      expect(mockAtBirthTraits.applyEpigeneticTraitsAtBirth).not.toHaveBeenCalled();
    });

    it('should handle missing damId gracefully', async () => {
      const horseData = {
        name: 'Test Foal',
        age: 0,
        breedId: 1,
        sireId: 10,
      };

      mockPrisma.horse.create.mockResolvedValue(mockCreatedHorse);

      await createHorse(horseData);

      expect(mockAtBirthTraits.applyEpigeneticTraitsAtBirth).not.toHaveBeenCalled();
    });

    it('should log breeding analysis information', async () => {
      const horseData = {
        name: 'Test Foal',
        age: 0,
        breedId: 1,
        sireId: 10,
        damId: 20,
      };

      const mockAtBirthResult = {
        traits: {
          positive: ['specialized_lineage'],
          negative: ['inbred'],
          hidden: [],
        },
        breedingAnalysis: {
          lineage: {
            disciplineSpecialization: true,
            specializedDiscipline: 'Racing',
          },
          inbreeding: {
            inbreedingDetected: true,
            commonAncestors: [{ id: 100, name: 'CommonAncestor' }],
          },
          conditions: { mareStress: 25, feedQuality: 70 },
        },
      };

      mockAtBirthTraits.applyEpigeneticTraitsAtBirth.mockResolvedValue(mockAtBirthResult);
      mockPrisma.horse.create.mockResolvedValue(mockCreatedHorse);

      await createHorse(horseData);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'Breeding analysis - Lineage specialization: true, Inbreeding: true',
        ),
      );
    });
  });
});
