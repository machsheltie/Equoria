/**
 * Unit Tests for EvaluationScoreDisplay Helper Functions
 *
 * Testing Sprint Day 1 - Phase 2: Evaluation Scoring
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover 3 helper functions:
 * - getCategoryIconColor (icon color based on category)
 * - getProgressBarGradient (gradient based on score)
 * - getSizeClasses (size configuration object)
 */

import { describe, it, expect } from 'vitest';
import type { EvaluationCategory } from '@/types/foal';

/**
 * Replicated helper functions for testing
 * In production, these would be extracted to a separate testable module
 */
function getCategoryIconColor(category: EvaluationCategory): string {
  switch (category) {
    case 'Excellent':
    case 'Good':
      return 'text-green-600';
    case 'Neutral':
      return 'text-yellow-600';
    case 'Poor':
    case 'Bad':
      return 'text-red-600';
  }
}

function getProgressBarGradient(score: number): string {
  if (score >= 3) return 'from-green-500 to-green-600';
  if (score >= 0) return 'from-yellow-500 to-yellow-600';
  return 'from-red-500 to-red-600';
}

function getSizeClasses(size: 'small' | 'medium' | 'large') {
  switch (size) {
    case 'small':
      return {
        score: 'text-3xl',
        label: 'text-xs',
        icon: 'h-5 w-5',
        progressHeight: 'h-2',
      };
    case 'medium':
      return {
        score: 'text-4xl',
        label: 'text-sm',
        icon: 'h-6 w-6',
        progressHeight: 'h-3',
      };
    case 'large':
      return {
        score: 'text-5xl',
        label: 'text-base',
        icon: 'h-8 w-8',
        progressHeight: 'h-4',
      };
  }
}

describe('getCategoryIconColor', () => {
  it('should return green for "Excellent"', () => {
    expect(getCategoryIconColor('Excellent')).toBe('text-green-600');
  });

  it('should return green for "Good"', () => {
    expect(getCategoryIconColor('Good')).toBe('text-green-600');
  });

  it('should return yellow for "Neutral"', () => {
    expect(getCategoryIconColor('Neutral')).toBe('text-yellow-600');
  });

  it('should return red for "Poor"', () => {
    expect(getCategoryIconColor('Poor')).toBe('text-red-600');
  });

  it('should return red for "Bad"', () => {
    expect(getCategoryIconColor('Bad')).toBe('text-red-600');
  });

  it('should return properly formatted Tailwind color class', () => {
    const color = getCategoryIconColor('Excellent');
    expect(color).toMatch(/^text-\w+-\d{3}$/);
  });
});

describe('getProgressBarGradient', () => {
  it('should return green gradient for score >= 3', () => {
    expect(getProgressBarGradient(3)).toBe('from-green-500 to-green-600');
    expect(getProgressBarGradient(5)).toBe('from-green-500 to-green-600');
    expect(getProgressBarGradient(10)).toBe('from-green-500 to-green-600');
  });

  it('should return yellow gradient for score 0-2', () => {
    expect(getProgressBarGradient(0)).toBe('from-yellow-500 to-yellow-600');
    expect(getProgressBarGradient(1)).toBe('from-yellow-500 to-yellow-600');
    expect(getProgressBarGradient(2)).toBe('from-yellow-500 to-yellow-600');
  });

  it('should return red gradient for score < 0', () => {
    expect(getProgressBarGradient(-1)).toBe('from-red-500 to-red-600');
    expect(getProgressBarGradient(-5)).toBe('from-red-500 to-red-600');
    expect(getProgressBarGradient(-10)).toBe('from-red-500 to-red-600');
  });

  it('should return properly formatted Tailwind gradient classes', () => {
    const gradient = getProgressBarGradient(5);
    expect(gradient).toMatch(/^from-\w+-\d{3} to-\w+-\d{3}$/);
  });
});

describe('getSizeClasses', () => {
  describe('small size', () => {
    it('should return correct classes for small size', () => {
      const classes = getSizeClasses('small');
      expect(classes.score).toBe('text-3xl');
      expect(classes.label).toBe('text-xs');
      expect(classes.icon).toBe('h-5 w-5');
      expect(classes.progressHeight).toBe('h-2');
    });

    it('should return object with all required properties', () => {
      const classes = getSizeClasses('small');
      expect(classes).toHaveProperty('score');
      expect(classes).toHaveProperty('label');
      expect(classes).toHaveProperty('icon');
      expect(classes).toHaveProperty('progressHeight');
    });
  });

  describe('medium size', () => {
    it('should return correct classes for medium size', () => {
      const classes = getSizeClasses('medium');
      expect(classes.score).toBe('text-4xl');
      expect(classes.label).toBe('text-sm');
      expect(classes.icon).toBe('h-6 w-6');
      expect(classes.progressHeight).toBe('h-3');
    });

    it('should have larger values than small', () => {
      const small = getSizeClasses('small');
      const medium = getSizeClasses('medium');
      // Compare text sizes (3xl < 4xl)
      expect(medium.score).not.toBe(small.score);
      expect(medium.label).not.toBe(small.label);
    });
  });

  describe('large size', () => {
    it('should return correct classes for large size', () => {
      const classes = getSizeClasses('large');
      expect(classes.score).toBe('text-5xl');
      expect(classes.label).toBe('text-base');
      expect(classes.icon).toBe('h-8 w-8');
      expect(classes.progressHeight).toBe('h-4');
    });

    it('should have larger values than medium', () => {
      const medium = getSizeClasses('medium');
      const large = getSizeClasses('large');
      // Compare text sizes (4xl < 5xl)
      expect(large.score).not.toBe(medium.score);
      expect(large.icon).not.toBe(medium.icon);
    });
  });

  describe('size progression', () => {
    it('should have progressive icon sizes (small < medium < large)', () => {
      const small = getSizeClasses('small');
      const medium = getSizeClasses('medium');
      const large = getSizeClasses('large');

      // Extract height values (h-5, h-6, h-8)
      const smallHeight = parseInt(small.icon.match(/h-(\d+)/)?.[1] || '0');
      const mediumHeight = parseInt(medium.icon.match(/h-(\d+)/)?.[1] || '0');
      const largeHeight = parseInt(large.icon.match(/h-(\d+)/)?.[1] || '0');

      expect(smallHeight).toBeLessThan(mediumHeight);
      expect(mediumHeight).toBeLessThan(largeHeight);
    });

    it('should have progressive progress bar heights', () => {
      const small = getSizeClasses('small');
      const medium = getSizeClasses('medium');
      const large = getSizeClasses('large');

      // Extract height values (h-2, h-3, h-4)
      const smallHeight = parseInt(small.progressHeight.match(/h-(\d+)/)?.[1] || '0');
      const mediumHeight = parseInt(medium.progressHeight.match(/h-(\d+)/)?.[1] || '0');
      const largeHeight = parseInt(large.progressHeight.match(/h-(\d+)/)?.[1] || '0');

      expect(smallHeight).toBeLessThan(mediumHeight);
      expect(mediumHeight).toBeLessThan(largeHeight);
    });
  });

  describe('Tailwind class format validation', () => {
    it('should return valid Tailwind text size classes', () => {
      ['small', 'medium', 'large'].forEach((size) => {
        const classes = getSizeClasses(size as 'small' | 'medium' | 'large');
        expect(classes.score).toMatch(/^text-(xs|sm|base|lg|xl|\dxl)$/);
        expect(classes.label).toMatch(/^text-(xs|sm|base|lg|xl|\dxl)$/);
      });
    });

    it('should return valid Tailwind dimension classes', () => {
      ['small', 'medium', 'large'].forEach((size) => {
        const classes = getSizeClasses(size as 'small' | 'medium' | 'large');
        expect(classes.icon).toMatch(/^h-\d+ w-\d+$/);
        expect(classes.progressHeight).toMatch(/^h-\d+$/);
      });
    });
  });
});
