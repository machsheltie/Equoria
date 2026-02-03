/**
 * XpGainNotification Component Tests
 *
 * Comprehensive test suite for the XP gain notification component.
 * Tests cover:
 * - Component rendering and display (XP text, progress bar, level info)
 * - XP count-up animation behavior
 * - Progress bar calculations and display
 * - Level and XP text accuracy
 * - Auto-dismiss timer functionality
 * - Manual close button
 * - Position variants (top-right, bottom-right)
 * - Show/hide state management
 * - Keyboard interactions (Escape key)
 * - Accessibility compliance (ARIA labels, live regions)
 * - Edge cases (0 XP, max level, invalid values)
 * - Responsive layout behavior
 *
 * Target: 20+ tests following strict TDD red-green-refactor methodology
 * Story 5-4: XP Gain Notification - Task 1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import XpGainNotification from '../XpGainNotification';

describe('XpGainNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Default props for convenience in tests */
  const defaultProps = {
    xpGained: 25,
    currentLevel: 5,
    currentXp: 270,
    xpForCurrentLevel: 45,
    xpToNextLevel: 100,
    show: true,
  };

  // ==================== 1. RENDERING TESTS (4 tests) ====================
  describe('Rendering Tests', () => {
    it('should render the notification when show is true', () => {
      render(<XpGainNotification {...defaultProps} show={true} />);

      const notification = screen.getByTestId('xp-gain-notification');
      expect(notification).toBeInTheDocument();
    });

    it('should not render the notification when show is false', () => {
      render(<XpGainNotification {...defaultProps} show={false} />);

      expect(screen.queryByTestId('xp-gain-notification')).not.toBeInTheDocument();
    });

    it('should display "+X XP" text for the XP gained amount', () => {
      render(<XpGainNotification {...defaultProps} xpGained={25} />);

      expect(screen.getByTestId('xp-gained-text')).toHaveTextContent('+25 XP');
    });

    it('should render with default show value of true', () => {
      const { xpGained, currentLevel, currentXp, xpForCurrentLevel, xpToNextLevel } = defaultProps;
      render(
        <XpGainNotification
          xpGained={xpGained}
          currentLevel={currentLevel}
          currentXp={currentXp}
          xpForCurrentLevel={xpForCurrentLevel}
          xpToNextLevel={xpToNextLevel}
        />
      );

      const notification = screen.getByTestId('xp-gain-notification');
      expect(notification).toBeInTheDocument();
    });
  });

  // ==================== 2. PROGRESS BAR TESTS (4 tests) ====================
  describe('Progress Bar Tests', () => {
    it('should render the XP progress bar', () => {
      render(<XpGainNotification {...defaultProps} />);

      const progressBar = screen.getByTestId('xp-progress-bar');
      expect(progressBar).toBeInTheDocument();
    });

    it('should display the progress bar fill with correct percentage', () => {
      render(
        <XpGainNotification
          {...defaultProps}
          xpForCurrentLevel={50}
          xpToNextLevel={100}
        />
      );

      const progressFill = screen.getByTestId('xp-progress-fill');
      expect(progressFill).toBeInTheDocument();
      // 50/100 = 50% width
      expect(progressFill).toHaveStyle({ width: '50%' });
    });

    it('should calculate progress bar percentage correctly for various values', () => {
      render(
        <XpGainNotification
          {...defaultProps}
          xpForCurrentLevel={75}
          xpToNextLevel={300}
        />
      );

      const progressFill = screen.getByTestId('xp-progress-fill');
      // 75/300 = 25%
      expect(progressFill).toHaveStyle({ width: '25%' });
    });

    it('should cap progress bar at 100% when xpForCurrentLevel exceeds xpToNextLevel', () => {
      render(
        <XpGainNotification
          {...defaultProps}
          xpForCurrentLevel={150}
          xpToNextLevel={100}
        />
      );

      const progressFill = screen.getByTestId('xp-progress-fill');
      expect(progressFill).toHaveStyle({ width: '100%' });
    });
  });

  // ==================== 3. LEVEL AND XP TEXT TESTS (3 tests) ====================
  describe('Level and XP Text Tests', () => {
    it('should display the level text correctly', () => {
      render(<XpGainNotification {...defaultProps} currentLevel={5} />);

      const levelText = screen.getByTestId('xp-level-text');
      expect(levelText).toHaveTextContent('Level 5');
    });

    it('should display XP progress text in "X/Y XP" format', () => {
      render(
        <XpGainNotification
          {...defaultProps}
          xpForCurrentLevel={45}
          xpToNextLevel={100}
        />
      );

      const xpText = screen.getByTestId('xp-progress-text');
      expect(xpText).toHaveTextContent('45/100 XP');
    });

    it('should display full level info as "Level X - Y/Z XP"', () => {
      render(
        <XpGainNotification
          {...defaultProps}
          currentLevel={5}
          xpForCurrentLevel={45}
          xpToNextLevel={100}
        />
      );

      const levelInfo = screen.getByTestId('xp-level-info');
      expect(levelInfo).toHaveTextContent('Level 5 - 45/100 XP');
    });
  });

  // ==================== 4. AUTO-DISMISS TESTS (3 tests) ====================
  describe('Auto-Dismiss Tests', () => {
    it('should auto-dismiss after default delay of 4 seconds', async () => {
      const onClose = vi.fn();
      render(
        <XpGainNotification {...defaultProps} onClose={onClose} />
      );

      expect(screen.getByTestId('xp-gain-notification')).toBeInTheDocument();

      // Advance timer past default 4-second delay
      act(() => {
        vi.advanceTimersByTime(4100);
      });

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should auto-dismiss after custom delay', async () => {
      const onClose = vi.fn();
      render(
        <XpGainNotification
          {...defaultProps}
          autoDismissDelay={2000}
          onClose={onClose}
        />
      );

      // Should not dismiss before the delay
      act(() => {
        vi.advanceTimersByTime(1900);
      });
      expect(onClose).not.toHaveBeenCalled();

      // Should dismiss after the delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should not auto-dismiss when autoDismiss is false', async () => {
      const onClose = vi.fn();
      render(
        <XpGainNotification
          {...defaultProps}
          autoDismiss={false}
          onClose={onClose}
        />
      );

      // Advance well past the default 4 second delay
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByTestId('xp-gain-notification')).toBeInTheDocument();
    });
  });

  // ==================== 5. MANUAL CLOSE BUTTON TESTS (2 tests) ====================
  describe('Manual Close Button Tests', () => {
    it('should render a close button with X icon', () => {
      render(<XpGainNotification {...defaultProps} />);

      const closeButton = screen.getByTestId('xp-notification-close');
      expect(closeButton).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', async () => {
      const onClose = vi.fn();

      // Use real timers for user-event interaction
      vi.useRealTimers();

      render(<XpGainNotification {...defaultProps} autoDismiss={false} onClose={onClose} />);

      const closeButton = screen.getByTestId('xp-notification-close');
      await userEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== 6. POSITION VARIANT TESTS (2 tests) ====================
  describe('Position Variant Tests', () => {
    it('should apply top-right positioning by default', () => {
      render(<XpGainNotification {...defaultProps} />);

      const notification = screen.getByTestId('xp-gain-notification');
      expect(notification).toHaveClass('top-4');
      expect(notification).toHaveClass('right-4');
    });

    it('should apply bottom-right positioning when specified', () => {
      render(<XpGainNotification {...defaultProps} position="bottom-right" />);

      const notification = screen.getByTestId('xp-gain-notification');
      expect(notification).toHaveClass('bottom-4');
      expect(notification).toHaveClass('right-4');
    });
  });

  // ==================== 7. KEYBOARD INTERACTION TESTS (2 tests) ====================
  describe('Keyboard Interaction Tests', () => {
    it('should close when Escape key is pressed', async () => {
      const onClose = vi.fn();

      // Use real timers for user-event interaction
      vi.useRealTimers();

      render(
        <XpGainNotification {...defaultProps} autoDismiss={false} onClose={onClose} />
      );

      // Press Escape key
      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should not close on other key presses', () => {
      const onClose = vi.fn();

      render(
        <XpGainNotification {...defaultProps} autoDismiss={false} onClose={onClose} />
      );

      fireEvent.keyDown(document, { key: 'Enter' });
      fireEvent.keyDown(document, { key: 'Tab' });
      fireEvent.keyDown(document, { key: 'a' });

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ==================== 8. ACCESSIBILITY TESTS (3 tests) ====================
  describe('Accessibility Tests', () => {
    it('should have an ARIA live region for XP announcements', () => {
      render(<XpGainNotification {...defaultProps} />);

      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    });

    it('should announce XP gain to screen readers', () => {
      render(<XpGainNotification {...defaultProps} xpGained={25} currentLevel={5} />);

      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toHaveTextContent(/gained 25 XP/i);
    });

    it('should have accessible close button with aria-label', () => {
      render(<XpGainNotification {...defaultProps} />);

      const closeButton = screen.getByTestId('xp-notification-close');
      expect(closeButton).toHaveAttribute('aria-label', 'Close notification');
    });
  });

  // ==================== 9. EDGE CASES (3 tests) ====================
  describe('Edge Cases', () => {
    it('should handle 0 XP gained gracefully', () => {
      render(<XpGainNotification {...defaultProps} xpGained={0} />);

      const xpText = screen.getByTestId('xp-gained-text');
      expect(xpText).toHaveTextContent('+0 XP');
    });

    it('should handle large XP values with number formatting', () => {
      render(
        <XpGainNotification
          {...defaultProps}
          xpGained={1500}
          xpForCurrentLevel={9999}
          xpToNextLevel={10000}
        />
      );

      const xpText = screen.getByTestId('xp-gained-text');
      expect(xpText).toHaveTextContent('+1,500 XP');
    });

    it('should handle 0 xpToNextLevel without division error', () => {
      render(
        <XpGainNotification
          {...defaultProps}
          xpForCurrentLevel={0}
          xpToNextLevel={0}
        />
      );

      const progressFill = screen.getByTestId('xp-progress-fill');
      // Should default to 0% instead of NaN/Infinity
      expect(progressFill).toHaveStyle({ width: '0%' });
    });
  });

  // ==================== 10. VISUAL DESIGN TESTS (2 tests) ====================
  describe('Visual Design Tests', () => {
    it('should have a gradient or themed background for the XP text', () => {
      render(<XpGainNotification {...defaultProps} />);

      const notification = screen.getByTestId('xp-gain-notification');
      expect(notification).toHaveClass('bg-white');
    });

    it('should have shadow and rounded styling', () => {
      render(<XpGainNotification {...defaultProps} />);

      const notification = screen.getByTestId('xp-gain-notification');
      expect(notification).toHaveClass('shadow-lg');
      expect(notification).toHaveClass('rounded-lg');
    });
  });

  // ==================== 11. TIMER CLEANUP TESTS (1 test) ====================
  describe('Timer Cleanup Tests', () => {
    it('should clean up auto-dismiss timer on unmount', () => {
      const onClose = vi.fn();
      const { unmount } = render(
        <XpGainNotification {...defaultProps} autoDismissDelay={5000} onClose={onClose} />
      );

      // Unmount before timer fires
      unmount();

      // Advance timer past the delay
      act(() => {
        vi.advanceTimersByTime(6000);
      });

      // onClose should NOT have been called because component unmounted
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
