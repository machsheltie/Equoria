/**
 * XpProgressTracker Component Tests
 *
 * Comprehensive tests for the XP progress tracker component including:
 * - Rendering with linear mode
 * - Rendering with circular mode (stub/fallback)
 * - Level display
 * - XP text format ("X/Y XP")
 * - Percentage calculation accuracy
 * - Color tier determination from percentage
 * - Size variants (small, medium, large)
 * - Tooltip rendering and content
 * - Tooltip shows on hover
 * - Total XP display (when provided, when undefined)
 * - Edge cases (0 XP, max level, division by zero)
 * - Accessibility (ARIA labels, progressbar role)
 * - Integration with XpProgressBar
 *
 * Story 5-4 Task 3: XP Progress Tracker Component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import XpProgressTracker from '../XpProgressTracker';

describe('XpProgressTracker', () => {
  const defaultProps = {
    currentLevel: 5,
    currentXp: 245,
    xpForCurrentLevel: 45,
    xpToNextLevel: 100,
  };

  describe('Rendering with linear mode', () => {
    it('should render in linear mode by default', () => {
      render(<XpProgressTracker {...defaultProps} />);
      const container = screen.getByTestId('xp-progress-tracker');
      expect(container).toBeInTheDocument();
      expect(container).toHaveAttribute('data-mode', 'linear');
    });

    it('should render in linear mode when mode prop is "linear"', () => {
      render(<XpProgressTracker {...defaultProps} mode="linear" />);
      const container = screen.getByTestId('xp-progress-tracker');
      expect(container).toHaveAttribute('data-mode', 'linear');
    });

    it('should render a progressbar element', () => {
      render(<XpProgressTracker {...defaultProps} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });
  });

  describe('Rendering with circular mode', () => {
    it('should accept circular mode prop', () => {
      render(<XpProgressTracker {...defaultProps} mode="circular" />);
      const container = screen.getByTestId('xp-progress-tracker');
      expect(container).toHaveAttribute('data-mode', 'circular');
    });

    it('should still render a progressbar in circular mode', () => {
      render(<XpProgressTracker {...defaultProps} mode="circular" />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });
  });

  describe('Level display', () => {
    it('should display the current level number', () => {
      render(<XpProgressTracker {...defaultProps} />);
      expect(screen.getByTestId('xp-tracker-level')).toHaveTextContent('5');
    });

    it('should display "Level" label', () => {
      render(<XpProgressTracker {...defaultProps} />);
      expect(screen.getByText(/Level/)).toBeInTheDocument();
    });

    it('should update level display when level changes', () => {
      render(<XpProgressTracker {...defaultProps} currentLevel={10} />);
      expect(screen.getByTestId('xp-tracker-level')).toHaveTextContent('10');
    });
  });

  describe('XP text format', () => {
    it('should display XP progress in "X/Y XP" format', () => {
      render(<XpProgressTracker {...defaultProps} />);
      expect(screen.getByTestId('xp-tracker-text')).toHaveTextContent('45/100 XP');
    });

    it('should display correct XP text when values change', () => {
      render(
        <XpProgressTracker
          currentLevel={3}
          currentXp={150}
          xpForCurrentLevel={50}
          xpToNextLevel={200}
        />
      );
      expect(screen.getByTestId('xp-tracker-text')).toHaveTextContent('50/200 XP');
    });
  });

  describe('Percentage calculation accuracy', () => {
    it('should calculate 45% for 45/100', () => {
      render(<XpProgressTracker {...defaultProps} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '45');
    });

    it('should calculate 50% for 50/100', () => {
      render(
        <XpProgressTracker
          currentLevel={5}
          currentXp={250}
          xpForCurrentLevel={50}
          xpToNextLevel={100}
        />
      );
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '50');
    });

    it('should calculate 0% for 0/100', () => {
      render(
        <XpProgressTracker
          currentLevel={1}
          currentXp={0}
          xpForCurrentLevel={0}
          xpToNextLevel={100}
        />
      );
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
    });

    it('should calculate 100% when level XP equals XP to next', () => {
      render(
        <XpProgressTracker
          currentLevel={5}
          currentXp={500}
          xpForCurrentLevel={100}
          xpToNextLevel={100}
        />
      );
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    });
  });

  describe('Color tier determination', () => {
    it('should use blue tier when progress is less than 50%', () => {
      render(
        <XpProgressTracker
          currentLevel={5}
          currentXp={230}
          xpForCurrentLevel={30}
          xpToNextLevel={100}
        />
      );
      const progressFill = screen.getByTestId('xp-progress-fill');
      expect(progressFill).toHaveAttribute('data-color-tier', 'blue');
    });

    it('should use orange tier when progress is at 50%', () => {
      render(
        <XpProgressTracker
          currentLevel={5}
          currentXp={250}
          xpForCurrentLevel={50}
          xpToNextLevel={100}
        />
      );
      const progressFill = screen.getByTestId('xp-progress-fill');
      expect(progressFill).toHaveAttribute('data-color-tier', 'orange');
    });

    it('should use gold tier when progress is at 90% or above', () => {
      render(
        <XpProgressTracker
          currentLevel={5}
          currentXp={295}
          xpForCurrentLevel={95}
          xpToNextLevel={100}
        />
      );
      const progressFill = screen.getByTestId('xp-progress-fill');
      expect(progressFill).toHaveAttribute('data-color-tier', 'gold');
    });
  });

  describe('Size variants', () => {
    it('should render with small size', () => {
      render(<XpProgressTracker {...defaultProps} size="small" />);
      const container = screen.getByTestId('xp-progress-tracker');
      expect(container).toHaveAttribute('data-size', 'small');
    });

    it('should render with medium size by default', () => {
      render(<XpProgressTracker {...defaultProps} />);
      const container = screen.getByTestId('xp-progress-tracker');
      expect(container).toHaveAttribute('data-size', 'medium');
    });

    it('should render with large size', () => {
      render(<XpProgressTracker {...defaultProps} size="large" />);
      const container = screen.getByTestId('xp-progress-tracker');
      expect(container).toHaveAttribute('data-size', 'large');
    });
  });

  describe('Tooltip rendering', () => {
    it('should not render tooltip by default', () => {
      render(<XpProgressTracker {...defaultProps} />);
      expect(screen.queryByTestId('xp-tracker-tooltip')).not.toBeInTheDocument();
    });

    it('should render tooltip content on hover when showTooltip is true', async () => {
      const user = userEvent.setup();
      render(<XpProgressTracker {...defaultProps} showTooltip={true} totalXp={245} />);
      const trigger = screen.getByTestId('xp-tracker-tooltip-trigger');
      await user.hover(trigger);
      expect(screen.getByTestId('xp-tracker-tooltip')).toBeInTheDocument();
    });

    it('should show current level in tooltip', async () => {
      const user = userEvent.setup();
      render(<XpProgressTracker {...defaultProps} showTooltip={true} totalXp={245} />);
      const trigger = screen.getByTestId('xp-tracker-tooltip-trigger');
      await user.hover(trigger);
      const tooltip = screen.getByTestId('xp-tracker-tooltip');
      expect(tooltip).toHaveTextContent('Level 5');
    });

    it('should show XP progress in tooltip', async () => {
      const user = userEvent.setup();
      render(<XpProgressTracker {...defaultProps} showTooltip={true} totalXp={245} />);
      const trigger = screen.getByTestId('xp-tracker-tooltip-trigger');
      await user.hover(trigger);
      const tooltip = screen.getByTestId('xp-tracker-tooltip');
      expect(tooltip).toHaveTextContent('45/100 XP');
    });

    it('should show total lifetime XP in tooltip when provided', async () => {
      const user = userEvent.setup();
      render(<XpProgressTracker {...defaultProps} showTooltip={true} totalXp={245} />);
      const trigger = screen.getByTestId('xp-tracker-tooltip-trigger');
      await user.hover(trigger);
      const tooltip = screen.getByTestId('xp-tracker-tooltip');
      expect(tooltip).toHaveTextContent('245');
    });

    it('should not show total XP line in tooltip when totalXp is undefined', async () => {
      const user = userEvent.setup();
      render(<XpProgressTracker {...defaultProps} showTooltip={true} />);
      const trigger = screen.getByTestId('xp-tracker-tooltip-trigger');
      await user.hover(trigger);
      const tooltip = screen.getByTestId('xp-tracker-tooltip');
      expect(tooltip).not.toHaveTextContent('Total XP');
    });
  });

  describe('Edge cases', () => {
    it('should handle 0 XP at level 1', () => {
      render(
        <XpProgressTracker
          currentLevel={1}
          currentXp={0}
          xpForCurrentLevel={0}
          xpToNextLevel={100}
        />
      );
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
      expect(screen.getByTestId('xp-tracker-text')).toHaveTextContent('0/100 XP');
    });

    it('should handle division by zero when xpToNextLevel is 0', () => {
      render(
        <XpProgressTracker
          currentLevel={99}
          currentXp={9999}
          xpForCurrentLevel={99}
          xpToNextLevel={0}
        />
      );
      const progressBar = screen.getByRole('progressbar');
      // Should not crash, should show 0% or 100%
      const valueNow = Number(progressBar.getAttribute('aria-valuenow'));
      expect(valueNow).toBeGreaterThanOrEqual(0);
      expect(valueNow).toBeLessThanOrEqual(100);
    });

    it('should handle negative xpForCurrentLevel gracefully', () => {
      render(
        <XpProgressTracker
          currentLevel={1}
          currentXp={0}
          xpForCurrentLevel={-5}
          xpToNextLevel={100}
        />
      );
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
    });

    it('should apply custom className', () => {
      render(<XpProgressTracker {...defaultProps} className="my-tracker-class" />);
      const container = screen.getByTestId('xp-progress-tracker');
      expect(container).toHaveClass('my-tracker-class');
    });
  });

  describe('Accessibility', () => {
    it('should have an accessible aria-label on the tracker container', () => {
      render(<XpProgressTracker {...defaultProps} />);
      const container = screen.getByTestId('xp-progress-tracker');
      expect(container).toHaveAttribute('aria-label');
      expect(container.getAttribute('aria-label')).toContain('Level 5');
    });

    it('should have progressbar role with correct ARIA attributes', () => {
      render(<XpProgressTracker {...defaultProps} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      expect(progressBar).toHaveAttribute('aria-valuenow');
    });
  });

  describe('Integration with XpProgressBar', () => {
    it('should render the XpProgressBar sub-component with correct fill', () => {
      render(<XpProgressTracker {...defaultProps} />);
      const progressFill = screen.getByTestId('xp-progress-fill');
      expect(progressFill).toBeInTheDocument();
      expect(progressFill).toHaveStyle({ width: '45%' });
    });

    it('should pass color tier to XpProgressBar based on calculated percentage', () => {
      render(
        <XpProgressTracker
          currentLevel={5}
          currentXp={295}
          xpForCurrentLevel={95}
          xpToNextLevel={100}
        />
      );
      const progressFill = screen.getByTestId('xp-progress-fill');
      expect(progressFill).toHaveAttribute('data-color-tier', 'gold');
    });
  });
});
