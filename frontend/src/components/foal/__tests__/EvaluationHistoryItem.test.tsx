/**
 * Tests for EvaluationHistoryItem Component
 *
 * Testing Sprint Day 3+ - Story 6-4: Milestone Evaluation Display
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover:
 * - Summary view rendering (milestone, date, score, category)
 * - Expand/collapse functionality and state management
 * - Expanded view with score display and breakdown
 * - Trait display logic (0, 1-2, 3+ traits)
 * - onViewDetails callback integration
 * - defaultExpanded prop behavior
 * - Score formatting (positive/negative)
 * - Quick stats display
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EvaluationHistoryItem from '../EvaluationHistoryItem';
import type { MilestoneEvaluation } from '@/types/foal';

// Mock child components
vi.mock('../EvaluationScoreDisplay', () => ({
  default: vi.fn(({ score, size }) => (
    <div data-testid="evaluation-score-display" data-score={score} data-size={size}>
      Score: {score}
    </div>
  )),
}));

vi.mock('../ScoreBreakdownPanel', () => ({
  default: vi.fn(({ bondModifier, taskConsistency, careQuality, totalScore }) => (
    <div data-testid="score-breakdown-panel">
      Bond: {bondModifier}, Task: {taskConsistency}, Care: {careQuality}, Total: {totalScore}
    </div>
  )),
}));

// Mock foal type functions
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
    getEvaluationColor: vi.fn((score: number) => {
      if (score >= 3) return 'bg-green-100 text-green-700';
      if (score >= 0) return 'bg-blue-100 text-blue-700';
      return 'bg-amber-100 text-amber-700';
    }),
    formatMilestoneName: vi.fn((milestone: string) =>
      milestone
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    ),
  };
});

describe('EvaluationHistoryItem Component', () => {
  const mockEvaluation: MilestoneEvaluation = {
    milestone: 'socialization',
    milestoneName: 'Socialization',
    score: 4,
    traitsConfirmed: ['peopleOriented', 'confident', 'playful'],
    evaluatedAt: '2025-01-15T10:30:00.000Z',
    bondModifier: 2,
    taskConsistency: 2,
    careQuality: 0,
    scoreBreakdown: {
      bondModifier: 2,
      taskConsistency: 2,
      careQuality: 0,
    },
  };

  describe('summary view - always visible', () => {
    it('should render milestone name', () => {
      render(<EvaluationHistoryItem evaluation={mockEvaluation} />);
      expect(screen.getByText('Socialization')).toBeInTheDocument();
    });

    it('should format milestone name when milestoneName not provided', () => {
      const evaluation = { ...mockEvaluation, milestoneName: undefined };
      render(<EvaluationHistoryItem evaluation={evaluation} />);
      expect(screen.getByText('Socialization')).toBeInTheDocument();
    });

    it('should display formatted evaluation date', () => {
      render(<EvaluationHistoryItem evaluation={mockEvaluation} />);
      // Date should be formatted as "Jan 15, 2025"
      expect(screen.getByText(/Jan 15, 2025/)).toBeInTheDocument();
    });

    it('should display score with category', () => {
      render(<EvaluationHistoryItem evaluation={mockEvaluation} />);
      expect(screen.getByText('+4')).toBeInTheDocument();
      expect(screen.getByText('(Good)')).toBeInTheDocument();
    });

    it('should format positive scores with plus sign', () => {
      render(<EvaluationHistoryItem evaluation={mockEvaluation} />);
      expect(screen.getByText('+4')).toBeInTheDocument();
    });

    it('should format negative scores without plus sign', () => {
      const negativeEval = { ...mockEvaluation, score: -2 };
      render(<EvaluationHistoryItem evaluation={negativeEval} />);
      expect(screen.getByText('-2')).toBeInTheDocument();
    });

    it('should format zero score', () => {
      const zeroEval = { ...mockEvaluation, score: 0 };
      render(<EvaluationHistoryItem evaluation={zeroEval} />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should display first two traits in summary', () => {
      render(<EvaluationHistoryItem evaluation={mockEvaluation} />);
      expect(screen.getByText('peopleOriented')).toBeInTheDocument();
      expect(screen.getByText('confident')).toBeInTheDocument();
    });

    it('should show "+X more" for traits beyond first two', () => {
      render(<EvaluationHistoryItem evaluation={mockEvaluation} />);
      expect(screen.getByText('+1 more')).toBeInTheDocument();
    });

    it('should not show traits section when no traits', () => {
      const noTraitsEval = { ...mockEvaluation, traitsConfirmed: [] };
      render(<EvaluationHistoryItem evaluation={noTraitsEval} />);
      expect(screen.queryByText('Traits:')).not.toBeInTheDocument();
    });

    it('should show expand button when collapsed', () => {
      render(<EvaluationHistoryItem evaluation={mockEvaluation} />);
      const expandButton = screen.getByLabelText('View details');
      expect(expandButton).toBeInTheDocument();
    });
  });

  describe('expand/collapse functionality', () => {
    it('should start collapsed by default', () => {
      render(<EvaluationHistoryItem evaluation={mockEvaluation} />);
      expect(screen.queryByTestId('evaluation-score-display')).not.toBeInTheDocument();
    });

    it('should expand when clicking summary area', () => {
      render(<EvaluationHistoryItem evaluation={mockEvaluation} />);
      const summaryArea = screen.getByRole('button', { name: /Expand.*evaluation details/ });
      fireEvent.click(summaryArea);
      expect(screen.getByTestId('evaluation-score-display')).toBeInTheDocument();
    });

    it('should collapse when clicking again', () => {
      render(<EvaluationHistoryItem evaluation={mockEvaluation} />);
      const summaryArea = screen.getByRole('button', { name: /Expand.*evaluation details/ });
      fireEvent.click(summaryArea);
      expect(screen.getByTestId('evaluation-score-display')).toBeInTheDocument();
      fireEvent.click(summaryArea);
      expect(screen.queryByTestId('evaluation-score-display')).not.toBeInTheDocument();
    });

    it('should expand when clicking expand button', () => {
      render(<EvaluationHistoryItem evaluation={mockEvaluation} />);
      const expandButton = screen.getByLabelText('View details');
      fireEvent.click(expandButton);
      expect(screen.getByTestId('evaluation-score-display')).toBeInTheDocument();
    });

    it('should show collapse button when expanded', () => {
      render(<EvaluationHistoryItem evaluation={mockEvaluation} />);
      const expandButton = screen.getByLabelText('View details');
      fireEvent.click(expandButton);
      expect(screen.getByLabelText('Collapse details')).toBeInTheDocument();
    });

    it('should prevent event bubbling on button click', () => {
      const onViewDetails = vi.fn();
      render(<EvaluationHistoryItem evaluation={mockEvaluation} onViewDetails={onViewDetails} />);
      const expandButton = screen.getByLabelText('View details');
      fireEvent.click(expandButton);
      // onViewDetails should be called once (for toggle), not twice (once for button, once for summary)
      expect(onViewDetails).toHaveBeenCalledTimes(1);
    });
  });

  describe('defaultExpanded prop', () => {
    it('should start expanded when defaultExpanded=true', () => {
      render(<EvaluationHistoryItem evaluation={mockEvaluation} defaultExpanded={true} />);
      expect(screen.getByTestId('evaluation-score-display')).toBeInTheDocument();
    });

    it('should show collapse button when defaultExpanded=true', () => {
      render(<EvaluationHistoryItem evaluation={mockEvaluation} defaultExpanded={true} />);
      expect(screen.getByLabelText('Collapse details')).toBeInTheDocument();
    });

    it('should allow collapsing when started as defaultExpanded', () => {
      render(<EvaluationHistoryItem evaluation={mockEvaluation} defaultExpanded={true} />);
      const collapseButton = screen.getByLabelText('Collapse details');
      fireEvent.click(collapseButton);
      expect(screen.queryByTestId('evaluation-score-display')).not.toBeInTheDocument();
    });
  });

  describe('onViewDetails callback', () => {
    it('should call onViewDetails when expanding from collapsed', () => {
      const onViewDetails = vi.fn();
      render(<EvaluationHistoryItem evaluation={mockEvaluation} onViewDetails={onViewDetails} />);
      const summaryArea = screen.getByRole('button', { name: /Expand.*evaluation details/ });
      fireEvent.click(summaryArea);
      expect(onViewDetails).toHaveBeenCalledTimes(1);
    });

    it('should not call onViewDetails when collapsing', () => {
      const onViewDetails = vi.fn();
      render(<EvaluationHistoryItem evaluation={mockEvaluation} onViewDetails={onViewDetails} />);
      const summaryArea = screen.getByRole('button', { name: /Expand.*evaluation details/ });
      fireEvent.click(summaryArea);
      onViewDetails.mockClear();
      fireEvent.click(summaryArea);
      expect(onViewDetails).not.toHaveBeenCalled();
    });

    it('should not call onViewDetails when already expanded', () => {
      const onViewDetails = vi.fn();
      render(
        <EvaluationHistoryItem
          evaluation={mockEvaluation}
          onViewDetails={onViewDetails}
          defaultExpanded={true}
        />
      );
      expect(onViewDetails).not.toHaveBeenCalled();
    });
  });

  describe('expanded view content', () => {
    beforeEach(() => {
      render(<EvaluationHistoryItem evaluation={mockEvaluation} defaultExpanded={true} />);
    });

    it('should display EvaluationScoreDisplay component', () => {
      expect(screen.getByTestId('evaluation-score-display')).toBeInTheDocument();
      expect(screen.getByTestId('evaluation-score-display')).toHaveAttribute('data-score', '4');
      expect(screen.getByTestId('evaluation-score-display')).toHaveAttribute('data-size', 'small');
    });

    it('should display ScoreBreakdownPanel component', () => {
      expect(screen.getByTestId('score-breakdown-panel')).toBeInTheDocument();
      expect(screen.getByText(/Bond: 2, Task: 2, Care: 0, Total: 4/)).toBeInTheDocument();
    });

    it('should display "Traits Confirmed:" header', () => {
      expect(screen.getByText('Traits Confirmed:')).toBeInTheDocument();
    });

    it('should display all traits in expanded view', () => {
      const traitElements = screen.getAllByText('peopleOriented');
      expect(traitElements.length).toBeGreaterThan(1); // One in summary, one in expanded
      expect(screen.getAllByText('confident').length).toBeGreaterThan(1);
      expect(screen.getByText('playful')).toBeInTheDocument();
    });

    it('should display quick stats grid', () => {
      expect(screen.getByText('Bond')).toBeInTheDocument();
      expect(screen.getByText('Consistency')).toBeInTheDocument();
      expect(screen.getByText('Quality')).toBeInTheDocument();
    });

    it('should display bond modifier with correct formatting', () => {
      const bondValues = screen.getAllByText('+2');
      expect(bondValues.length).toBeGreaterThan(0);
    });

    it('should display task consistency', () => {
      const taskConsistencyValues = screen.getAllByText('+2');
      expect(taskConsistencyValues.length).toBeGreaterThan(0);
    });

    it('should display care quality', () => {
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  describe('trait display variations', () => {
    it('should handle single trait', () => {
      const singleTraitEval = { ...mockEvaluation, traitsConfirmed: ['peopleOriented'] };
      render(<EvaluationHistoryItem evaluation={singleTraitEval} />);
      expect(screen.getByText('peopleOriented')).toBeInTheDocument();
      expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument();
    });

    it('should handle exactly two traits', () => {
      const twoTraitsEval = { ...mockEvaluation, traitsConfirmed: ['peopleOriented', 'confident'] };
      render(<EvaluationHistoryItem evaluation={twoTraitsEval} />);
      expect(screen.getByText('peopleOriented')).toBeInTheDocument();
      expect(screen.getByText('confident')).toBeInTheDocument();
      expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument();
    });

    it('should show correct count for many traits', () => {
      const manyTraitsEval = {
        ...mockEvaluation,
        traitsConfirmed: ['trait1', 'trait2', 'trait3', 'trait4', 'trait5'],
      };
      render(<EvaluationHistoryItem evaluation={manyTraitsEval} />);
      expect(screen.getByText('+3 more')).toBeInTheDocument();
    });
  });

  describe('score formatting and colors', () => {
    it('should show green color for positive bond modifier', () => {
      const positiveEval = { ...mockEvaluation, bondModifier: 3 };
      const { container } = render(
        <EvaluationHistoryItem evaluation={positiveEval} defaultExpanded={true} />
      );
      const greenElements = container.querySelectorAll('[class*="green"]');
      expect(greenElements.length).toBeGreaterThan(0);
    });

    it('should show red color for negative bond modifier', () => {
      const negativeEval = { ...mockEvaluation, bondModifier: -2 };
      const { container } = render(
        <EvaluationHistoryItem evaluation={negativeEval} defaultExpanded={true} />
      );
      const redElements = container.querySelectorAll('[class*="red"]');
      expect(redElements.length).toBeGreaterThan(0);
    });

    it('should show slate color for zero bond modifier', () => {
      const zeroEval = { ...mockEvaluation, bondModifier: 0 };
      const { container } = render(
        <EvaluationHistoryItem evaluation={zeroEval} defaultExpanded={true} />
      );
      const slateElements = container.querySelectorAll('[class*="slate-600"]');
      expect(slateElements.length).toBeGreaterThan(0);
    });

    it('should format positive care quality with plus sign', () => {
      const positiveQualityEval = { ...mockEvaluation, careQuality: 1 };
      render(<EvaluationHistoryItem evaluation={positiveQualityEval} defaultExpanded={true} />);
      const positiveValues = screen.getAllByText('+1');
      expect(positiveValues.length).toBeGreaterThan(0);
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA attributes on summary button', () => {
      render(<EvaluationHistoryItem evaluation={mockEvaluation} />);
      const summaryButton = screen.getByRole('button', { name: /Expand.*evaluation details/ });
      expect(summaryButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('should update ARIA expanded when opened', () => {
      render(<EvaluationHistoryItem evaluation={mockEvaluation} />);
      const summaryButton = screen.getByRole('button', { name: /Expand.*evaluation details/ });
      fireEvent.click(summaryButton);
      expect(summaryButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('should have descriptive aria-label for expand/collapse buttons', () => {
      render(<EvaluationHistoryItem evaluation={mockEvaluation} />);
      expect(screen.getByLabelText('View details')).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText('View details'));
      expect(screen.getByLabelText('Collapse details')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle evaluation with no score breakdown', () => {
      const noBreakdown = { ...mockEvaluation, scoreBreakdown: undefined };
      render(<EvaluationHistoryItem evaluation={noBreakdown} defaultExpanded={true} />);
      expect(screen.getByTestId('score-breakdown-panel')).toBeInTheDocument();
    });

    it('should handle very long milestone names', () => {
      const longNameEval = {
        ...mockEvaluation,
        milestoneName: 'Very Long Milestone Name That Should Wrap Properly',
      };
      render(<EvaluationHistoryItem evaluation={longNameEval} />);
      expect(
        screen.getByText('Very Long Milestone Name That Should Wrap Properly')
      ).toBeInTheDocument();
    });

    it('should handle very old dates', () => {
      const oldDateEval = { ...mockEvaluation, evaluatedAt: '2020-06-15T12:00:00.000Z' };
      render(<EvaluationHistoryItem evaluation={oldDateEval} />);
      expect(screen.getByText(/2020/)).toBeInTheDocument();
    });

    it('should handle negative task consistency', () => {
      const negativeConsistency = { ...mockEvaluation, taskConsistency: -1 };
      render(<EvaluationHistoryItem evaluation={negativeConsistency} defaultExpanded={true} />);
      expect(screen.getByTestId('score-breakdown-panel')).toBeInTheDocument();
    });
  });
});
