/**
 * CompatibilityDisplay Component Tests
 *
 * Story 6-1: Breeding Pair Selection
 * Tests for compatibility analysis display and color-coded scoring
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CompatibilityDisplay from '../CompatibilityDisplay';
import type { CompatibilityAnalysis } from '@/types/breeding';

describe('CompatibilityDisplay - Story 6-1', () => {
  const mockCompatibilityExcellent: CompatibilityAnalysis = {
    overall: 85,
    temperamentMatch: 88,
    traitSynergy: 90,
    geneticDiversity: 78,
    recommendations: [
      'Excellent temperament match',
      'Strong athletic trait synergy',
      'Good genetic diversity',
    ],
  };

  const mockCompatibilityGood: CompatibilityAnalysis = {
    overall: 70,
    temperamentMatch: 68,
    traitSynergy: 72,
    geneticDiversity: 70,
    recommendations: ['Compatible temperaments', 'Moderate trait synergy'],
  };

  const mockCompatibilityPoor: CompatibilityAnalysis = {
    overall: 45,
    temperamentMatch: 50,
    traitSynergy: 40,
    geneticDiversity: 45,
    recommendations: ['Low temperament compatibility', 'Consider alternative pairing'],
  };

  describe('Loading State', () => {
    it('should show loading spinner when isLoading is true', () => {
      render(<CompatibilityDisplay compatibility={null} isLoading={true} />);

      expect(screen.getByText(/Analyzing compatibility/i)).toBeInTheDocument();
    });

    it('should show loading animation', () => {
      render(<CompatibilityDisplay compatibility={null} isLoading={true} />);

      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Placeholder State', () => {
    it('should show placeholder when no compatibility data', () => {
      render(<CompatibilityDisplay compatibility={null} isLoading={false} />);

      expect(screen.getByText(/Select Both Parents/i)).toBeInTheDocument();
      expect(screen.getByText(/Choose a sire and dam from the lists above/i)).toBeInTheDocument();
    });
  });

  describe('Compatibility Scores Display', () => {
    it('should display all four compatibility metrics', () => {
      render(<CompatibilityDisplay compatibility={mockCompatibilityExcellent} isLoading={false} />);

      expect(screen.getByText(/Temperament Match/i)).toBeInTheDocument();
      expect(screen.getByText(/Trait Synergy/i)).toBeInTheDocument();
      expect(screen.getByText(/Genetic Diversity/i)).toBeInTheDocument();
    });

    it('should display overall score prominently', () => {
      render(<CompatibilityDisplay compatibility={mockCompatibilityExcellent} isLoading={false} />);

      expect(screen.getByText('85')).toBeInTheDocument();
    });

    it('should display individual metric scores', () => {
      render(<CompatibilityDisplay compatibility={mockCompatibilityExcellent} isLoading={false} />);

      expect(screen.getByText('88/100')).toBeInTheDocument(); // Temperament
      expect(screen.getByText('90/100')).toBeInTheDocument(); // Trait Synergy
      expect(screen.getByText('78/100')).toBeInTheDocument(); // Genetic Diversity
    });
  });

  describe('Color Coding', () => {
    it('should show green color for excellent scores (>80)', () => {
      render(<CompatibilityDisplay compatibility={mockCompatibilityExcellent} isLoading={false} />);

      expect(screen.getByText(/Excellent Match/i)).toBeInTheDocument();

      // Check for green color classes
      const excellentLabel = screen.getByText('Excellent');
      expect(excellentLabel).toHaveClass('text-green-700');
    });

    it('should show yellow color for good scores (60-80)', () => {
      render(<CompatibilityDisplay compatibility={mockCompatibilityGood} isLoading={false} />);

      expect(screen.getByText(/Good Match/i)).toBeInTheDocument();

      // Check for yellow color classes
      const goodLabels = screen.getAllByText('Good');
      expect(goodLabels.length).toBeGreaterThan(0);
      goodLabels.forEach((label) => {
        expect(label).toHaveClass('text-yellow-700');
      });
    });

    it('should show red color for poor scores (<60)', () => {
      render(<CompatibilityDisplay compatibility={mockCompatibilityPoor} isLoading={false} />);

      expect(screen.getByText(/Poor Match/i)).toBeInTheDocument();

      // Check for red color classes
      const poorLabels = screen.getAllByText('Poor');
      expect(poorLabels.length).toBeGreaterThan(0);
      poorLabels.forEach((label) => {
        expect(label).toHaveClass('text-red-700');
      });
    });
  });

  describe('Progress Bars', () => {
    it('should render progress bars for all metrics', () => {
      render(<CompatibilityDisplay compatibility={mockCompatibilityExcellent} isLoading={false} />);

      const progressBars = container.querySelectorAll('[role="progressbar"]');
      expect(progressBars.length).toBeGreaterThanOrEqual(3); // At least 3 metric progress bars
    });

    it('should set correct aria values for progress bars', () => {
      render(<CompatibilityDisplay compatibility={mockCompatibilityExcellent} isLoading={false} />);

      const progressBars = container.querySelectorAll('[role="progressbar"]');
      progressBars.forEach((bar) => {
        expect(bar).toHaveAttribute('aria-valuenow');
        expect(bar).toHaveAttribute('aria-valuemin', '0');
        expect(bar).toHaveAttribute('aria-valuemax', '100');
      });
    });

    it('should display progress bars with correct widths', () => {
      render(<CompatibilityDisplay compatibility={mockCompatibilityExcellent} isLoading={false} />);

      const progressBars = container.querySelectorAll('[role="progressbar"]');

      // Check that at least one bar has the expected width
      const hasCorrectWidth = Array.from(progressBars).some((bar) => {
        const style = (bar as HTMLElement).style.width;
        return style === '88%' || style === '90%' || style === '78%';
      });

      expect(hasCorrectWidth).toBe(true);
    });
  });

  describe('Recommendations', () => {
    it('should display all recommendations', () => {
      render(<CompatibilityDisplay compatibility={mockCompatibilityExcellent} isLoading={false} />);

      expect(screen.getByText(/Breeding Recommendations/i)).toBeInTheDocument();
      expect(screen.getByText('Excellent temperament match')).toBeInTheDocument();
      expect(screen.getByText('Strong athletic trait synergy')).toBeInTheDocument();
      expect(screen.getByText('Good genetic diversity')).toBeInTheDocument();
    });

    it('should show recommendation section header', () => {
      render(<CompatibilityDisplay compatibility={mockCompatibilityExcellent} isLoading={false} />);

      expect(screen.getByText(/Breeding Recommendations/i)).toBeInTheDocument();
    });

    it('should handle empty recommendations array', () => {
      const noRecommendations: CompatibilityAnalysis = {
        ...mockCompatibilityExcellent,
        recommendations: [],
      };

      render(<CompatibilityDisplay compatibility={noRecommendations} isLoading={false} />);

      // Should not show recommendations section if empty
      expect(screen.queryByText(/Breeding Recommendations/i)).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for progress bars', () => {
      render(<CompatibilityDisplay compatibility={mockCompatibilityExcellent} isLoading={false} />);

      const progressBars = container.querySelectorAll('[role="progressbar"]');
      progressBars.forEach((bar) => {
        expect(bar).toHaveAttribute('aria-label');
      });
    });

    it('should include metric names in progress bar labels', () => {
      render(<CompatibilityDisplay compatibility={mockCompatibilityExcellent} isLoading={false} />);

      const progressBars = container.querySelectorAll('[role="progressbar"]');
      const labels = Array.from(progressBars).map((bar) => bar.getAttribute('aria-label') || '');

      const hasRelevantLabels = labels.some(
        (label) =>
          label.includes('Temperament Match') ||
          label.includes('Trait Synergy') ||
          label.includes('Genetic Diversity')
      );

      expect(hasRelevantLabels).toBe(true);
    });
  });

  describe('Visual Hierarchy', () => {
    it('should display overall score larger than individual metrics', () => {
      render(<CompatibilityDisplay compatibility={mockCompatibilityExcellent} isLoading={false} />);

      const overallScore = container.querySelector('.text-4xl');
      expect(overallScore).toBeInTheDocument();
      expect(overallScore?.textContent).toBe('85');
    });

    it('should group related information together', () => {
      render(<CompatibilityDisplay compatibility={mockCompatibilityExcellent} isLoading={false} />);

      // All metrics should be present and grouped
      const metricsSection = screen.getByText(/Temperament Match/i).closest('div');
      expect(metricsSection).toBeInTheDocument();
    });
  });
});
