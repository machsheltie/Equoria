/**
 * XpProgressBar Component Tests
 *
 * Comprehensive tests for the XP progress bar component including:
 * - Rendering with different percentages
 * - Color tier application (blue, orange, gold)
 * - Percentage boundaries (49%, 50%, 89%, 90%, 100%)
 * - Show/hide percentage text
 * - Progress width calculation
 * - Edge cases (0%, 100%, over 100%)
 * - Accessibility (ARIA progressbar attributes)
 *
 * Story 5-4 Task 3: XP Progress Tracker Component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import XpProgressBar from '../XpProgressBar';

describe('XpProgressBar', () => {
  describe('Rendering with different percentages', () => {
    it('should render with 0% progress', () => {
      render(
        <XpProgressBar
          currentXp={0}
          xpToNextLevel={100}
          progressPercent={0}
          colorTier="blue"
        />
      );
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });

    it('should render with 50% progress', () => {
      render(
        <XpProgressBar
          currentXp={50}
          xpToNextLevel={100}
          progressPercent={50}
          colorTier="orange"
        />
      );
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '50');
    });

    it('should render with 100% progress', () => {
      render(
        <XpProgressBar
          currentXp={100}
          xpToNextLevel={100}
          progressPercent={100}
          colorTier="gold"
        />
      );
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    });

    it('should set progress fill width based on progressPercent', () => {
      render(
        <XpProgressBar
          currentXp={75}
          xpToNextLevel={100}
          progressPercent={75}
          colorTier="orange"
        />
      );
      const progressFill = screen.getByTestId('xp-progress-fill');
      expect(progressFill).toHaveStyle({ width: '75%' });
    });
  });

  describe('Color tier application', () => {
    it('should apply blue color tier classes', () => {
      render(
        <XpProgressBar
          currentXp={30}
          xpToNextLevel={100}
          progressPercent={30}
          colorTier="blue"
        />
      );
      const progressFill = screen.getByTestId('xp-progress-fill');
      expect(progressFill).toHaveAttribute('data-color-tier', 'blue');
    });

    it('should apply orange color tier classes', () => {
      render(
        <XpProgressBar
          currentXp={60}
          xpToNextLevel={100}
          progressPercent={60}
          colorTier="orange"
        />
      );
      const progressFill = screen.getByTestId('xp-progress-fill');
      expect(progressFill).toHaveAttribute('data-color-tier', 'orange');
    });

    it('should apply gold color tier classes', () => {
      render(
        <XpProgressBar
          currentXp={95}
          xpToNextLevel={100}
          progressPercent={95}
          colorTier="gold"
        />
      );
      const progressFill = screen.getByTestId('xp-progress-fill');
      expect(progressFill).toHaveAttribute('data-color-tier', 'gold');
    });
  });

  describe('Percentage boundaries', () => {
    it('should use blue tier at 49%', () => {
      render(
        <XpProgressBar
          currentXp={49}
          xpToNextLevel={100}
          progressPercent={49}
          colorTier="blue"
        />
      );
      const progressFill = screen.getByTestId('xp-progress-fill');
      expect(progressFill).toHaveAttribute('data-color-tier', 'blue');
    });

    it('should use orange tier at exactly 50%', () => {
      render(
        <XpProgressBar
          currentXp={50}
          xpToNextLevel={100}
          progressPercent={50}
          colorTier="orange"
        />
      );
      const progressFill = screen.getByTestId('xp-progress-fill');
      expect(progressFill).toHaveAttribute('data-color-tier', 'orange');
    });

    it('should use orange tier at 89%', () => {
      render(
        <XpProgressBar
          currentXp={89}
          xpToNextLevel={100}
          progressPercent={89}
          colorTier="orange"
        />
      );
      const progressFill = screen.getByTestId('xp-progress-fill');
      expect(progressFill).toHaveAttribute('data-color-tier', 'orange');
    });

    it('should use gold tier at exactly 90%', () => {
      render(
        <XpProgressBar
          currentXp={90}
          xpToNextLevel={100}
          progressPercent={90}
          colorTier="gold"
        />
      );
      const progressFill = screen.getByTestId('xp-progress-fill');
      expect(progressFill).toHaveAttribute('data-color-tier', 'gold');
    });
  });

  describe('Show/hide percentage text', () => {
    it('should show percentage text when showPercentage is true', () => {
      render(
        <XpProgressBar
          currentXp={45}
          xpToNextLevel={100}
          progressPercent={45}
          colorTier="blue"
          showPercentage={true}
        />
      );
      expect(screen.getByText('45%')).toBeInTheDocument();
    });

    it('should hide percentage text when showPercentage is false', () => {
      render(
        <XpProgressBar
          currentXp={45}
          xpToNextLevel={100}
          progressPercent={45}
          colorTier="blue"
          showPercentage={false}
        />
      );
      expect(screen.queryByText('45%')).not.toBeInTheDocument();
    });

    it('should hide percentage text by default', () => {
      render(
        <XpProgressBar
          currentXp={45}
          xpToNextLevel={100}
          progressPercent={45}
          colorTier="blue"
        />
      );
      expect(screen.queryByText('45%')).not.toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should clamp progress width to 0% when progressPercent is negative', () => {
      render(
        <XpProgressBar
          currentXp={0}
          xpToNextLevel={100}
          progressPercent={-10}
          colorTier="blue"
        />
      );
      const progressFill = screen.getByTestId('xp-progress-fill');
      expect(progressFill).toHaveStyle({ width: '0%' });
    });

    it('should clamp progress width to 100% when progressPercent exceeds 100', () => {
      render(
        <XpProgressBar
          currentXp={150}
          xpToNextLevel={100}
          progressPercent={150}
          colorTier="gold"
        />
      );
      const progressFill = screen.getByTestId('xp-progress-fill');
      expect(progressFill).toHaveStyle({ width: '100%' });
    });

    it('should apply custom className when provided', () => {
      render(
        <XpProgressBar
          currentXp={50}
          xpToNextLevel={100}
          progressPercent={50}
          colorTier="orange"
          className="my-custom-class"
        />
      );
      const container = screen.getByTestId('xp-progress-bar');
      expect(container).toHaveClass('my-custom-class');
    });
  });

  describe('Accessibility', () => {
    it('should have role="progressbar"', () => {
      render(
        <XpProgressBar
          currentXp={50}
          xpToNextLevel={100}
          progressPercent={50}
          colorTier="orange"
        />
      );
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });

    it('should have aria-valuemin set to 0', () => {
      render(
        <XpProgressBar
          currentXp={50}
          xpToNextLevel={100}
          progressPercent={50}
          colorTier="orange"
        />
      );
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    });

    it('should have aria-valuemax set to 100', () => {
      render(
        <XpProgressBar
          currentXp={50}
          xpToNextLevel={100}
          progressPercent={50}
          colorTier="orange"
        />
      );
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });

    it('should have aria-valuenow reflecting the progress percent', () => {
      render(
        <XpProgressBar
          currentXp={73}
          xpToNextLevel={100}
          progressPercent={73}
          colorTier="orange"
        />
      );
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '73');
    });

    it('should have an accessible aria-label describing progress', () => {
      render(
        <XpProgressBar
          currentXp={50}
          xpToNextLevel={100}
          progressPercent={50}
          colorTier="orange"
        />
      );
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-label');
      expect(progressBar.getAttribute('aria-label')).toContain('50');
      expect(progressBar.getAttribute('aria-label')).toContain('100');
    });
  });
});
