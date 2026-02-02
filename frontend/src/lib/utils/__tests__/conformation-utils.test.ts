/**
 * Tests for Conformation Scoring Utilities
 *
 * Tests cover:
 * - Quality rating calculations with boundary conditions
 * - Overall score calculations with various inputs
 * - Breed comparison logic with edge cases
 * - Score formatting with decimals and integers
 * - Region descriptions and validation
 *
 * Story 3-5: Conformation Scoring UI - Task 1
 */

import { describe, it, expect } from 'vitest';
import {
  getQualityRating,
  calculateOverallScore,
  getBreedComparison,
  formatScore,
  getRegionDescription,
  getRegionDisplayName,
  isValidConformation,
  getScoreColor,
  type ConformationScores,
} from '../conformation-utils';

describe('conformation-utils', () => {
  describe('getQualityRating', () => {
    it('should return Excellent for scores 90-100', () => {
      expect(getQualityRating(90).label).toBe('Excellent');
      expect(getQualityRating(95).label).toBe('Excellent');
      expect(getQualityRating(100).label).toBe('Excellent');
    });

    it('should return Very Good for scores 80-89', () => {
      expect(getQualityRating(80).label).toBe('Very Good');
      expect(getQualityRating(85).label).toBe('Very Good');
      expect(getQualityRating(89).label).toBe('Very Good');
      expect(getQualityRating(89.9).label).toBe('Very Good');
    });

    it('should return Good for scores 70-79', () => {
      expect(getQualityRating(70).label).toBe('Good');
      expect(getQualityRating(75).label).toBe('Good');
      expect(getQualityRating(79).label).toBe('Good');
      expect(getQualityRating(79.9).label).toBe('Good');
    });

    it('should return Average for scores 60-69', () => {
      expect(getQualityRating(60).label).toBe('Average');
      expect(getQualityRating(65).label).toBe('Average');
      expect(getQualityRating(69).label).toBe('Average');
      expect(getQualityRating(69.9).label).toBe('Average');
    });

    it('should return Below Average for scores 50-59', () => {
      expect(getQualityRating(50).label).toBe('Below Average');
      expect(getQualityRating(55).label).toBe('Below Average');
      expect(getQualityRating(59).label).toBe('Below Average');
      expect(getQualityRating(59.9).label).toBe('Below Average');
    });

    it('should return Poor for scores 0-49', () => {
      expect(getQualityRating(0).label).toBe('Poor');
      expect(getQualityRating(25).label).toBe('Poor');
      expect(getQualityRating(49).label).toBe('Poor');
      expect(getQualityRating(49.9).label).toBe('Poor');
    });

    it('should clamp negative scores to 0 (Poor)', () => {
      expect(getQualityRating(-1).label).toBe('Poor');
      expect(getQualityRating(-100).label).toBe('Poor');
    });

    it('should clamp scores above 100 to 100 (Excellent)', () => {
      expect(getQualityRating(101).label).toBe('Excellent');
      expect(getQualityRating(200).label).toBe('Excellent');
    });

    it('should return correct color classes for each rating', () => {
      expect(getQualityRating(95).color).toBe('text-emerald-700');
      expect(getQualityRating(85).color).toBe('text-blue-700');
      expect(getQualityRating(75).color).toBe('text-amber-700');
      expect(getQualityRating(65).color).toBe('text-slate-700');
      expect(getQualityRating(55).color).toBe('text-orange-700');
      expect(getQualityRating(45).color).toBe('text-rose-700');
    });

    it('should return correct background color classes for each rating', () => {
      expect(getQualityRating(95).bgColor).toContain('bg-emerald-50');
      expect(getQualityRating(85).bgColor).toContain('bg-blue-50');
      expect(getQualityRating(75).bgColor).toContain('bg-amber-50');
      expect(getQualityRating(65).bgColor).toContain('bg-slate-50');
      expect(getQualityRating(55).bgColor).toContain('bg-orange-50');
      expect(getQualityRating(45).bgColor).toContain('bg-rose-50');
    });
  });

  describe('calculateOverallScore', () => {
    it('should calculate average of all 7 regions', () => {
      const conformation: ConformationScores = {
        head: 70,
        neck: 70,
        shoulder: 70,
        back: 70,
        hindquarters: 70,
        legs: 70,
        hooves: 70,
      };
      expect(calculateOverallScore(conformation)).toBe(70);
    });

    it('should handle mixed scores correctly', () => {
      const conformation: ConformationScores = {
        head: 85,
        neck: 90,
        shoulder: 75,
        back: 80,
        hindquarters: 95,
        legs: 70,
        hooves: 85,
      };
      // (85 + 90 + 75 + 80 + 95 + 70 + 85) / 7 = 580 / 7 = 82.857... rounds to 82.9
      expect(calculateOverallScore(conformation)).toBe(82.9);
    });

    it('should round to 1 decimal place', () => {
      const conformation: ConformationScores = {
        head: 85,
        neck: 86,
        shoulder: 87,
        back: 88,
        hindquarters: 89,
        legs: 90,
        hooves: 91,
      };
      // (85+86+87+88+89+90+91) / 7 = 616 / 7 = 88.0
      expect(calculateOverallScore(conformation)).toBe(88);
    });

    it('should handle all perfect scores', () => {
      const conformation: ConformationScores = {
        head: 100,
        neck: 100,
        shoulder: 100,
        back: 100,
        hindquarters: 100,
        legs: 100,
        hooves: 100,
      };
      expect(calculateOverallScore(conformation)).toBe(100);
    });

    it('should handle all zero scores', () => {
      const conformation: ConformationScores = {
        head: 0,
        neck: 0,
        shoulder: 0,
        back: 0,
        hindquarters: 0,
        legs: 0,
        hooves: 0,
      };
      expect(calculateOverallScore(conformation)).toBe(0);
    });

    it('should filter out negative scores', () => {
      const conformation = {
        head: 80,
        neck: -1,
        shoulder: 80,
        back: 80,
        hindquarters: 80,
        legs: 80,
        hooves: 80,
      } as ConformationScores;
      // Should average only valid scores: (80*6) / 6 = 80
      expect(calculateOverallScore(conformation)).toBe(80);
    });

    it('should return 0 if no valid scores', () => {
      const conformation = {
        head: -1,
        neck: -1,
        shoulder: -1,
        back: -1,
        hindquarters: -1,
        legs: -1,
        hooves: -1,
      } as ConformationScores;
      expect(calculateOverallScore(conformation)).toBe(0);
    });
  });

  describe('getBreedComparison', () => {
    it('should return "Above Average" when horse score exceeds breed average by 2+', () => {
      const result = getBreedComparison(85, 80);
      expect(result.label).toBe('Above Average');
      expect(result.icon).toBe('↑');
      expect(result.difference).toBe(5);
    });

    it('should return "Below Average" when horse score is 2+ below breed average', () => {
      const result = getBreedComparison(75, 80);
      expect(result.label).toBe('Below Average');
      expect(result.icon).toBe('↓');
      expect(result.difference).toBe(-5);
    });

    it('should return "Average" when scores are within 2 points', () => {
      expect(getBreedComparison(80, 80).label).toBe('Average');
      expect(getBreedComparison(81, 80).label).toBe('Average');
      expect(getBreedComparison(79, 80).label).toBe('Average');
      expect(getBreedComparison(81.9, 80).label).toBe('Average');
      expect(getBreedComparison(78.1, 80).label).toBe('Average');
    });

    it('should return difference of 0 when considered average', () => {
      expect(getBreedComparison(80, 80).difference).toBe(0);
      expect(getBreedComparison(81, 80).difference).toBe(0);
      expect(getBreedComparison(79, 80).difference).toBe(0);
    });

    it('should handle large differences', () => {
      const result = getBreedComparison(95, 60);
      expect(result.label).toBe('Above Average');
      expect(result.difference).toBe(35);
    });

    it('should handle negative differences', () => {
      const result = getBreedComparison(45, 80);
      expect(result.label).toBe('Below Average');
      expect(result.difference).toBe(-35);
    });

    it('should round differences to 1 decimal place', () => {
      const result = getBreedComparison(85.678, 80.123);
      expect(result.difference).toBeCloseTo(5.6, 1);
    });
  });

  describe('formatScore', () => {
    it('should format integer scores without decimal', () => {
      expect(formatScore(85)).toBe('85/100');
      expect(formatScore(100)).toBe('100/100');
      expect(formatScore(0)).toBe('0/100');
    });

    it('should format decimal scores with 1 decimal place', () => {
      expect(formatScore(85.5)).toBe('85.5/100');
      expect(formatScore(72.3)).toBe('72.3/100');
      expect(formatScore(99.9)).toBe('99.9/100');
    });

    it('should clamp negative scores to 0', () => {
      expect(formatScore(-10)).toBe('0/100');
      expect(formatScore(-1)).toBe('0/100');
    });

    it('should clamp scores above 100 to 100', () => {
      expect(formatScore(101)).toBe('100/100');
      expect(formatScore(150)).toBe('100/100');
    });

    it('should round to 1 decimal place', () => {
      expect(formatScore(85.678)).toBe('85.7/100');
      expect(formatScore(72.123)).toBe('72.1/100');
    });
  });

  describe('getRegionDescription', () => {
    it('should return description for head region', () => {
      const description = getRegionDescription('head');
      expect(description).toContain('Facial structure');
      expect(description).toContain('eyes');
    });

    it('should return description for neck region', () => {
      const description = getRegionDescription('neck');
      expect(description).toContain('Length');
      expect(description).toContain('shoulder');
    });

    it('should return description for shoulder region', () => {
      const description = getRegionDescription('shoulder');
      expect(description).toContain('Angle');
      expect(description).toContain('movement');
    });

    it('should return description for back region', () => {
      const description = getRegionDescription('back');
      expect(description).toContain('Topline');
      expect(description).toContain('loin');
    });

    it('should return description for hindquarters region', () => {
      const description = getRegionDescription('hindquarters');
      expect(description).toContain('Hip');
      expect(description).toContain('muscle');
    });

    it('should return description for legs region', () => {
      const description = getRegionDescription('legs');
      expect(description).toContain('Bone');
      expect(description).toContain('joint');
    });

    it('should return description for hooves region', () => {
      const description = getRegionDescription('hooves');
      expect(description).toContain('Size');
      expect(description).toContain('quality');
    });

    it('should return description for overall region', () => {
      const description = getRegionDescription('overall');
      expect(description).toContain('overall');
      expect(description).toContain('average');
    });

    it('should be case-insensitive', () => {
      expect(getRegionDescription('HEAD')).toContain('Facial structure');
      expect(getRegionDescription('Head')).toContain('Facial structure');
      expect(getRegionDescription('head')).toContain('Facial structure');
    });

    it('should return default description for unknown region', () => {
      const description = getRegionDescription('unknown');
      expect(description).toContain('Conformation assessment');
    });
  });

  describe('getRegionDisplayName', () => {
    it('should capitalize first letter', () => {
      expect(getRegionDisplayName('head')).toBe('Head');
      expect(getRegionDisplayName('neck')).toBe('Neck');
      expect(getRegionDisplayName('shoulder')).toBe('Shoulder');
    });

    it('should handle already capitalized names', () => {
      expect(getRegionDisplayName('Head')).toBe('Head');
      expect(getRegionDisplayName('NECK')).toBe('Neck');
    });

    it('should handle multi-word regions', () => {
      expect(getRegionDisplayName('hindquarters')).toBe('Hindquarters');
    });
  });

  describe('isValidConformation', () => {
    it('should return true for valid conformation', () => {
      const conformation: ConformationScores = {
        head: 80,
        neck: 75,
        shoulder: 85,
        back: 78,
        hindquarters: 82,
        legs: 88,
        hooves: 76,
      };
      expect(isValidConformation(conformation)).toBe(true);
    });

    it('should return false if any score is negative', () => {
      const conformation = {
        head: 80,
        neck: -1,
        shoulder: 85,
        back: 78,
        hindquarters: 82,
        legs: 88,
        hooves: 76,
      };
      expect(isValidConformation(conformation)).toBe(false);
    });

    it('should return false if any score is above 100', () => {
      const conformation = {
        head: 80,
        neck: 75,
        shoulder: 101,
        back: 78,
        hindquarters: 82,
        legs: 88,
        hooves: 76,
      };
      expect(isValidConformation(conformation)).toBe(false);
    });

    it('should return false if any score is missing', () => {
      const conformation = {
        head: 80,
        neck: 75,
        shoulder: 85,
        back: 78,
        hindquarters: 82,
        legs: 88,
        // hooves missing
      };
      expect(isValidConformation(conformation)).toBe(false);
    });

    it('should return false if any score is not a number', () => {
      const conformation = {
        head: 80,
        neck: 'high' as any,
        shoulder: 85,
        back: 78,
        hindquarters: 82,
        legs: 88,
        hooves: 76,
      };
      expect(isValidConformation(conformation)).toBe(false);
    });

    it('should accept scores at boundaries (0 and 100)', () => {
      const conformation: ConformationScores = {
        head: 0,
        neck: 100,
        shoulder: 0,
        back: 100,
        hindquarters: 0,
        legs: 100,
        hooves: 50,
      };
      expect(isValidConformation(conformation)).toBe(true);
    });
  });

  describe('getScoreColor', () => {
    it('should return emerald for Excellent scores (90-100)', () => {
      expect(getScoreColor(90)).toBe('bg-emerald-500');
      expect(getScoreColor(95)).toBe('bg-emerald-500');
      expect(getScoreColor(100)).toBe('bg-emerald-500');
    });

    it('should return blue for Very Good scores (80-89)', () => {
      expect(getScoreColor(80)).toBe('bg-blue-500');
      expect(getScoreColor(85)).toBe('bg-blue-500');
      expect(getScoreColor(89)).toBe('bg-blue-500');
    });

    it('should return amber for Good scores (70-79)', () => {
      expect(getScoreColor(70)).toBe('bg-amber-500');
      expect(getScoreColor(75)).toBe('bg-amber-500');
      expect(getScoreColor(79)).toBe('bg-amber-500');
    });

    it('should return slate for Average scores (60-69)', () => {
      expect(getScoreColor(60)).toBe('bg-slate-500');
      expect(getScoreColor(65)).toBe('bg-slate-500');
      expect(getScoreColor(69)).toBe('bg-slate-500');
    });

    it('should return orange for Below Average scores (50-59)', () => {
      expect(getScoreColor(50)).toBe('bg-orange-500');
      expect(getScoreColor(55)).toBe('bg-orange-500');
      expect(getScoreColor(59)).toBe('bg-orange-500');
    });

    it('should return rose for Poor scores (0-49)', () => {
      expect(getScoreColor(0)).toBe('bg-rose-500');
      expect(getScoreColor(25)).toBe('bg-rose-500');
      expect(getScoreColor(49)).toBe('bg-rose-500');
    });

    it('should clamp negative scores to 0', () => {
      expect(getScoreColor(-10)).toBe('bg-rose-500');
    });

    it('should clamp scores above 100 to 100', () => {
      expect(getScoreColor(150)).toBe('bg-emerald-500');
    });
  });
});
