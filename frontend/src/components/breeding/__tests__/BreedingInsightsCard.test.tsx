/**
 * Tests for BreedingInsightsCard Component
 *
 * Testing Sprint - Story 6-5: Breeding Predictions
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover:
 * - Lineage quality score display with tier labels
 * - Quality tier color coding (Exceptional, Excellent, Good, Average, Below Average)
 * - Progress bar visualization with gradients
 * - Strengths section (conditional, with icons)
 * - Recommendations section (conditional, with icons)
 * - Optimal Care Strategies section (conditional, with icons)
 * - Considerations section (conditional, with icons)
 * - Warnings section (conditional, with icons)
 * - Empty array handling for all sections
 * - Bullet list formatting
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BreedingInsightsCard from '../BreedingInsightsCard';
import type { BreedingInsights } from '@/types/breeding';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Lightbulb: () => <svg data-testid="lightbulb-icon" />,
  CheckCircle: () => <svg data-testid="check-circle-icon" />,
  AlertTriangle: () => <svg data-testid="alert-triangle-icon" />,
  Info: () => <svg data-testid="info-icon" />,
  TrendingUp: () => <svg data-testid="trending-up-icon" />,
  Award: () => <svg data-testid="award-icon" />,
}));

describe('BreedingInsightsCard Component', () => {
  const mockInsights: BreedingInsights = {
    strengths: [
      'Both parents have exceptional speed stats',
      'Compatible temperament traits for racing',
    ],
    recommendations: ['Focus on agility training early', 'Monitor stress levels during weaning'],
    considerations: ['Parents share some genetic markers', 'Dam has lower stamina than ideal'],
    warnings: [
      'High risk of inheriting stress sensitivity',
      'May require specialized care in first months',
    ],
    optimalCareStrategies: [
      'Assign experienced groom for first 60 days',
      'Emphasize trust-building enrichment activities',
    ],
    lineageQualityScore: 78,
  };

  describe('lineage quality score', () => {
    it('should display Award icon', () => {
      render(<BreedingInsightsCard insights={mockInsights} />);
      expect(screen.getByTestId('award-icon')).toBeInTheDocument();
    });

    it('should display "Lineage Quality Score" heading', () => {
      render(<BreedingInsightsCard insights={mockInsights} />);
      expect(screen.getByText('Lineage Quality Score')).toBeInTheDocument();
    });

    it('should display score value', () => {
      render(<BreedingInsightsCard insights={mockInsights} />);
      expect(screen.getByText('78')).toBeInTheDocument();
    });

    it('should display quality label for Excellent (70-84)', () => {
      render(<BreedingInsightsCard insights={mockInsights} />);
      expect(screen.getByText('Excellent')).toBeInTheDocument();
    });

    it('should display "Exceptional" for scores >= 85', () => {
      const exceptionalInsights = { ...mockInsights, lineageQualityScore: 90 };
      render(<BreedingInsightsCard insights={exceptionalInsights} />);
      expect(screen.getByText('Exceptional')).toBeInTheDocument();
    });

    it('should display "Good" for scores 55-69', () => {
      const goodInsights = { ...mockInsights, lineageQualityScore: 60 };
      render(<BreedingInsightsCard insights={goodInsights} />);
      expect(screen.getByText('Good')).toBeInTheDocument();
    });

    it('should display "Average" for scores 40-54', () => {
      const averageInsights = { ...mockInsights, lineageQualityScore: 45 };
      render(<BreedingInsightsCard insights={averageInsights} />);
      expect(screen.getByText('Average')).toBeInTheDocument();
    });

    it('should display "Below Average" for scores < 40', () => {
      const belowAverageInsights = { ...mockInsights, lineageQualityScore: 35 };
      render(<BreedingInsightsCard insights={belowAverageInsights} />);
      expect(screen.getByText('Below Average')).toBeInTheDocument();
    });

    it('should apply purple color for Exceptional tier', () => {
      const exceptionalInsights = { ...mockInsights, lineageQualityScore: 90 };
      render(<BreedingInsightsCard insights={exceptionalInsights} />);
      const scoreElement = screen.getByText('90');
      expect(scoreElement).toHaveClass('text-purple-600');
    });

    it('should apply green color for Excellent tier', () => {
      render(<BreedingInsightsCard insights={mockInsights} />);
      const scoreElement = screen.getByText('78');
      expect(scoreElement).toHaveClass('text-green-600');
    });

    it('should apply blue color for Good tier', () => {
      const goodInsights = { ...mockInsights, lineageQualityScore: 60 };
      render(<BreedingInsightsCard insights={goodInsights} />);
      const scoreElement = screen.getByText('60');
      expect(scoreElement).toHaveClass('text-blue-600');
    });

    it('should apply yellow color for Average tier', () => {
      const averageInsights = { ...mockInsights, lineageQualityScore: 45 };
      render(<BreedingInsightsCard insights={averageInsights} />);
      const scoreElement = screen.getByText('45');
      expect(scoreElement).toHaveClass('text-yellow-600');
    });

    it('should apply amber color for Below Average tier', () => {
      const belowAverageInsights = { ...mockInsights, lineageQualityScore: 35 };
      render(<BreedingInsightsCard insights={belowAverageInsights} />);
      const scoreElement = screen.getByText('35');
      expect(scoreElement).toHaveClass('text-amber-600');
    });

    it('should render progress bar with correct width', () => {
      const { container } = render(<BreedingInsightsCard insights={mockInsights} />);
      const progressBar = container.querySelector('.bg-gradient-to-r');
      expect(progressBar).toHaveStyle({ width: '78%' });
    });

    it('should display explanatory text', () => {
      render(<BreedingInsightsCard insights={mockInsights} />);
      expect(
        screen.getByText('Based on parent stats, traits, level, and genetic diversity')
      ).toBeInTheDocument();
    });
  });

  describe('strengths section', () => {
    it('should display CheckCircle icon', () => {
      render(<BreedingInsightsCard insights={mockInsights} />);
      expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
    });

    it('should display "Strong Combination Detected" heading', () => {
      render(<BreedingInsightsCard insights={mockInsights} />);
      expect(screen.getByText('Strong Combination Detected')).toBeInTheDocument();
    });

    it('should display all strength items', () => {
      render(<BreedingInsightsCard insights={mockInsights} />);
      expect(screen.getByText('Both parents have exceptional speed stats')).toBeInTheDocument();
      expect(screen.getByText('Compatible temperament traits for racing')).toBeInTheDocument();
    });

    it('should not display strengths section when array is empty', () => {
      const noStrengthsInsights = { ...mockInsights, strengths: [] };
      render(<BreedingInsightsCard insights={noStrengthsInsights} />);
      expect(screen.queryByText('Strong Combination Detected')).not.toBeInTheDocument();
    });

    it('should apply green border and background', () => {
      const { container } = render(<BreedingInsightsCard insights={mockInsights} />);
      const strengthsSection = container.querySelector('.border-green-200.bg-green-50');
      expect(strengthsSection).toBeInTheDocument();
    });
  });

  describe('recommendations section', () => {
    it('should display Lightbulb icon', () => {
      render(<BreedingInsightsCard insights={mockInsights} />);
      expect(screen.getByTestId('lightbulb-icon')).toBeInTheDocument();
    });

    it('should display "Recommendations" heading', () => {
      render(<BreedingInsightsCard insights={mockInsights} />);
      expect(screen.getByText(/✅ Recommendations/)).toBeInTheDocument();
    });

    it('should display all recommendation items', () => {
      render(<BreedingInsightsCard insights={mockInsights} />);
      expect(screen.getByText('Focus on agility training early')).toBeInTheDocument();
      expect(screen.getByText('Monitor stress levels during weaning')).toBeInTheDocument();
    });

    it('should not display recommendations section when array is empty', () => {
      const noRecsInsights = { ...mockInsights, recommendations: [] };
      render(<BreedingInsightsCard insights={noRecsInsights} />);
      expect(screen.queryByText(/Recommendations/)).not.toBeInTheDocument();
    });

    it('should apply blue border and background', () => {
      const { container } = render(<BreedingInsightsCard insights={mockInsights} />);
      const recsSection = container.querySelector('.border-blue-200.bg-blue-50');
      expect(recsSection).toBeInTheDocument();
    });
  });

  describe('optimal care strategies section', () => {
    it('should display TrendingUp icon', () => {
      render(<BreedingInsightsCard insights={mockInsights} />);
      expect(screen.getByTestId('trending-up-icon')).toBeInTheDocument();
    });

    it('should display "Optimal Care Strategies" heading', () => {
      render(<BreedingInsightsCard insights={mockInsights} />);
      expect(screen.getByText(/💡 Optimal Care Strategies/)).toBeInTheDocument();
    });

    it('should display all strategy items', () => {
      render(<BreedingInsightsCard insights={mockInsights} />);
      expect(screen.getByText('Assign experienced groom for first 60 days')).toBeInTheDocument();
      expect(
        screen.getByText('Emphasize trust-building enrichment activities')
      ).toBeInTheDocument();
    });

    it('should not display strategies section when array is empty', () => {
      const noStrategiesInsights = { ...mockInsights, optimalCareStrategies: [] };
      render(<BreedingInsightsCard insights={noStrategiesInsights} />);
      expect(screen.queryByText(/Optimal Care Strategies/)).not.toBeInTheDocument();
    });

    it('should apply emerald border and background', () => {
      const { container } = render(<BreedingInsightsCard insights={mockInsights} />);
      const strategiesSection = container.querySelector('.border-emerald-200.bg-emerald-50');
      expect(strategiesSection).toBeInTheDocument();
    });
  });

  describe('considerations section', () => {
    it('should display Info icon', () => {
      render(<BreedingInsightsCard insights={mockInsights} />);
      expect(screen.getByTestId('info-icon')).toBeInTheDocument();
    });

    it('should display "Considerations" heading', () => {
      render(<BreedingInsightsCard insights={mockInsights} />);
      expect(screen.getByText(/📋 Considerations/)).toBeInTheDocument();
    });

    it('should display all consideration items', () => {
      render(<BreedingInsightsCard insights={mockInsights} />);
      expect(screen.getByText('Parents share some genetic markers')).toBeInTheDocument();
      expect(screen.getByText('Dam has lower stamina than ideal')).toBeInTheDocument();
    });

    it('should not display considerations section when array is empty', () => {
      const noConsiderationsInsights = { ...mockInsights, considerations: [] };
      render(<BreedingInsightsCard insights={noConsiderationsInsights} />);
      expect(screen.queryByText(/📋 Considerations/)).not.toBeInTheDocument();
    });

    it('should apply slate border and background', () => {
      const { container } = render(<BreedingInsightsCard insights={mockInsights} />);
      const considerationsSection = container.querySelector('.border-slate-300.bg-slate-50');
      expect(considerationsSection).toBeInTheDocument();
    });
  });

  describe('warnings section', () => {
    it('should display AlertTriangle icon', () => {
      render(<BreedingInsightsCard insights={mockInsights} />);
      expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
    });

    it('should display "Important Warnings" heading', () => {
      render(<BreedingInsightsCard insights={mockInsights} />);
      expect(screen.getByText(/⚠️ Important Warnings/)).toBeInTheDocument();
    });

    it('should display all warning items', () => {
      render(<BreedingInsightsCard insights={mockInsights} />);
      expect(screen.getByText('High risk of inheriting stress sensitivity')).toBeInTheDocument();
      expect(screen.getByText('May require specialized care in first months')).toBeInTheDocument();
    });

    it('should apply font-medium to warning text', () => {
      render(<BreedingInsightsCard insights={mockInsights} />);
      const warningText = screen.getByText('High risk of inheriting stress sensitivity');
      expect(warningText).toHaveClass('font-medium');
    });

    it('should not display warnings section when array is empty', () => {
      const noWarningsInsights = { ...mockInsights, warnings: [] };
      render(<BreedingInsightsCard insights={noWarningsInsights} />);
      expect(screen.queryByText(/Important Warnings/)).not.toBeInTheDocument();
    });

    it('should not display warnings section when warnings is undefined', () => {
      const noWarningsInsights = {
        ...mockInsights,
        warnings: undefined,
      } as Partial<BreedingInsights>;
      render(<BreedingInsightsCard insights={noWarningsInsights as BreedingInsights} />);
      expect(screen.queryByText(/Important Warnings/)).not.toBeInTheDocument();
    });

    it('should apply amber border and background', () => {
      const { container } = render(<BreedingInsightsCard insights={mockInsights} />);
      const warningsSection = container.querySelector('.border-amber-300.bg-amber-50');
      expect(warningsSection).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle score of 100', () => {
      const perfectInsights = { ...mockInsights, lineageQualityScore: 100 };
      render(<BreedingInsightsCard insights={perfectInsights} />);
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('Exceptional')).toBeInTheDocument();
    });

    it('should handle score of 0', () => {
      const zeroInsights = { ...mockInsights, lineageQualityScore: 0 };
      render(<BreedingInsightsCard insights={zeroInsights} />);
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('Below Average')).toBeInTheDocument();
    });

    it('should handle exactly score 85 (boundary)', () => {
      const boundaryInsights = { ...mockInsights, lineageQualityScore: 85 };
      render(<BreedingInsightsCard insights={boundaryInsights} />);
      expect(screen.getByText('Exceptional')).toBeInTheDocument();
    });

    it('should handle exactly score 70 (boundary)', () => {
      const boundaryInsights = { ...mockInsights, lineageQualityScore: 70 };
      render(<BreedingInsightsCard insights={boundaryInsights} />);
      expect(screen.getByText('Excellent')).toBeInTheDocument();
    });

    it('should handle all sections being empty', () => {
      const emptyInsights: BreedingInsights = {
        strengths: [],
        recommendations: [],
        considerations: [],
        warnings: [],
        optimalCareStrategies: [],
        lineageQualityScore: 50,
      };

      render(<BreedingInsightsCard insights={emptyInsights} />);

      // Only lineage quality section should be visible
      expect(screen.getByText('Lineage Quality Score')).toBeInTheDocument();
      expect(screen.queryByText('Strong Combination Detected')).not.toBeInTheDocument();
      expect(screen.queryByText(/Recommendations/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Optimal Care Strategies/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Considerations/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Important Warnings/)).not.toBeInTheDocument();
    });

    it('should handle single item in each section', () => {
      const singleItemInsights: BreedingInsights = {
        strengths: ['Single strength'],
        recommendations: ['Single recommendation'],
        considerations: ['Single consideration'],
        warnings: ['Single warning'],
        optimalCareStrategies: ['Single strategy'],
        lineageQualityScore: 75,
      };

      render(<BreedingInsightsCard insights={singleItemInsights} />);

      expect(screen.getByText('Single strength')).toBeInTheDocument();
      expect(screen.getByText('Single recommendation')).toBeInTheDocument();
      expect(screen.getByText('Single consideration')).toBeInTheDocument();
      expect(screen.getByText('Single warning')).toBeInTheDocument();
      expect(screen.getByText('Single strategy')).toBeInTheDocument();
    });

    it('should handle very long text in list items', () => {
      const longTextInsights = {
        ...mockInsights,
        strengths: [
          'This is a very long strength description that should still display correctly and wrap properly in the UI without breaking the layout or causing horizontal scrolling issues',
        ],
      };

      render(<BreedingInsightsCard insights={longTextInsights} />);
      expect(screen.getByText(/This is a very long strength description/)).toBeInTheDocument();
    });
  });
});
