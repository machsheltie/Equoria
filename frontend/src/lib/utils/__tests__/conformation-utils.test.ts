/**
 * Tests for Conformation Scoring Utilities
 *
 * Tests cover:
 * - Quality rating calculations with boundary conditions
 * - Breed comparison logic with edge cases
 * - Score formatting with decimals and integers
 * - Region descriptions and validation
 *
 * Story 3-5: Conformation Scoring UI - Task 1
 */

import { describe, it, expect } from 'vitest';
import {
  getQualityRating,
  conformationQualityBands,
  getBreedComparison,
  formatScore,
  getRegionDescription,
  getRegionDisplayName,
  isValidConformation,
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

    // Owner ruling q251 (Equoria-y8vg9, 2026-10-28): six words, and the 50-59
    // band is "Fair" (it was "Below Average").
    it('should return Fair for scores 50-59', () => {
      expect(getQualityRating(50).label).toBe('Fair');
      expect(getQualityRating(55).label).toBe('Fair');
      expect(getQualityRating(59).label).toBe('Fair');
      expect(getQualityRating(59.9).label).toBe('Fair');
    });

    it('uses exactly the six owner-ruled words, in band order', () => {
      expect(conformationQualityBands.map((b) => [b.min, b.label])).toEqual([
        [90, 'Excellent'],
        [80, 'Very Good'],
        [70, 'Good'],
        [60, 'Average'],
        [50, 'Fair'],
        [0, 'Poor'],
      ]);
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

    // Old contract: Excellent emerald, Very Good gold, Good amber, Average
    // slate, Fair orange, Poor rose. Owner request 2026-10-29 (Equoria-oxbda):
    // Poor red, Fair orange, Average yellow, Good green, Very Good blue,
    // Excellent purple, through the --conformation-rating-* tokens.
    it.each([
      [95, 'excellent'],
      [85, 'very-good'],
      [75, 'good'],
      [65, 'average'],
      [55, 'fair'],
      [45, 'poor'],
    ])('a score of %i takes the %s rating colour for text, tint and bar', (score, token) => {
      const rating = getQualityRating(score);
      expect(rating.color).toBe(`text-[var(--conformation-rating-${token})]`);
      expect(rating.bgColor).toBe(
        `bg-[var(--conformation-rating-${token}-bg)] border-[var(--conformation-rating-${token}-border)]`
      );
      expect(rating.fillColor).toBe(`bg-[var(--conformation-rating-${token})]`);
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

  describe('score bar fill follows the quality band', () => {
    const fill = (score: number) => getQualityRating(score).fillColor;
    it.each([
      [[90, 95, 100, 150], 'excellent'],
      [[80, 85, 89], 'very-good'],
      [[70, 75, 79], 'good'],
      [[60, 65, 69], 'average'],
      [[50, 55, 59], 'fair'],
      [[-10, 0, 25, 49], 'poor'],
    ])('scores %j fill with the %s colour', (scores, token) => {
      for (const score of scores) {
        expect(fill(score)).toBe(`bg-[var(--conformation-rating-${token})]`);
      }
    });
  });
});
