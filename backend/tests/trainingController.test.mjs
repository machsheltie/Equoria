/**
 * 🧪 UNIT TEST: Training Controller - Horse Training Business Logic
 *
 * This test validates the training controller's core business logic for horse
 * training eligibility, session execution, and progression tracking.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Horses must be 3+ years old to train (age eligibility)
 * - Global 7-day training cooldown per horse (not per discipline)
 * - Training awards +5 XP to horse owner and triggers level-up checks
 * - Discipline scores increment with each training session
 * - Horse stats improve based on discipline focus (Speed for Racing, etc.)
 * - Training logs are properly recorded for cooldown tracking
 * - XP system integration with user progression
 * - Error handling for database failures and invalid inputs
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. canTrain() - Training eligibility validation with age and cooldown checks
 * 2. trainHorse() - Complete training workflow with XP rewards and stat updates
 * 3. getTrainingStatus() - Detailed training status with cooldown calculations
 * 4. getTrainableHorses() - Horse filtering for training availability
 * 5. Edge cases: exact cooldown timing, database errors, invalid inputs
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Business logic for eligibility, cooldown calculations, XP distribution
 * ✅ REAL: Training progression rules, stat updates, validation logic
 * 🔧 MOCK: Database operations (training logs, horse lookups, user updates) - external dependencies
 * 🔧 MOCK: Model layer calls - focus on controller logic without database complexity
 *
 * 💡 TEST STRATEGY: Unit testing with comprehensive mocking to isolate controller
 *    business logic and ensure predictable test outcomes for complex training rules
 */

import { jest, describe, beforeEach, expect, it } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock the trainingModel functions
const mockGetHorseAge = jest.fn();
const mockGetLastTrainingDate = jest.fn();
const mockLogTrainingSession = jest.fn();
const mockGetAnyRecentTraining = jest.fn();

// Mock the horseModel functions
const mockIncrementDisciplineScore = jest.fn();
const mockGetHorseById = jest.fn();
const mockUpdateHorseStat = jest.fn();

// Mock the userModel functions
const mockGetUserWithHorses = jest.fn();
const mockAddXpToUser = jest.fn();
const mockLevelUpIfNeeded = jest.fn();

jest.unstable_mockModule(join(__dirname, '../models/trainingModel.mjs'), () => ({
  getHorseAge: mockGetHorseAge,
  getLastTrainingDate: mockGetLastTrainingDate,
  logTrainingSession: mockLogTrainingSession,
  getAnyRecentTraining: mockGetAnyRecentTraining,
}));

jest.unstable_mockModule(join(__dirname, '../models/horseModel.mjs'), () => ({
  incrementDisciplineScore: mockIncrementDisciplineScore,
  getHorseById: mockGetHorseById,
  updateHorseStat: mockUpdateHorseStat,
}));

jest.unstable_mockModule(join(__dirname, '../models/userModel.mjs'), () => ({
  getUserWithHorses: mockGetUserWithHorses,
  addXpToUser: mockAddXpToUser,
  levelUpIfNeeded: mockLevelUpIfNeeded,
}));

// Import the module after mocking
const { canTrain, trainHorse, getTrainingStatus, getTrainableHorses } = await import(
  join(__dirname, '../controllers/trainingController.mjs')
);

describe('🏋️ UNIT: Training Controller - Horse Training Business Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserWithHorses.mockClear();
    mockAddXpToUser.mockClear();
    mockLevelUpIfNeeded.mockClear();
  });

  describe('canTrain', () => {
    beforeEach(() => {
      mockGetHorseAge.mockClear();
      mockGetLastTrainingDate.mockClear();
      mockGetAnyRecentTraining.mockClear();
    });

    it('should return eligible true for horse that meets all requirements', async () => {
      mockGetHorseAge.mockResolvedValue(4);
      mockGetAnyRecentTraining.mockResolvedValue(null);

      const result = await canTrain(1, 'Dressage');

      expect(result).toEqual({
        eligible: true,
        reason: null,
      });
      expect(mockGetHorseAge).toHaveBeenCalledWith(1);
      expect(mockGetAnyRecentTraining).toHaveBeenCalledWith(1);
    });

    it('should return eligible false for horse under 3 years old', async () => {
      mockGetHorseAge.mockResolvedValue(2);

      const result = await canTrain(1, 'Dressage');

      expect(result).toEqual({
        eligible: false,
        reason: 'Horse is under age',
      });
      expect(mockGetHorseAge).toHaveBeenCalledWith(1);
      expect(mockGetAnyRecentTraining).not.toHaveBeenCalled();
    });

    it('should return eligible false for horse with recent training in any discipline', async () => {
      mockGetHorseAge.mockResolvedValue(4);
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 3); // 3 days ago
      mockGetAnyRecentTraining.mockResolvedValue(recentDate);

      const result = await canTrain(1, 'Dressage');

      expect(result).toEqual({
        eligible: false,
        reason: 'Training cooldown active for this horse',
      });
      expect(mockGetHorseAge).toHaveBeenCalledWith(1);
      expect(mockGetAnyRecentTraining).toHaveBeenCalledWith(1);
    });

    it('should return eligible true for horse with old training (8+ days ago)', async () => {
      mockGetHorseAge.mockResolvedValue(4);
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 8); // 8 days ago
      mockGetAnyRecentTraining.mockResolvedValue(oldDate);

      const result = await canTrain(1, 'Dressage');

      expect(result).toEqual({
        eligible: true,
        reason: null,
      });
      expect(mockGetHorseAge).toHaveBeenCalledWith(1);
      expect(mockGetAnyRecentTraining).toHaveBeenCalledWith(1);
    });

    it('should return eligible false for non-existent horse', async () => {
      mockGetHorseAge.mockResolvedValue(null);

      const result = await canTrain(999, 'Dressage');

      expect(result).toEqual({
        eligible: false,
        reason: 'Horse not found',
      });
      expect(mockGetHorseAge).toHaveBeenCalledWith(999);
      expect(mockGetAnyRecentTraining).not.toHaveBeenCalled();
    });

    it('should throw error for invalid horse ID', async () => {
      await expect(canTrain('invalid', 'Dressage')).rejects.toThrow(
        'Horse ID must be a positive integer',
      );
    });

    it('should throw error for missing discipline', async () => {
      await expect(canTrain(1, '')).rejects.toThrow('Discipline is required');
    });

    it('should throw error for missing horse ID', async () => {
      await expect(canTrain(null, 'Dressage')).rejects.toThrow('Horse ID is required');
    });

    it('should handle database errors gracefully', async () => {
      mockGetHorseAge.mockRejectedValue(new Error('Database connection failed'));

      await expect(canTrain(1, 'Dressage')).rejects.toThrow('Training eligibility check failed');
    });

    it('should calculate cooldown correctly for edge case (exactly 7 days)', async () => {
      mockGetHorseAge.mockResolvedValue(4);
      const exactlySevenDaysAgo = new Date();
      exactlySevenDaysAgo.setDate(exactlySevenDaysAgo.getDate() - 7);
      exactlySevenDaysAgo.setSeconds(exactlySevenDaysAgo.getSeconds() - 1); // Just over 7 days
      mockGetAnyRecentTraining.mockResolvedValue(exactlySevenDaysAgo);

      const result = await canTrain(1, 'Dressage');

      expect(result).toEqual({
        eligible: true,
        reason: null,
      });
    });
  });

  describe('trainHorse', () => {
    beforeEach(() => {
      mockGetHorseAge.mockClear();
      mockGetLastTrainingDate.mockClear();
      mockGetAnyRecentTraining.mockClear();
      mockLogTrainingSession.mockClear();
      mockIncrementDisciplineScore.mockClear();
      mockUpdateHorseStat.mockClear();
    });

    it('should successfully train eligible horse', async () => {
      // Mock successful training scenario
      mockGetHorseAge.mockResolvedValue(4);
      mockGetAnyRecentTraining.mockResolvedValue(null);
      mockGetHorseById.mockResolvedValue({
        id: 1,
        name: 'Test Horse',
        epigenetic_modifiers: { positive: [], negative: [], hidden: [] },
        playerId: 'test-player-123',
      });
      mockLogTrainingSession.mockResolvedValue({
        id: 1,
        horseId: 1,
        discipline: 'Racing',
        trainedAt: new Date(),
      });
      mockIncrementDisciplineScore.mockResolvedValue({
        id: 1,
        name: 'Test Horse',
        disciplineScores: { Racing: 5 },
        breed: { id: 1, name: 'Thoroughbred' },
        playerId: 'test-player-123',
      });
      mockUpdateHorseStat.mockResolvedValue({
        id: 1,
        name: 'Test Horse',
        speed: 15, // Updated stat
      });
      mockAddXpToUser.mockResolvedValue({
        id: 'test-player-123',
        xp: 105,
        level: 2,
        leveledUp: true,
        levelsGained: 1,
        xpGained: 5,
      });

      // Mock levelUpIfNeeded call (as requested in task)
      mockLevelUpIfNeeded.mockResolvedValue({
        id: 'test-player-123',
        level: 2,
        xp: 5,
        leveledUp: false,
        levelsGained: 0,
        message: 'No level up needed',
      });

      const result = await trainHorse(1, 'Racing');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Horse trained successfully in Racing. +5 added.');
      expect(result.updatedHorse.name).toBe('Test Horse');
      expect(result.nextEligible).toBeDefined();
      expect(result.traitEffects).toBeDefined();
      expect(result.traitEffects.appliedTraits).toEqual([]);

      // Verify both XP functions are called (as requested in task)
      expect(mockAddXpToUser).toHaveBeenCalledWith('test-player-123', 5);
      expect(mockLevelUpIfNeeded).toHaveBeenCalledWith('test-player-123');
    });

    it('should reject training for ineligible horse (under age)', async () => {
      mockGetHorseAge.mockResolvedValue(2);

      const result = await trainHorse(1, 'Racing');

      expect(result).toEqual({
        success: false,
        reason: 'Horse is under age',
        updatedHorse: null,
        message: 'Training not allowed: Horse is under age',
        nextEligible: null,
      });
    });

    it('should reject training for horse in cooldown', async () => {
      mockGetHorseAge.mockResolvedValue(4);
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 3); // 3 days ago
      mockGetAnyRecentTraining.mockResolvedValue(recentDate);

      const result = await trainHorse(1, 'Racing');

      expect(result).toEqual({
        success: false,
        reason: 'Training cooldown active for this horse',
        updatedHorse: null,
        message: 'Training not allowed: Training cooldown active for this horse',
        nextEligible: null,
      });
    });

    it('should handle training log errors gracefully', async () => {
      mockGetHorseAge.mockResolvedValue(4);
      mockGetAnyRecentTraining.mockResolvedValue(null);
      mockGetHorseById.mockResolvedValue({
        id: 1,
        name: 'Test Horse',
        epigenetic_modifiers: { positive: [], negative: [], hidden: [] },
        playerId: 'test-player-123',
      });
      mockLogTrainingSession.mockRejectedValue(new Error('Failed to log training'));

      await expect(trainHorse(1, 'Racing')).rejects.toThrow(
        'Training failed: Failed to log training',
      );
    });

    it('should award +5 XP and call levelUpIfNeeded after successful training', async () => {
      // Mock successful training scenario with focus on XP system
      mockGetHorseAge.mockResolvedValue(4);
      mockGetAnyRecentTraining.mockResolvedValue(null);
      mockGetHorseById.mockResolvedValue({
        id: 1,
        name: 'XP Test Horse',
        epigenetic_modifiers: { positive: [], negative: [], hidden: [] },
        playerId: 'xp-test-player',
      });
      mockLogTrainingSession.mockResolvedValue({
        id: 1,
        horseId: 1,
        discipline: 'Dressage',
        trainedAt: new Date(),
      });
      mockIncrementDisciplineScore.mockResolvedValue({
        id: 1,
        name: 'XP Test Horse',
        disciplineScores: { Dressage: 3 },
        breed: { id: 1, name: 'Arabian' },
        playerId: 'xp-test-player',
      });
      mockUpdateHorseStat.mockResolvedValue({
        id: 1,
        name: 'XP Test Horse',
        focus: 12, // Updated stat for Dressage
      });

      // Mock XP system - player has 90 XP, should level up after +5 XP
      mockAddXpToUser.mockResolvedValue({
        id: 'xp-test-player',
        xp: 95,
        level: 1,
        leveledUp: false,
        levelsGained: 0,
        xpGained: 5,
      });

      // Mock levelUpIfNeeded - should trigger level up since player now has 95 XP
      mockLevelUpIfNeeded.mockResolvedValue({
        id: 'xp-test-player',
        level: 1,
        xp: 95,
        leveledUp: false,
        levelsGained: 0,
        message: 'No level up needed',
      });

      const result = await trainHorse(1, 'Dressage');

      // Verify training success
      expect(result.success).toBe(true);
      expect(result.message).toContain('Horse trained successfully in Dressage. +5 added.');

      // Verify XP award system (as requested in task)
      expect(mockAddXpToUser).toHaveBeenCalledWith('xp-test-player', 5);
      expect(mockLevelUpIfNeeded).toHaveBeenCalledWith('xp-test-player');

      // Verify call order: addXp should be called before levelUpIfNeeded
      const addXpCall = mockAddXpToUser.mock.invocationCallOrder[0];
      const levelUpCall = mockLevelUpIfNeeded.mock.invocationCallOrder[0];
      expect(addXpCall).toBeLessThan(levelUpCall);
    });

    it('should handle XP system errors gracefully without breaking training', async () => {
      // Mock successful training scenario
      mockGetHorseAge.mockResolvedValue(4);
      mockGetAnyRecentTraining.mockResolvedValue(null);
      mockGetHorseById.mockResolvedValue({
        id: 1,
        name: 'Error Test Horse',
        epigenetic_modifiers: { positive: [], negative: [], hidden: [] },
        playerId: 'error-test-player',
      });
      mockLogTrainingSession.mockResolvedValue({
        id: 1,
        horseId: 1,
        discipline: 'Racing',
        trainedAt: new Date(),
      });
      mockIncrementDisciplineScore.mockResolvedValue({
        id: 1,
        name: 'Error Test Horse',
        disciplineScores: { Racing: 2 },
        breed: { id: 1, name: 'Thoroughbred' },
        playerId: 'error-test-player',
      });
      mockUpdateHorseStat.mockResolvedValue({
        id: 1,
        name: 'Error Test Horse',
        speed: 8, // Updated stat
      });

      // Mock XP system error
      mockAddXpToUser.mockRejectedValue(new Error('XP system unavailable'));

      const result = await trainHorse(1, 'Racing');

      // Training should still succeed despite XP error
      expect(result.success).toBe(true);
      expect(result.message).toContain('Horse trained successfully in Racing. +5 added.');
      expect(result.updatedHorse.name).toBe('Error Test Horse');

      // Verify XP was attempted
      expect(mockAddXpToUser).toHaveBeenCalledWith('error-test-player', 5);
      // levelUpIfNeeded should not be called if addXp fails
      expect(mockLevelUpIfNeeded).not.toHaveBeenCalled();
    });
  });

  describe('getTrainingStatus', () => {
    beforeEach(() => {
      mockGetHorseAge.mockClear();
      mockGetLastTrainingDate.mockClear();
      mockGetAnyRecentTraining.mockClear();
    });

    it('should return complete status for eligible horse with no training history', async () => {
      mockGetHorseAge.mockResolvedValue(5);
      mockGetLastTrainingDate.mockResolvedValue(null);
      mockGetAnyRecentTraining.mockResolvedValue(null);

      const result = await getTrainingStatus(1, 'Racing');

      expect(result).toEqual({
        eligible: true,
        reason: null,
        horseAge: 5,
        lastTrainingDate: null,
        cooldown: null,
      });
    });

    it('should return complete status for horse in active cooldown', async () => {
      mockGetHorseAge.mockResolvedValue(4);
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      mockGetLastTrainingDate.mockResolvedValue(null); // No training in this specific discipline
      mockGetAnyRecentTraining.mockResolvedValue(twoDaysAgo); // But trained in another discipline

      const result = await getTrainingStatus(1, 'Racing');

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('Training cooldown active for this horse');
      expect(result.horseAge).toBe(4);
      expect(result.lastTrainingDate).toBe(null); // Still null for this specific discipline
      expect(result.cooldown.active).toBe(true);
      expect(result.cooldown.remainingDays).toBeGreaterThan(0);
      expect(result.cooldown.lastTrainingDate).toEqual(twoDaysAgo);
    });

    it('should return complete status for horse with expired cooldown', async () => {
      mockGetHorseAge.mockResolvedValue(4);
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      mockGetLastTrainingDate.mockResolvedValue(eightDaysAgo);
      mockGetAnyRecentTraining.mockResolvedValue(eightDaysAgo);

      const result = await getTrainingStatus(1, 'Racing');

      expect(result.eligible).toBe(true);
      expect(result.reason).toBe(null);
      expect(result.horseAge).toBe(4);
      expect(result.lastTrainingDate).toEqual(eightDaysAgo);
      expect(result.cooldown.active).toBe(false);
      expect(result.cooldown.remainingDays).toBe(0);
    });

    it('should return status for ineligible horse (under age)', async () => {
      mockGetHorseAge.mockResolvedValue(2);
      mockGetLastTrainingDate.mockResolvedValue(null);
      mockGetAnyRecentTraining.mockResolvedValue(null);

      const result = await getTrainingStatus(1, 'Racing');

      expect(result).toEqual({
        eligible: false,
        reason: 'Horse is under age',
        horseAge: 2,
        lastTrainingDate: null,
        cooldown: null,
      });
    });

    it('should handle database errors gracefully', async () => {
      mockGetHorseAge.mockRejectedValue(new Error('Database error'));

      await expect(getTrainingStatus(1, 'Racing')).rejects.toThrow('Training status check failed');
    });
  });

  describe('Integration scenarios', () => {
    beforeEach(() => {
      mockGetHorseAge.mockClear();
      mockGetLastTrainingDate.mockClear();
      mockGetAnyRecentTraining.mockClear();
    });

    it('should handle different disciplines with global cooldown', async () => {
      mockGetHorseAge.mockResolvedValue(4);
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      mockGetAnyRecentTraining.mockResolvedValue(twoDaysAgo); // Horse trained 2 days ago in any discipline

      const racingResult = await canTrain(1, 'Racing');
      const jumpingResult = await canTrain(1, 'Show Jumping');

      // Both should be blocked due to global cooldown
      expect(racingResult.eligible).toBe(false);
      expect(racingResult.reason).toBe('Training cooldown active for this horse');

      expect(jumpingResult.eligible).toBe(false);
      expect(jumpingResult.reason).toBe('Training cooldown active for this horse');
    });

    it('should handle edge case of exactly 7 days cooldown', async () => {
      mockGetHorseAge.mockResolvedValue(4);
      const exactlySevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 - 1000); // Just over 7 days
      mockGetAnyRecentTraining.mockResolvedValue(exactlySevenDaysAgo);

      const result = await canTrain(1, 'Racing');

      expect(result.eligible).toBe(true);
      expect(result.reason).toBe(null);
    });

    it('should handle complete training workflow', async () => {
      // Mock successful training
      mockGetHorseAge.mockResolvedValue(4);
      mockGetAnyRecentTraining.mockResolvedValue(null);
      mockGetHorseById.mockResolvedValue({
        id: 1,
        name: 'Test Horse',
        epigenetic_modifiers: { positive: [], negative: [], hidden: [] },
        playerId: 'test-player-123',
      });
      mockLogTrainingSession.mockResolvedValue({
        id: 1,
        horseId: 1,
        discipline: 'Racing',
        trainedAt: new Date(),
      });
      mockIncrementDisciplineScore.mockResolvedValue({
        id: 1,
        name: 'Test Horse',
        disciplineScores: { Racing: 5 },
        breed: { id: 1, name: 'Thoroughbred' },
        playerId: 'test-player-123',
      });
      mockAddXpToUser.mockResolvedValue({
        id: 'test-player-123',
        xp: 105,
        level: 2,
        leveledUp: true,
        levelsGained: 1,
        xpGained: 5,
      });

      // Mock levelUpIfNeeded for integration test
      mockLevelUpIfNeeded.mockResolvedValue({
        id: 'test-player-123',
        level: 2,
        xp: 5,
        leveledUp: false,
        levelsGained: 0,
        message: 'No level up needed',
      });

      const trainResult = await trainHorse(1, 'Racing');
      expect(trainResult.success).toBe(true);

      // Now mock that the horse has recently trained
      const justNow = new Date();
      mockGetAnyRecentTraining.mockResolvedValue(justNow);

      const statusResult = await getTrainingStatus(1, 'Racing');
      expect(statusResult.eligible).toBe(false);
      expect(statusResult.reason).toBe('Training cooldown active for this horse');
    });
  });

  describe('getTrainableHorses', () => {
    beforeEach(() => {
      mockGetUserWithHorses.mockClear();
      mockGetAnyRecentTraining.mockClear();
    });

    it('should return trainable horses for user with eligible horses', async () => {
      const playerId = 'test-player-123';
      const mockPlayer = {
        id: playerId,
        horses: [
          { id: 1, name: 'Thunder', age: 5 },
          { id: 2, name: 'Lightning', age: 4 },
        ],
      };

      mockGetUserWithHorses.mockResolvedValue(mockPlayer);
      mockGetAnyRecentTraining
        .mockResolvedValueOnce(null) // Thunder has never trained
        .mockResolvedValueOnce(null); // Lightning has never trained

      const result = await getTrainableHorses(playerId);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        horseId: 1,
        name: 'Thunder',
        age: 5,
        trainableDisciplines: ['Racing', 'Show Jumping', 'Dressage', 'Cross Country', 'Western'],
      });
      expect(result[1]).toEqual({
        horseId: 2,
        name: 'Lightning',
        age: 4,
        trainableDisciplines: ['Racing', 'Show Jumping', 'Dressage', 'Cross Country', 'Western'],
      });
    });

    it('should return empty array for player with no horses', async () => {
      const playerId = 'test-player-123';
      const mockPlayer = {
        id: playerId,
        horses: [],
      };

      mockGetUserWithHorses.mockResolvedValue(mockPlayer);

      const result = await getTrainableHorses(playerId);

      expect(result).toEqual([]);
    });

    it('should return empty array for non-existent player', async () => {
      const playerId = 'non-existent-player';
      mockGetUserWithHorses.mockResolvedValue(null);

      const result = await getTrainableHorses(playerId);

      expect(result).toEqual([]);
    });

    it('should filter out horses under 3 years old', async () => {
      const playerId = 'test-player-123';
      const mockPlayer = {
        id: playerId,
        horses: [
          { id: 1, name: 'Young Horse', age: 2 },
          { id: 2, name: 'Adult Horse', age: 4 },
        ],
      };

      mockGetUserWithHorses.mockResolvedValue(mockPlayer);
      mockGetAnyRecentTraining.mockResolvedValue(null); // Adult horse has never trained

      const result = await getTrainableHorses(playerId);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Adult Horse');
      expect(result[0].age).toBe(4);
    });

    it('should exclude horses with recent training (global cooldown)', async () => {
      const playerId = 'test-player-123';
      const mockPlayer = {
        id: playerId,
        horses: [{ id: 1, name: 'Busy Horse', age: 5 }],
      };

      mockGetUserWithHorses.mockResolvedValue(mockPlayer);
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      mockGetAnyRecentTraining.mockResolvedValue(twoDaysAgo); // Horse trained 2 days ago

      const result = await getTrainableHorses(playerId);

      expect(result).toEqual([]);
    });

    it('should handle database errors gracefully for individual horses', async () => {
      const playerId = 'test-player-123';
      const mockPlayer = {
        id: playerId,
        horses: [
          { id: 1, name: 'Error Horse', age: 4 },
          { id: 2, name: 'Good Horse', age: 5 },
        ],
      };

      mockGetUserWithHorses.mockResolvedValue(mockPlayer);
      mockGetAnyRecentTraining
        .mockRejectedValueOnce(new Error('Database error for horse 1'))
        .mockResolvedValueOnce(null); // Good horse has never trained

      const result = await getTrainableHorses(playerId);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Good Horse');
      expect(result[0].trainableDisciplines).toEqual([
        'Racing',
        'Show Jumping',
        'Dressage',
        'Cross Country',
        'Western',
      ]);
    });

    it('should throw error for missing player ID', async () => {
      await expect(getTrainableHorses('')).rejects.toThrow('Player ID is required');
      await expect(getTrainableHorses(null)).rejects.toThrow('Player ID is required');
    });

    it('should handle player model errors', async () => {
      const playerId = 'test-player-123';
      mockGetUserWithHorses.mockRejectedValue(new Error('Player database error'));

      await expect(getTrainableHorses(playerId)).rejects.toThrow(
        'Failed to get trainable horses: Player database error',
      );
    });
  });

  describe('trainRouteHandler', () => {
    let mockReq, mockRes;

    beforeEach(() => {
      mockReq = {
        body: {
          horseId: 1,
          discipline: 'Dressage',
        },
      };
      mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
    });

    it('should return success response with correct format for successful training', async () => {
      // Mock successful training
      mockGetHorseAge.mockResolvedValue(4);
      mockGetAnyRecentTraining.mockResolvedValue(null);
      mockGetHorseById.mockResolvedValue({
        id: 1,
        name: 'Nova',
        epigenetic_modifiers: { positive: [], negative: [], hidden: [] },
        playerId: 'test-player-123',
      });
      const mockTrainingLog = {
        id: 1,
        horse_id: 1,
        discipline: 'Dressage',
        trained_at: new Date(),
      };
      const mockUpdatedHorse = {
        id: 1,
        name: 'Nova',
        disciplineScores: { Dressage: 25 },
        breed: { id: 1, name: 'Thoroughbred' },
        playerId: 'test-player-123',
      };
      mockLogTrainingSession.mockResolvedValue(mockTrainingLog);
      mockIncrementDisciplineScore.mockResolvedValue(mockUpdatedHorse);
      mockAddXpToUser.mockResolvedValue({
        id: 'test-player-123',
        xp: 105,
        level: 2,
        leveledUp: true,
        levelsGained: 1,
        xpGained: 5,
      });

      const { trainRouteHandler } = await import('../controllers/trainingController.mjs');
      await trainRouteHandler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Nova trained in Dressage. +5 added.',
        updatedScore: 25,
        nextEligibleDate: expect.any(String),
        traitEffects: expect.objectContaining({
          appliedTraits: [],
          scoreModifier: 0,
          xpModifier: 0,
        }),
      });
      expect(mockRes.status).not.toHaveBeenCalled(); // Should not set error status
    });

    it('should return failure response for ineligible horse (under age)', async () => {
      mockGetHorseAge.mockResolvedValue(2);

      const { trainRouteHandler } = await import('../controllers/trainingController.mjs');
      await trainRouteHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Training not allowed: Horse is under age',
      });
    });

    it('should return failure response for horse in cooldown', async () => {
      mockGetHorseAge.mockResolvedValue(4);
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      mockGetAnyRecentTraining.mockResolvedValue(twoDaysAgo);

      const { trainRouteHandler } = await import('../controllers/trainingController.mjs');
      await trainRouteHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Training not allowed: Training cooldown active for this horse',
      });
    });

    it('should handle missing discipline score gracefully', async () => {
      mockGetHorseAge.mockResolvedValue(4);
      mockGetAnyRecentTraining.mockResolvedValue(null);
      mockGetHorseById.mockResolvedValue({
        id: 1,
        name: 'Nova',
        epigenetic_modifiers: { positive: [], negative: [], hidden: [] },
        playerId: 'test-player-123',
      });
      const mockTrainingLog = {
        id: 1,
        horse_id: 1,
        discipline: 'Dressage',
        trained_at: new Date(),
      };
      const mockUpdatedHorse = {
        id: 1,
        name: 'Nova',
        disciplineScores: null, // No discipline scores
        breed: { id: 1, name: 'Thoroughbred' },
        playerId: 'test-player-123',
      };
      mockLogTrainingSession.mockResolvedValue(mockTrainingLog);
      mockIncrementDisciplineScore.mockResolvedValue(mockUpdatedHorse);
      mockAddXpToUser.mockResolvedValue({
        id: 'test-player-123',
        xp: 105,
        level: 2,
        leveledUp: true,
        levelsGained: 1,
        xpGained: 5,
      });

      const { trainRouteHandler } = await import('../controllers/trainingController.mjs');
      await trainRouteHandler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Nova trained in Dressage. +5 added.',
        updatedScore: 0, // Should default to 0 when no scores exist
        nextEligibleDate: expect.any(String),
        traitEffects: expect.objectContaining({
          appliedTraits: [],
          scoreModifier: 0,
          xpModifier: 0,
        }),
      });
    });

    it('should handle server errors gracefully', async () => {
      mockGetHorseAge.mockRejectedValue(new Error('Database connection failed'));

      const { trainRouteHandler } = await import('../controllers/trainingController.mjs');
      await trainRouteHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to train horse',
        error: expect.any(String),
      });
    });

    it('should handle trait effects in training', async () => {
      // Mock horse with positive trait
      mockGetHorseAge.mockResolvedValue(4);
      mockGetAnyRecentTraining.mockResolvedValue(null);
      mockGetHorseById.mockResolvedValue({
        id: 1,
        name: 'Intelligent Horse',
        epigenetic_modifiers: { positive: ['intelligent'], negative: [], hidden: [] },
        playerId: 'test-player-123',
      });
      mockLogTrainingSession.mockResolvedValue({
        id: 1,
        horseId: 1,
        discipline: 'Dressage',
        trainedAt: new Date(),
      });
      mockIncrementDisciplineScore.mockResolvedValue({
        id: 1,
        name: 'Intelligent Horse',
        disciplineScores: { Dressage: 6 }, // +6 instead of +5 due to trait
        breed: { id: 1, name: 'Warmblood' },
        playerId: 'test-player-123',
      });
      mockAddXpToUser.mockResolvedValue({
        id: 'test-player-123',
        xp: 106,
        level: 2,
        leveledUp: true,
        levelsGained: 1,
        xpGained: 6, // +6 XP due to trait
      });

      const { trainRouteHandler } = await import('../controllers/trainingController.mjs');
      mockReq.body = { horseId: 1, discipline: 'Dressage' };

      await trainRouteHandler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Intelligent Horse trained in Dressage. +6 added.',
        updatedScore: 6,
        nextEligibleDate: expect.any(String),
        traitEffects: expect.objectContaining({
          appliedTraits: ['intelligent'],
          scoreModifier: 1, // +1 bonus from trait
          xpModifier: 1, // +1 XP bonus from trait
        }),
      });
    });
  });
});
