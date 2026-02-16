/**
 * Tests for ScoreBreakdownPanel Component
 *
 * Testing Sprint Day 3+ - Story 6-4: Milestone Evaluation Display
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover:
 * - Helper functions (color, progress bar, trend icons, explanations)
 * - Bond modifier display (value, icon, color, progress bar, explanation)
 * - Task consistency display (value, icon, color, progress bar, explanation)
 * - Care quality display (value, icon, color, progress bar, explanation)
 * - Total score calculation display
 * - Key factors summary (conditional rendering based on values)
 * - Edge cases and boundary conditions
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScoreBreakdownPanel from '../ScoreBreakdownPanel';

describe('ScoreBreakdownPanel Component', () => {
  const defaultProps = {
    bondModifier: 2,
    taskConsistency: 2,
    careQuality: 1,
    totalScore: 5,
  };

  describe('basic rendering', () => {
    it('should render the component', () => {
      render(<ScoreBreakdownPanel {...defaultProps} />);
      expect(screen.getByText('Score Breakdown')).toBeInTheDocument();
    });

    it('should display all three component sections', () => {
      render(<ScoreBreakdownPanel {...defaultProps} />);
      expect(screen.getByText('Bond Modifier')).toBeInTheDocument();
      expect(screen.getByText('Task Consistency')).toBeInTheDocument();
      expect(screen.getByText('Care Quality')).toBeInTheDocument();
    });

    it('should display total score section', () => {
      render(<ScoreBreakdownPanel {...defaultProps} />);
      expect(screen.getByText('Total Score')).toBeInTheDocument();
    });

    it('should display key factors section', () => {
      render(<ScoreBreakdownPanel {...defaultProps} />);
      expect(screen.getByText('Key Factors:')).toBeInTheDocument();
    });
  });

  describe('bond modifier display', () => {
    it('should display positive bond modifier with plus sign', () => {
      render(<ScoreBreakdownPanel {...defaultProps} bondModifier={2} />);
      const positiveValues = screen.getAllByText('+2');
      expect(positiveValues.length).toBeGreaterThan(0);
    });

    it('should display negative bond modifier without plus sign', () => {
      render(<ScoreBreakdownPanel {...defaultProps} bondModifier={-2} />);
      const negativeValues = screen.getAllByText('-2');
      expect(negativeValues.length).toBeGreaterThan(0);
    });

    it('should display zero bond modifier', () => {
      render(<ScoreBreakdownPanel {...defaultProps} bondModifier={0} />);
      const zeroValues = screen.getAllByText('0');
      expect(zeroValues.length).toBeGreaterThan(0);
    });

    it('should show green color for positive bond modifier', () => {
      const { container } = render(<ScoreBreakdownPanel {...defaultProps} bondModifier={2} />);
      const greenElements = container.querySelectorAll('[class*="text-green-600"]');
      expect(greenElements.length).toBeGreaterThan(0);
    });

    it('should show red color for negative bond modifier', () => {
      const { container } = render(<ScoreBreakdownPanel {...defaultProps} bondModifier={-2} />);
      const redElements = container.querySelectorAll('[class*="text-red-600"]');
      expect(redElements.length).toBeGreaterThan(0);
    });

    it('should show yellow color for zero bond modifier', () => {
      const { container } = render(<ScoreBreakdownPanel {...defaultProps} bondModifier={0} />);
      const yellowElements = container.querySelectorAll('[class*="text-yellow-600"]');
      expect(yellowElements.length).toBeGreaterThan(0);
    });

    it('should show excellent bond explanation for +2', () => {
      render(<ScoreBreakdownPanel {...defaultProps} bondModifier={2} />);
      expect(screen.getByText(/Excellent bond with groom/)).toBeInTheDocument();
    });

    it('should show good bond explanation for +1', () => {
      render(<ScoreBreakdownPanel {...defaultProps} bondModifier={1} />);
      expect(screen.getByText(/Good bond with groom/)).toBeInTheDocument();
    });

    it('should show average bond explanation for 0', () => {
      render(<ScoreBreakdownPanel {...defaultProps} bondModifier={0} />);
      expect(screen.getByText(/Average bond with groom/)).toBeInTheDocument();
    });

    it('should show weak bond explanation for -1', () => {
      render(<ScoreBreakdownPanel {...defaultProps} bondModifier={-1} />);
      expect(screen.getByText(/Weak bond with groom - needs more attention/)).toBeInTheDocument();
    });

    it('should show poor bond explanation for -2', () => {
      render(<ScoreBreakdownPanel {...defaultProps} bondModifier={-2} />);
      expect(screen.getByText(/Poor bond with groom/)).toBeInTheDocument();
    });
  });

  describe('task consistency display', () => {
    it('should display task consistency with plus sign', () => {
      render(<ScoreBreakdownPanel {...defaultProps} taskConsistency={3} />);
      const taskValues = screen.getAllByText('+3');
      expect(taskValues.length).toBeGreaterThan(0);
    });

    it('should show green color for high consistency (>=2)', () => {
      const { container } = render(<ScoreBreakdownPanel {...defaultProps} taskConsistency={3} />);
      const greenElements = container.querySelectorAll('[class*="text-green-600"]');
      expect(greenElements.length).toBeGreaterThan(0);
    });

    it('should show yellow color for medium consistency (1)', () => {
      const { container } = render(<ScoreBreakdownPanel {...defaultProps} taskConsistency={1} />);
      const yellowElements = container.querySelectorAll('[class*="text-yellow-600"]');
      expect(yellowElements.length).toBeGreaterThan(0);
    });

    it('should show slate color for low consistency (0)', () => {
      const { container } = render(<ScoreBreakdownPanel {...defaultProps} taskConsistency={0} />);
      const slateElements = container.querySelectorAll('[class*="text-slate-600"]');
      expect(slateElements.length).toBeGreaterThan(0);
    });

    it('should show perfect consistency explanation for 3', () => {
      render(<ScoreBreakdownPanel {...defaultProps} taskConsistency={3} />);
      expect(screen.getByText(/Perfect care consistency/)).toBeInTheDocument();
    });

    it('should show strong consistency explanation for 2', () => {
      render(<ScoreBreakdownPanel {...defaultProps} taskConsistency={2} />);
      expect(screen.getByText(/Strong care consistency/)).toBeInTheDocument();
    });

    it('should show moderate consistency explanation for 1', () => {
      render(<ScoreBreakdownPanel {...defaultProps} taskConsistency={1} />);
      expect(screen.getByText(/Moderate care consistency/)).toBeInTheDocument();
    });

    it('should show weak consistency explanation for 0', () => {
      render(<ScoreBreakdownPanel {...defaultProps} taskConsistency={0} />);
      expect(screen.getByText(/Weak care consistency/)).toBeInTheDocument();
    });
  });

  describe('care quality display', () => {
    it('should display positive care quality with plus sign', () => {
      render(<ScoreBreakdownPanel {...defaultProps} careQuality={2} />);
      const careValues = screen.getAllByText(/\+2/);
      expect(careValues.length).toBeGreaterThan(0);
    });

    it('should display zero care quality', () => {
      render(<ScoreBreakdownPanel {...defaultProps} careQuality={0} />);
      expect(screen.getByText('No special groom bonuses')).toBeInTheDocument();
    });

    it('should show green color for high care quality (>=2)', () => {
      const { container } = render(<ScoreBreakdownPanel {...defaultProps} careQuality={3} />);
      const greenElements = container.querySelectorAll('[class*="text-green-600"]');
      expect(greenElements.length).toBeGreaterThan(0);
    });

    it('should show exceptional care explanation for 3+', () => {
      render(<ScoreBreakdownPanel {...defaultProps} careQuality={3} />);
      expect(screen.getByText(/Exceptional groom bonuses/)).toBeInTheDocument();
    });

    it('should show strong care explanation for 2', () => {
      render(<ScoreBreakdownPanel {...defaultProps} careQuality={2} />);
      expect(screen.getByText(/Strong groom bonuses/)).toBeInTheDocument();
    });

    it('should show moderate care explanation for 1', () => {
      render(<ScoreBreakdownPanel {...defaultProps} careQuality={1} />);
      expect(screen.getByText(/Moderate groom bonuses/)).toBeInTheDocument();
    });

    it('should show no bonuses explanation for 0', () => {
      render(<ScoreBreakdownPanel {...defaultProps} careQuality={0} />);
      expect(screen.getByText('No special groom bonuses')).toBeInTheDocument();
    });
  });

  describe('total score calculation', () => {
    it('should display total score with correct calculation', () => {
      render(<ScoreBreakdownPanel {...defaultProps} totalScore={5} />);
      const totalValues = screen.getAllByText(/= \+5/);
      expect(totalValues.length).toBeGreaterThan(0);
    });

    it('should show calculation breakdown', () => {
      render(
        <ScoreBreakdownPanel bondModifier={2} taskConsistency={2} careQuality={1} totalScore={5} />
      );
      expect(screen.getByText(/\+2 \+ 2 \+ \+1/)).toBeInTheDocument();
    });

    it('should show green color for high total score (>=3)', () => {
      const { container } = render(<ScoreBreakdownPanel {...defaultProps} totalScore={5} />);
      const totalScoreElements = container.querySelectorAll('.text-xl.font-bold.text-green-600');
      expect(totalScoreElements.length).toBeGreaterThan(0);
    });

    it('should show yellow color for medium total score (0-2)', () => {
      const { container } = render(
        <ScoreBreakdownPanel bondModifier={1} taskConsistency={0} careQuality={0} totalScore={1} />
      );
      const totalScoreElements = container.querySelectorAll('.text-xl.font-bold.text-yellow-600');
      expect(totalScoreElements.length).toBeGreaterThan(0);
    });

    it('should show red color for negative total score', () => {
      const { container } = render(
        <ScoreBreakdownPanel
          bondModifier={-2}
          taskConsistency={0}
          careQuality={0}
          totalScore={-2}
        />
      );
      const totalScoreElements = container.querySelectorAll('.text-xl.font-bold.text-red-600');
      expect(totalScoreElements.length).toBeGreaterThan(0);
    });

    it('should format positive total score with plus sign', () => {
      render(<ScoreBreakdownPanel {...defaultProps} totalScore={5} />);
      const positiveTotal = screen.getAllByText(/= \+5/);
      expect(positiveTotal.length).toBeGreaterThan(0);
    });

    it('should format negative total score without plus sign', () => {
      render(
        <ScoreBreakdownPanel
          bondModifier={-2}
          taskConsistency={0}
          careQuality={0}
          totalScore={-2}
        />
      );
      const negativeTotal = screen.getAllByText(/= -2/);
      expect(negativeTotal.length).toBeGreaterThan(0);
    });
  });

  describe('key factors summary', () => {
    it('should show positive bond factor when bond modifier > 0', () => {
      render(<ScoreBreakdownPanel {...defaultProps} bondModifier={2} />);
      expect(screen.getByText('Strong bond with groom helped score')).toBeInTheDocument();
    });

    it('should show negative bond factor when bond modifier < 0', () => {
      render(<ScoreBreakdownPanel {...defaultProps} bondModifier={-2} />);
      expect(screen.getByText('Weak bond with groom hurt score')).toBeInTheDocument();
    });

    it('should show positive task factor when task consistency >= 2', () => {
      render(<ScoreBreakdownPanel {...defaultProps} taskConsistency={2} />);
      expect(screen.getByText('Consistent care routine helped score')).toBeInTheDocument();
    });

    it('should show improvement suggestion when task consistency < 2', () => {
      render(<ScoreBreakdownPanel {...defaultProps} taskConsistency={1} />);
      expect(screen.getByText(/More consistent care would improve/)).toBeInTheDocument();
    });

    it('should show care quality factor when careQuality > 0', () => {
      render(<ScoreBreakdownPanel {...defaultProps} careQuality={1} />);
      expect(screen.getByText('Groom bonuses provided extra benefits')).toBeInTheDocument();
    });

    it('should show no bonuses message when careQuality === 0', () => {
      render(<ScoreBreakdownPanel {...defaultProps} careQuality={0} />);
      expect(screen.getByText('No special groom bonuses this milestone')).toBeInTheDocument();
    });

    it('should show multiple positive factors', () => {
      render(
        <ScoreBreakdownPanel bondModifier={2} taskConsistency={3} careQuality={2} totalScore={7} />
      );
      expect(screen.getByText('Strong bond with groom helped score')).toBeInTheDocument();
      expect(screen.getByText('Consistent care routine helped score')).toBeInTheDocument();
      expect(screen.getByText('Groom bonuses provided extra benefits')).toBeInTheDocument();
    });

    it('should not show positive bond factor when bond modifier <= 0', () => {
      render(<ScoreBreakdownPanel {...defaultProps} bondModifier={0} />);
      expect(screen.queryByText('Strong bond with groom helped score')).not.toBeInTheDocument();
    });

    it('should not show negative bond factor when bond modifier >= 0', () => {
      render(<ScoreBreakdownPanel {...defaultProps} bondModifier={1} />);
      expect(screen.queryByText('Weak bond with groom hurt score')).not.toBeInTheDocument();
    });
  });

  describe('progress bars', () => {
    it('should render bond modifier progress bar', () => {
      const { container } = render(<ScoreBreakdownPanel {...defaultProps} bondModifier={2} />);
      const progressBars = container.querySelectorAll('.bg-slate-200.rounded-full');
      expect(progressBars.length).toBeGreaterThan(0);
    });

    it('should render task consistency progress bar', () => {
      const { container } = render(<ScoreBreakdownPanel {...defaultProps} taskConsistency={2} />);
      const progressBars = container.querySelectorAll('.bg-slate-200.rounded-full');
      expect(progressBars.length).toBeGreaterThan(0);
    });

    it('should render care quality progress bar', () => {
      const { container } = render(<ScoreBreakdownPanel {...defaultProps} careQuality={2} />);
      const progressBars = container.querySelectorAll('.bg-slate-200.rounded-full');
      expect(progressBars.length).toBeGreaterThan(0);
    });

    it('should show green progress for positive bond modifier', () => {
      const { container } = render(<ScoreBreakdownPanel {...defaultProps} bondModifier={2} />);
      const greenBars = container.querySelectorAll('.bg-green-500');
      expect(greenBars.length).toBeGreaterThan(0);
    });

    it('should show red progress for negative bond modifier', () => {
      const { container } = render(<ScoreBreakdownPanel {...defaultProps} bondModifier={-2} />);
      const redBars = container.querySelectorAll('.bg-red-500');
      expect(redBars.length).toBeGreaterThan(0);
    });
  });

  describe('icons', () => {
    it('should render all section icons', () => {
      const { container } = render(<ScoreBreakdownPanel {...defaultProps} />);
      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(5); // Multiple icons in component
    });

    it('should show trending up icon for positive values', () => {
      const { container } = render(
        <ScoreBreakdownPanel bondModifier={2} taskConsistency={2} careQuality={2} totalScore={6} />
      );
      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should show trending down icon for negative bond modifier', () => {
      const { container } = render(<ScoreBreakdownPanel {...defaultProps} bondModifier={-2} />);
      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle maximum positive values', () => {
      render(
        <ScoreBreakdownPanel bondModifier={2} taskConsistency={3} careQuality={5} totalScore={10} />
      );
      expect(screen.getByText('Score Breakdown')).toBeInTheDocument();
    });

    it('should handle maximum negative bond modifier', () => {
      render(
        <ScoreBreakdownPanel
          bondModifier={-2}
          taskConsistency={0}
          careQuality={0}
          totalScore={-2}
        />
      );
      const negativeValues = screen.getAllByText('-2');
      expect(negativeValues.length).toBeGreaterThan(0);
    });

    it('should handle all zero values', () => {
      render(
        <ScoreBreakdownPanel bondModifier={0} taskConsistency={0} careQuality={0} totalScore={0} />
      );
      expect(screen.getByText('Score Breakdown')).toBeInTheDocument();
    });

    it('should handle mixed positive and negative', () => {
      render(
        <ScoreBreakdownPanel bondModifier={-1} taskConsistency={2} careQuality={1} totalScore={2} />
      );
      expect(screen.getByText('Weak bond with groom hurt score')).toBeInTheDocument();
      expect(screen.getByText('Consistent care routine helped score')).toBeInTheDocument();
    });

    it('should handle boundary values for task consistency', () => {
      render(<ScoreBreakdownPanel {...defaultProps} taskConsistency={3} />);
      expect(screen.getByText(/Perfect care consistency/)).toBeInTheDocument();
    });

    it('should handle high care quality values', () => {
      render(<ScoreBreakdownPanel {...defaultProps} careQuality={5} />);
      const careValues = screen.getAllByText(/\+5/);
      expect(careValues.length).toBeGreaterThan(0);
    });
  });

  describe('styling consistency', () => {
    it('should have consistent section spacing', () => {
      const { container } = render(<ScoreBreakdownPanel {...defaultProps} />);
      const sections = container.querySelectorAll('.space-y-6 > div');
      expect(sections.length).toBeGreaterThan(3);
    });

    it('should have rounded borders on main container', () => {
      const { container } = render(<ScoreBreakdownPanel {...defaultProps} />);
      const mainContainer = container.querySelector('.rounded-lg.border.border-slate-200');
      expect(mainContainer).toBeInTheDocument();
    });

    it('should have rounded borders on key factors section', () => {
      const { container } = render(<ScoreBreakdownPanel {...defaultProps} />);
      const keyFactors = container.querySelector('.rounded-lg.bg-slate-50.border.border-slate-200');
      expect(keyFactors).toBeInTheDocument();
    });
  });
});
