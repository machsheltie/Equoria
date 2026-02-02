/**
 * Tests for ConformationScoreCard Component
 *
 * Tests cover:
 * - Score display rendering (numeric + progress bar)
 * - Quality rating badges with correct colors
 * - Breed comparison display and logic
 * - Click/keyboard interactions
 * - Accessibility (ARIA labels, keyboard nav)
 * - Responsive hover effects
 *
 * Story 3-5: Conformation Scoring UI - Task 2
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConformationScoreCard from '../ConformationScoreCard';

describe('ConformationScoreCard', () => {
  const defaultProps = {
    region: 'head',
    score: 85,
  };

  describe('Basic Rendering', () => {
    it('should render region name correctly', () => {
      render(<ConformationScoreCard {...defaultProps} />);
      expect(screen.getByText('Head')).toBeInTheDocument();
    });

    it('should render numeric score', () => {
      render(<ConformationScoreCard {...defaultProps} />);
      expect(screen.getByText('85')).toBeInTheDocument();
      expect(screen.getByText('/100')).toBeInTheDocument();
    });

    it('should capitalize region names', () => {
      render(<ConformationScoreCard region="neck" score={75} />);
      expect(screen.getByText('Neck')).toBeInTheDocument();
    });

    it('should render with default className', () => {
      const { container } = render(<ConformationScoreCard {...defaultProps} />);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('border', 'rounded-lg', 'p-4', 'bg-white');
    });

    it('should apply custom className', () => {
      const { container } = render(
        <ConformationScoreCard {...defaultProps} className="custom-class" />
      );
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('custom-class');
    });

    it('should render data-testid for the card', () => {
      render(<ConformationScoreCard {...defaultProps} />);
      expect(screen.getByTestId('conformation-score-card-head')).toBeInTheDocument();
    });
  });

  describe('Quality Rating Badge', () => {
    it('should display Excellent for scores 90-100', () => {
      render(<ConformationScoreCard region="head" score={95} />);
      expect(screen.getByText('Excellent')).toBeInTheDocument();
      expect(screen.getByTestId('quality-badge-head')).toHaveClass('text-emerald-700');
    });

    it('should display Very Good for scores 80-89', () => {
      render(<ConformationScoreCard region="head" score={85} />);
      expect(screen.getByText('Very Good')).toBeInTheDocument();
      expect(screen.getByTestId('quality-badge-head')).toHaveClass('text-blue-700');
    });

    it('should display Good for scores 70-79', () => {
      render(<ConformationScoreCard region="head" score={75} />);
      expect(screen.getByText('Good')).toBeInTheDocument();
      expect(screen.getByTestId('quality-badge-head')).toHaveClass('text-amber-700');
    });

    it('should display Average for scores 60-69', () => {
      render(<ConformationScoreCard region="head" score={65} />);
      expect(screen.getByText('Average')).toBeInTheDocument();
      expect(screen.getByTestId('quality-badge-head')).toHaveClass('text-slate-700');
    });

    it('should display Below Average for scores 50-59', () => {
      render(<ConformationScoreCard region="head" score={55} />);
      expect(screen.getByText('Below Average')).toBeInTheDocument();
      expect(screen.getByTestId('quality-badge-head')).toHaveClass('text-orange-700');
    });

    it('should display Poor for scores 0-49', () => {
      render(<ConformationScoreCard region="head" score={40} />);
      expect(screen.getByText('Poor')).toBeInTheDocument();
      expect(screen.getByTestId('quality-badge-head')).toHaveClass('text-rose-700');
    });
  });

  describe('Progress Bar', () => {
    it('should render progress bar with correct width', () => {
      render(<ConformationScoreCard region="head" score={75} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveStyle({ width: '75%' });
    });

    it('should render progress bar at 0% for score 0', () => {
      render(<ConformationScoreCard region="head" score={0} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveStyle({ width: '0%' });
    });

    it('should render progress bar at 100% for score 100', () => {
      render(<ConformationScoreCard region="head" score={100} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });

    it('should have correct ARIA attributes', () => {
      render(<ConformationScoreCard region="head" score={85} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '85');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });

    it('should apply correct color class for Excellent scores', () => {
      render(<ConformationScoreCard region="head" score={95} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveClass('bg-emerald-500');
    });

    it('should apply correct color class for Poor scores', () => {
      render(<ConformationScoreCard region="head" score={40} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveClass('bg-rose-500');
    });
  });

  describe('Breed Comparison', () => {
    it('should not show comparison when showComparison is false', () => {
      render(
        <ConformationScoreCard region="head" score={85} breedAverage={80} showComparison={false} />
      );
      expect(screen.queryByTestId('breed-comparison-head')).not.toBeInTheDocument();
    });

    it('should not show comparison when breedAverage is undefined', () => {
      render(<ConformationScoreCard region="head" score={85} showComparison={true} />);
      expect(screen.queryByTestId('breed-comparison-head')).not.toBeInTheDocument();
    });

    it('should show "Above Average" when score exceeds breed average', () => {
      render(
        <ConformationScoreCard region="head" score={90} breedAverage={80} showComparison={true} />
      );
      expect(screen.getByTestId('breed-comparison-head')).toHaveTextContent('Above Average');
      expect(screen.getByTestId('breed-comparison-head')).toHaveTextContent('(+10.0)');
    });

    it('should show "Below Average" when score is below breed average', () => {
      render(
        <ConformationScoreCard region="head" score={70} breedAverage={80} showComparison={true} />
      );
      expect(screen.getByTestId('breed-comparison-head')).toHaveTextContent('Below Average');
      expect(screen.getByTestId('breed-comparison-head')).toHaveTextContent('(-10.0)');
    });

    it('should show "Average" when scores are within 2 points', () => {
      render(
        <ConformationScoreCard region="head" score={81} breedAverage={80} showComparison={true} />
      );
      expect(screen.getByTestId('breed-comparison-head')).toHaveTextContent('Average');
      expect(screen.getByTestId('breed-comparison-head')).not.toHaveTextContent('(+');
    });

    it('should apply emerald color for Above Average', () => {
      render(
        <ConformationScoreCard region="head" score={90} breedAverage={80} showComparison={true} />
      );
      expect(screen.getByTestId('breed-comparison-head')).toHaveClass('text-emerald-700');
    });

    it('should apply rose color for Below Average', () => {
      render(
        <ConformationScoreCard region="head" score={70} breedAverage={80} showComparison={true} />
      );
      expect(screen.getByTestId('breed-comparison-head')).toHaveClass('text-rose-700');
    });

    it('should show breed average when comparison is not enabled', () => {
      render(<ConformationScoreCard region="head" score={85} breedAverage={80} />);
      expect(screen.getByTestId('breed-average-head')).toHaveTextContent('Breed avg: 80/100');
    });
  });

  describe('Click Interactions', () => {
    it('should call onRegionClick when card is clicked', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      render(<ConformationScoreCard {...defaultProps} onRegionClick={handleClick} />);

      const card = screen.getByTestId('conformation-score-card-head');
      await user.click(card);

      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledWith('head');
    });

    it('should not call onRegionClick when not provided', async () => {
      const user = userEvent.setup();
      render(<ConformationScoreCard {...defaultProps} />);

      const card = screen.getByTestId('conformation-score-card-head');
      await user.click(card);

      // Should not throw error
      expect(card).toBeInTheDocument();
    });

    it('should apply cursor-pointer class when onRegionClick is provided', () => {
      const handleClick = vi.fn();
      render(<ConformationScoreCard {...defaultProps} onRegionClick={handleClick} />);
      const card = screen.getByTestId('conformation-score-card-head');
      expect(card).toHaveClass('cursor-pointer');
    });

    it('should not apply cursor-pointer class when onRegionClick is not provided', () => {
      render(<ConformationScoreCard {...defaultProps} />);
      const card = screen.getByTestId('conformation-score-card-head');
      expect(card).not.toHaveClass('cursor-pointer');
    });
  });

  describe('Keyboard Interactions', () => {
    it('should call onRegionClick when Enter key is pressed', () => {
      const handleClick = vi.fn();
      render(<ConformationScoreCard {...defaultProps} onRegionClick={handleClick} />);

      const card = screen.getByTestId('conformation-score-card-head');
      fireEvent.keyDown(card, { key: 'Enter' });

      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledWith('head');
    });

    it('should call onRegionClick when Space key is pressed', () => {
      const handleClick = vi.fn();
      render(<ConformationScoreCard {...defaultProps} onRegionClick={handleClick} />);

      const card = screen.getByTestId('conformation-score-card-head');
      fireEvent.keyDown(card, { key: ' ' });

      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledWith('head');
    });

    it('should not call onRegionClick for other keys', () => {
      const handleClick = vi.fn();
      render(<ConformationScoreCard {...defaultProps} onRegionClick={handleClick} />);

      const card = screen.getByTestId('conformation-score-card-head');
      fireEvent.keyDown(card, { key: 'Tab' });
      fireEvent.keyDown(card, { key: 'Escape' });

      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should be focusable when onRegionClick is provided', () => {
      const handleClick = vi.fn();
      render(<ConformationScoreCard {...defaultProps} onRegionClick={handleClick} />);
      const card = screen.getByTestId('conformation-score-card-head');
      expect(card).toHaveAttribute('tabIndex', '0');
    });

    it('should not be focusable when onRegionClick is not provided', () => {
      render(<ConformationScoreCard {...defaultProps} />);
      const card = screen.getByTestId('conformation-score-card-head');
      expect(card).not.toHaveAttribute('tabIndex');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA label', () => {
      render(<ConformationScoreCard region="head" score={85} />);
      const card = screen.getByTestId('conformation-score-card-head');
      expect(card).toHaveAttribute('aria-label', 'Head conformation score: 85/100, Very Good');
    });

    it('should have button role when clickable', () => {
      const handleClick = vi.fn();
      render(<ConformationScoreCard {...defaultProps} onRegionClick={handleClick} />);
      const card = screen.getByTestId('conformation-score-card-head');
      expect(card).toHaveAttribute('role', 'button');
    });

    it('should not have button role when not clickable', () => {
      render(<ConformationScoreCard {...defaultProps} />);
      const card = screen.getByTestId('conformation-score-card-head');
      expect(card).not.toHaveAttribute('role');
    });

    it('should have accessible progress bar label', () => {
      render(<ConformationScoreCard region="head" score={85} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-label', 'Head score progress');
    });
  });

  describe('Tooltip', () => {
    it('should render info icon for region description', () => {
      render(<ConformationScoreCard {...defaultProps} />);
      // Info icon should be in the document
      const infoIcon = screen.getByTestId('conformation-score-card-head').querySelector('svg');
      expect(infoIcon).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle score of 0', () => {
      render(<ConformationScoreCard region="head" score={0} />);
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('Poor')).toBeInTheDocument();
    });

    it('should handle score of 100', () => {
      render(<ConformationScoreCard region="head" score={100} />);
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('Excellent')).toBeInTheDocument();
    });

    it('should round decimal scores for display', () => {
      render(<ConformationScoreCard region="head" score={85.7} />);
      expect(screen.getByText('86')).toBeInTheDocument(); // Math.round(85.7) = 86
    });

    it('should handle different region names', () => {
      const regions = ['head', 'neck', 'shoulder', 'back', 'hindquarters', 'legs', 'hooves'];
      regions.forEach((region) => {
        const { unmount } = render(<ConformationScoreCard region={region} score={75} />);
        expect(screen.getByTestId(`conformation-score-card-${region}`)).toBeInTheDocument();
        unmount();
      });
    });
  });
});
