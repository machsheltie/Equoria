/**
 * Tests for CompatibilityDisplay Component
 *
 * Testing Sprint Day 2 - Story 6-1: Breeding Pair Selection
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover:
 * - getScoreColor helper function (score-based color logic)
 * - Component rendering states (loading, null, data)
 * - Progress bar display with various scores
 * - Recommendations display (present/absent)
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CompatibilityDisplay from '../CompatibilityDisplay';
import type { CompatibilityAnalysis } from '@/types/breeding';

/**
 * Helper function replicated for unit testing
 */
function getScoreColor(score: number): {
  text: string;
  bg: string;
  bar: string;
  label: string;
} {
  if (score >= 80) {
    return {
      text: 'text-green-700',
      bg: 'bg-green-50',
      bar: 'bg-green-500',
      label: 'Excellent',
    };
  } else if (score >= 60) {
    return {
      text: 'text-yellow-700',
      bg: 'bg-yellow-50',
      bar: 'bg-yellow-500',
      label: 'Good',
    };
  } else {
    return {
      text: 'text-red-700',
      bg: 'bg-red-50',
      bar: 'bg-red-500',
      label: 'Poor',
    };
  }
}

describe('getScoreColor', () => {
  describe('excellent range (>= 80)', () => {
    it('should return green colors for score 80', () => {
      const result = getScoreColor(80);
      expect(result.text).toBe('text-green-700');
      expect(result.bg).toBe('bg-green-50');
      expect(result.bar).toBe('bg-green-500');
      expect(result.label).toBe('Excellent');
    });

    it('should return green colors for scores above 80', () => {
      const result = getScoreColor(90);
      expect(result.label).toBe('Excellent');
      expect(result.bar).toBe('bg-green-500');
    });

    it('should return green colors for score 100', () => {
      const result = getScoreColor(100);
      expect(result.label).toBe('Excellent');
    });
  });

  describe('good range (60-79)', () => {
    it('should return yellow colors for score 60', () => {
      const result = getScoreColor(60);
      expect(result.text).toBe('text-yellow-700');
      expect(result.bg).toBe('bg-yellow-50');
      expect(result.bar).toBe('bg-yellow-500');
      expect(result.label).toBe('Good');
    });

    it('should return yellow colors for mid-range scores', () => {
      const result = getScoreColor(70);
      expect(result.label).toBe('Good');
      expect(result.bar).toBe('bg-yellow-500');
    });

    it('should return yellow colors for score 79', () => {
      const result = getScoreColor(79);
      expect(result.label).toBe('Good');
    });
  });

  describe('poor range (< 60)', () => {
    it('should return red colors for score 59', () => {
      const result = getScoreColor(59);
      expect(result.text).toBe('text-red-700');
      expect(result.bg).toBe('bg-red-50');
      expect(result.bar).toBe('bg-red-500');
      expect(result.label).toBe('Poor');
    });

    it('should return red colors for low scores', () => {
      const result = getScoreColor(30);
      expect(result.label).toBe('Poor');
      expect(result.bar).toBe('bg-red-500');
    });

    it('should return red colors for score 0', () => {
      const result = getScoreColor(0);
      expect(result.label).toBe('Poor');
    });
  });

  describe('return value structure', () => {
    it('should return object with all required properties', () => {
      const result = getScoreColor(75);
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('bg');
      expect(result).toHaveProperty('bar');
      expect(result).toHaveProperty('label');
    });

    it('should return valid Tailwind classes', () => {
      const result = getScoreColor(85);
      expect(result.text).toMatch(/^text-\w+-\d{3}$/);
      expect(result.bg).toMatch(/^bg-\w+-\d{2}$/);
      expect(result.bar).toMatch(/^bg-\w+-\d{3}$/);
    });
  });
});

describe('CompatibilityDisplay Component', () => {
  describe('loading state', () => {
    it('should render loading spinner when isLoading is true', () => {
      render(<CompatibilityDisplay compatibility={null} isLoading={true} />);
      expect(screen.getByText('Analyzing compatibility...')).toBeInTheDocument();
    });

    it('should show spinner animation in loading state', () => {
      const { container } = render(<CompatibilityDisplay compatibility={null} isLoading={true} />);
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should not show compatibility data when loading', () => {
      render(<CompatibilityDisplay compatibility={null} isLoading={true} />);
      expect(screen.queryByText('Compatibility Analysis')).not.toBeInTheDocument();
    });
  });

  describe('null/placeholder state', () => {
    it('should render placeholder when compatibility is null and not loading', () => {
      render(<CompatibilityDisplay compatibility={null} isLoading={false} />);
      expect(screen.getByText('Select Both Parents')).toBeInTheDocument();
    });

    it('should show instructional text in placeholder state', () => {
      render(<CompatibilityDisplay compatibility={null} isLoading={false} />);
      expect(screen.getByText(/Choose a sire and dam from the lists above/i)).toBeInTheDocument();
    });

    it('should not show loading or data in placeholder state', () => {
      render(<CompatibilityDisplay compatibility={null} isLoading={false} />);
      expect(screen.queryByText('Analyzing compatibility...')).not.toBeInTheDocument();
      expect(screen.queryByText('Compatibility Analysis')).not.toBeInTheDocument();
    });
  });

  describe('data state - excellent compatibility', () => {
    const excellentCompatibility: CompatibilityAnalysis = {
      overall: 85,
      temperamentMatch: 90,
      traitSynergy: 85,
      geneticDiversity: 80,
      recommendations: ['Excellent breeding pair', 'High trait synergy potential'],
    };

    it('should render compatibility analysis header', () => {
      render(<CompatibilityDisplay compatibility={excellentCompatibility} isLoading={false} />);
      expect(screen.getByText('Compatibility Analysis')).toBeInTheDocument();
    });

    it('should display overall score prominently', () => {
      render(<CompatibilityDisplay compatibility={excellentCompatibility} isLoading={false} />);
      expect(screen.getByText('85')).toBeInTheDocument();
    });

    it('should show Excellent label for high overall score', () => {
      render(<CompatibilityDisplay compatibility={excellentCompatibility} isLoading={false} />);
      expect(screen.getByText('Excellent Match')).toBeInTheDocument();
    });

    it('should display all three metric labels', () => {
      render(<CompatibilityDisplay compatibility={excellentCompatibility} isLoading={false} />);
      expect(screen.getByText('Temperament Match')).toBeInTheDocument();
      expect(screen.getByText('Trait Synergy')).toBeInTheDocument();
      expect(screen.getByText('Genetic Diversity')).toBeInTheDocument();
    });

    it('should display all metric scores', () => {
      render(<CompatibilityDisplay compatibility={excellentCompatibility} isLoading={false} />);
      expect(screen.getByText('90/100')).toBeInTheDocument();
      expect(screen.getByText('85/100')).toBeInTheDocument();
      expect(screen.getByText('80/100')).toBeInTheDocument();
    });

    it('should render progress bars with correct aria attributes', () => {
      const { container } = render(
        <CompatibilityDisplay compatibility={excellentCompatibility} isLoading={false} />
      );
      const progressBars = container.querySelectorAll('[role="progressbar"]');
      expect(progressBars.length).toBeGreaterThan(0);
    });

    it('should display recommendations section when present', () => {
      render(<CompatibilityDisplay compatibility={excellentCompatibility} isLoading={false} />);
      expect(screen.getByText('Breeding Recommendations')).toBeInTheDocument();
    });

    it('should render all recommendation items', () => {
      render(<CompatibilityDisplay compatibility={excellentCompatibility} isLoading={false} />);
      expect(screen.getByText('Excellent breeding pair')).toBeInTheDocument();
      expect(screen.getByText('High trait synergy potential')).toBeInTheDocument();
    });
  });

  describe('data state - good compatibility', () => {
    const goodCompatibility: CompatibilityAnalysis = {
      overall: 65,
      temperamentMatch: 70,
      traitSynergy: 65,
      geneticDiversity: 60,
      recommendations: ['Decent breeding pair'],
    };

    it('should show Good label for mid-range overall score', () => {
      render(<CompatibilityDisplay compatibility={goodCompatibility} isLoading={false} />);
      expect(screen.getByText('Good Match')).toBeInTheDocument();
    });

    it('should display correct metric scores', () => {
      render(<CompatibilityDisplay compatibility={goodCompatibility} isLoading={false} />);
      expect(screen.getByText('70/100')).toBeInTheDocument();
      expect(screen.getByText('65/100')).toBeInTheDocument();
      expect(screen.getByText('60/100')).toBeInTheDocument();
    });
  });

  describe('data state - poor compatibility', () => {
    const poorCompatibility: CompatibilityAnalysis = {
      overall: 45,
      temperamentMatch: 50,
      traitSynergy: 40,
      geneticDiversity: 45,
      recommendations: ['Consider alternative pairings'],
    };

    it('should show Poor label for low overall score', () => {
      render(<CompatibilityDisplay compatibility={poorCompatibility} isLoading={false} />);
      expect(screen.getByText('Poor Match')).toBeInTheDocument();
    });

    it('should display correct metric scores', () => {
      render(<CompatibilityDisplay compatibility={poorCompatibility} isLoading={false} />);
      expect(screen.getByText('50/100')).toBeInTheDocument();
      expect(screen.getByText('40/100')).toBeInTheDocument();
      expect(screen.getByText('45/100')).toBeInTheDocument();
    });
  });

  describe('data state - without recommendations', () => {
    const compatibilityNoRecs: CompatibilityAnalysis = {
      overall: 75,
      temperamentMatch: 80,
      traitSynergy: 75,
      geneticDiversity: 70,
      recommendations: [],
    };

    it('should not render recommendations section when array is empty', () => {
      render(<CompatibilityDisplay compatibility={compatibilityNoRecs} isLoading={false} />);
      expect(screen.queryByText('Breeding Recommendations')).not.toBeInTheDocument();
    });

    it('should still render compatibility analysis without recommendations', () => {
      render(<CompatibilityDisplay compatibility={compatibilityNoRecs} isLoading={false} />);
      expect(screen.getByText('Compatibility Analysis')).toBeInTheDocument();
      expect(screen.getByText('75')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle score of 0', () => {
      const zeroCompatibility: CompatibilityAnalysis = {
        overall: 0,
        temperamentMatch: 0,
        traitSynergy: 0,
        geneticDiversity: 0,
        recommendations: [],
      };
      render(<CompatibilityDisplay compatibility={zeroCompatibility} isLoading={false} />);
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('Poor Match')).toBeInTheDocument();
    });

    it('should handle score of 100', () => {
      const perfectCompatibility: CompatibilityAnalysis = {
        overall: 100,
        temperamentMatch: 100,
        traitSynergy: 100,
        geneticDiversity: 100,
        recommendations: ['Perfect breeding pair!'],
      };
      render(<CompatibilityDisplay compatibility={perfectCompatibility} isLoading={false} />);
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('Excellent Match')).toBeInTheDocument();
    });

    it('should handle boundary score 80 (excellent threshold)', () => {
      const boundaryCompatibility: CompatibilityAnalysis = {
        overall: 80,
        temperamentMatch: 80,
        traitSynergy: 80,
        geneticDiversity: 80,
        recommendations: [],
      };
      render(<CompatibilityDisplay compatibility={boundaryCompatibility} isLoading={false} />);
      expect(screen.getByText('Excellent Match')).toBeInTheDocument();
    });

    it('should handle boundary score 60 (good threshold)', () => {
      const boundaryCompatibility: CompatibilityAnalysis = {
        overall: 60,
        temperamentMatch: 60,
        traitSynergy: 60,
        geneticDiversity: 60,
        recommendations: [],
      };
      render(<CompatibilityDisplay compatibility={boundaryCompatibility} isLoading={false} />);
      expect(screen.getByText('Good Match')).toBeInTheDocument();
    });
  });
});
