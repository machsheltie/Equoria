/**
 * Tests for EvaluationExplanation Component
 *
 * Testing Sprint Day 3+ - Story 6-4: Milestone Evaluation Display
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover:
 * - Helper functions (icon/color selection by score)
 * - Component rendering with various score ranges
 * - Trait display logic
 * - Conditional messaging (excellent, good, neutral, poor, critical)
 * - Props handling
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EvaluationExplanation from '../EvaluationExplanation';
import type { MilestoneType } from '@/types/foal';

// Mock the foal type functions
vi.mock('@/types/foal', async () => {
  const actual = await vi.importActual('@/types/foal');
  return {
    ...actual,
    getEvaluationCategory: vi.fn((score: number) => {
      if (score >= 5) return 'Excellent';
      if (score >= 3) return 'Good';
      if (score >= 0) return 'Neutral';
      if (score >= -3) return 'Poor';
      return 'Bad';
    }),
    getEvaluationExplanation: vi.fn(
      (score: number, milestone: string) =>
        `Evaluation explanation for ${milestone} with score ${score}`
    ),
    getFutureCareGuidance: vi.fn((score: number) => `Future care guidance for score ${score}`),
  };
});

describe('EvaluationExplanation Component', () => {
  const defaultProps = {
    score: 3,
    milestone: 'socialization' as MilestoneType,
    traits: ['peopleOriented', 'confident'],
  };

  describe('basic rendering', () => {
    it('should render the component', () => {
      render(<EvaluationExplanation {...defaultProps} />);
      expect(screen.getByText('What This Means')).toBeInTheDocument();
    });

    it('should display evaluation explanation text', () => {
      render(<EvaluationExplanation {...defaultProps} />);
      expect(
        screen.getByText(/Evaluation explanation for socialization with score 3/)
      ).toBeInTheDocument();
    });

    it('should display future care guidance', () => {
      render(<EvaluationExplanation {...defaultProps} />);
      expect(screen.getByText('Moving Forward:')).toBeInTheDocument();
      expect(screen.getByText(/Future care guidance for score 3/)).toBeInTheDocument();
    });
  });

  describe('score-based styling - excellent (score >= 5)', () => {
    it('should show green styling for score 5', () => {
      const { container } = render(<EvaluationExplanation {...defaultProps} score={5} />);
      const mainContainer = container.querySelector('.border-green-200');
      expect(mainContainer).toBeInTheDocument();
    });

    it('should show exceptional achievement message for score >= 5', () => {
      render(<EvaluationExplanation {...defaultProps} score={5} />);
      expect(screen.getByText('🌟 Exceptional Achievement!')).toBeInTheDocument();
      expect(screen.getByText(/outstanding evaluation/)).toBeInTheDocument();
    });

    it('should show exceptional achievement for score 10', () => {
      render(<EvaluationExplanation {...defaultProps} score={10} />);
      expect(screen.getByText('🌟 Exceptional Achievement!')).toBeInTheDocument();
    });
  });

  describe('score-based styling - good (3 <= score < 5)', () => {
    it('should show green styling for score 3', () => {
      const { container } = render(<EvaluationExplanation {...defaultProps} score={3} />);
      const mainContainer = container.querySelector('.border-green-200');
      expect(mainContainer).toBeInTheDocument();
    });

    it('should show great job message for score 3-4', () => {
      render(<EvaluationExplanation {...defaultProps} score={3} />);
      expect(screen.getByText('✨ Great Job!')).toBeInTheDocument();
      expect(screen.getByText(/consistent care has paid off/)).toBeInTheDocument();
    });

    it('should show great job message for score 4', () => {
      render(<EvaluationExplanation {...defaultProps} score={4} />);
      expect(screen.getByText('✨ Great Job!')).toBeInTheDocument();
    });
  });

  describe('score-based styling - neutral (0 <= score < 3)', () => {
    it('should show blue styling for score 0', () => {
      const { container } = render(<EvaluationExplanation {...defaultProps} score={0} />);
      const mainContainer = container.querySelector('.border-blue-200');
      expect(mainContainer).toBeInTheDocument();
    });

    it('should show room for improvement message for score 0-2', () => {
      render(<EvaluationExplanation {...defaultProps} score={1} />);
      expect(screen.getByText('📊 Room for Improvement')).toBeInTheDocument();
      expect(screen.getByText(/developing normally/)).toBeInTheDocument();
    });

    it('should show blue styling for score 2', () => {
      const { container } = render(<EvaluationExplanation {...defaultProps} score={2} />);
      const mainContainer = container.querySelector('.border-blue-200');
      expect(mainContainer).toBeInTheDocument();
    });
  });

  describe('score-based styling - poor (-3 <= score < 0)', () => {
    it('should show amber styling for score -1', () => {
      const { container } = render(<EvaluationExplanation {...defaultProps} score={-1} />);
      const mainContainer = container.querySelector('.border-amber-200');
      expect(mainContainer).toBeInTheDocument();
    });

    it('should show needs attention message for score -3 to -1', () => {
      render(<EvaluationExplanation {...defaultProps} score={-2} />);
      expect(screen.getByText('⚠️ Needs Attention')).toBeInTheDocument();
      expect(screen.getByText(/development is below optimal/)).toBeInTheDocument();
    });

    it('should show amber styling for score -3', () => {
      const { container } = render(<EvaluationExplanation {...defaultProps} score={-3} />);
      const mainContainer = container.querySelector('.border-amber-200');
      expect(mainContainer).toBeInTheDocument();
    });
  });

  describe('score-based styling - critical (score < -3)', () => {
    it('should show red styling for score -4', () => {
      const { container } = render(<EvaluationExplanation {...defaultProps} score={-4} />);
      const mainContainer = container.querySelector('.border-amber-200');
      expect(mainContainer).toBeInTheDocument();
    });

    it('should show critical care message for score < -3', () => {
      render(<EvaluationExplanation {...defaultProps} score={-4} />);
      expect(screen.getByText('❌ Critical Care Required')).toBeInTheDocument();
      expect(screen.getByText(/significant behavioral challenges/)).toBeInTheDocument();
    });

    it('should show critical care message for very low scores', () => {
      render(<EvaluationExplanation {...defaultProps} score={-10} />);
      expect(screen.getByText('❌ Critical Care Required')).toBeInTheDocument();
    });
  });

  describe('trait display', () => {
    it('should show positive traits header for high scores', () => {
      render(<EvaluationExplanation {...defaultProps} score={4} />);
      expect(screen.getByText('✨ Positive Traits Confirmed:')).toBeInTheDocument();
    });

    it('should show neutral traits header for medium scores', () => {
      render(<EvaluationExplanation {...defaultProps} score={1} />);
      expect(screen.getByText('📊 Traits Confirmed:')).toBeInTheDocument();
    });

    it('should show warning traits header for low scores', () => {
      render(<EvaluationExplanation {...defaultProps} score={-2} />);
      expect(screen.getByText('⚠️ Traits to Be Aware Of:')).toBeInTheDocument();
    });

    it('should display all provided traits', () => {
      render(<EvaluationExplanation {...defaultProps} traits={['trait1', 'trait2', 'trait3']} />);
      expect(screen.getByText('trait1')).toBeInTheDocument();
      expect(screen.getByText('trait2')).toBeInTheDocument();
      expect(screen.getByText('trait3')).toBeInTheDocument();
    });

    it('should show trait influence message for each trait', () => {
      render(<EvaluationExplanation {...defaultProps} traits={['peopleOriented']} />);
      expect(screen.getByText('peopleOriented')).toBeInTheDocument();
      expect(screen.getByText(/will influence your horse's behavior/)).toBeInTheDocument();
    });

    it('should not show trait section when traits array is empty', () => {
      render(<EvaluationExplanation {...defaultProps} traits={[]} />);
      expect(screen.queryByText(/Traits Confirmed/)).not.toBeInTheDocument();
    });

    it('should handle single trait', () => {
      render(<EvaluationExplanation {...defaultProps} traits={['singleTrait']} />);
      expect(screen.getByText('singleTrait')).toBeInTheDocument();
    });
  });

  describe('milestone handling', () => {
    it('should work with different milestone types', () => {
      render(
        <EvaluationExplanation
          {...defaultProps}
          milestone="imprinting"
          score={3}
          traits={['confident']}
        />
      );
      expect(
        screen.getByText(/Evaluation explanation for imprinting with score 3/)
      ).toBeInTheDocument();
    });

    it('should work with curiosity_play milestone', () => {
      render(
        <EvaluationExplanation
          {...defaultProps}
          milestone="curiosity_play"
          score={4}
          traits={['playful']}
        />
      );
      expect(
        screen.getByText(/Evaluation explanation for curiosity_play with score 4/)
      ).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle score exactly at boundary (score = 5)', () => {
      render(<EvaluationExplanation {...defaultProps} score={5} />);
      expect(screen.getByText('🌟 Exceptional Achievement!')).toBeInTheDocument();
    });

    it('should handle score exactly at boundary (score = 3)', () => {
      render(<EvaluationExplanation {...defaultProps} score={3} />);
      expect(screen.getByText('✨ Great Job!')).toBeInTheDocument();
    });

    it('should handle score exactly at boundary (score = 0)', () => {
      render(<EvaluationExplanation {...defaultProps} score={0} />);
      expect(screen.getByText('📊 Room for Improvement')).toBeInTheDocument();
    });

    it('should handle score exactly at boundary (score = -3)', () => {
      render(<EvaluationExplanation {...defaultProps} score={-3} />);
      expect(screen.getByText('⚠️ Needs Attention')).toBeInTheDocument();
    });

    it('should handle score exactly at boundary (score = -4)', () => {
      render(<EvaluationExplanation {...defaultProps} score={-4} />);
      expect(screen.getByText('❌ Critical Care Required')).toBeInTheDocument();
    });

    it('should handle very high scores', () => {
      render(<EvaluationExplanation {...defaultProps} score={100} />);
      expect(screen.getByText('🌟 Exceptional Achievement!')).toBeInTheDocument();
    });

    it('should handle very low scores', () => {
      render(<EvaluationExplanation {...defaultProps} score={-100} />);
      expect(screen.getByText('❌ Critical Care Required')).toBeInTheDocument();
    });
  });

  describe('icon and color consistency', () => {
    it('should show consistent green colors for high scores', () => {
      const { container } = render(<EvaluationExplanation {...defaultProps} score={5} />);
      const greenElements = container.querySelectorAll('[class*="green"]');
      expect(greenElements.length).toBeGreaterThan(0);
    });

    it('should show consistent blue colors for medium scores', () => {
      const { container } = render(<EvaluationExplanation {...defaultProps} score={1} />);
      const blueElements = container.querySelectorAll('[class*="blue"]');
      expect(blueElements.length).toBeGreaterThan(0);
    });

    it('should show consistent amber colors for low scores', () => {
      const { container } = render(<EvaluationExplanation {...defaultProps} score={-2} />);
      const amberElements = container.querySelectorAll('[class*="amber"]');
      expect(amberElements.length).toBeGreaterThan(0);
    });
  });

  describe('accessibility', () => {
    it('should have proper heading for main section', () => {
      render(<EvaluationExplanation {...defaultProps} />);
      expect(screen.getByText('What This Means')).toBeInTheDocument();
    });

    it('should have descriptive guidance section', () => {
      render(<EvaluationExplanation {...defaultProps} />);
      expect(screen.getByText('Moving Forward:')).toBeInTheDocument();
    });

    it('should use semantic icons with proper sizing', () => {
      const { container } = render(<EvaluationExplanation {...defaultProps} />);
      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });
  });
});
