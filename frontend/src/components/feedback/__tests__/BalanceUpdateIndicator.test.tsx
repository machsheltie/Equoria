/**
 * BalanceUpdateIndicator Component Tests
 *
 * Comprehensive test suite for the balance update indicator component.
 * Tests cover:
 * - Component rendering states (initial value, updated value, currency formatting)
 * - Animation behavior (counter animation, duration, completion callback)
 * - Overlay notifications (increase/decrease display, auto-fade)
 * - Visual effects (glow/pulse during animation, return to normal)
 * - Edge cases (no change handling)
 *
 * Target: 12+ tests following strict TDD methodology
 * Story 5-3: Balance Update Indicators - Task 4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import BalanceUpdateIndicator from '../BalanceUpdateIndicator';

describe('BalanceUpdateIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==================== 1. RENDERING TESTS (3 tests) ====================
  describe('Rendering Tests', () => {
    it('should render initial value correctly', () => {
      render(<BalanceUpdateIndicator oldValue={1000} newValue={1000} />);

      const display = screen.getByTestId('balance-display');
      expect(display).toBeInTheDocument();
      expect(screen.getByText('$1,000.00')).toBeInTheDocument();
    });

    it('should update to new value after animation', async () => {
      render(<BalanceUpdateIndicator oldValue={1000} newValue={1500} duration={500} />);

      // Advance timer to complete animation
      act(() => {
        vi.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(screen.getByText('$1,500.00')).toBeInTheDocument();
      });
    });

    it('should format currency correctly with comma separators and decimals', () => {
      render(<BalanceUpdateIndicator oldValue={1234567.89} newValue={1234567.89} />);

      expect(screen.getByText('$1,234,567.89')).toBeInTheDocument();
    });
  });

  // ==================== 2. ANIMATION TESTS (3 tests) ====================
  describe('Animation Tests', () => {
    it('should animate counter from old value to new value', async () => {
      render(<BalanceUpdateIndicator oldValue={100} newValue={200} duration={1000} />);

      const display = screen.getByTestId('balance-display');
      expect(display).toBeInTheDocument();

      // Initially shows old value or starts animating
      // After partial time, should show intermediate value
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // After full duration, should show new value
      act(() => {
        vi.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(screen.getByText('$200.00')).toBeInTheDocument();
      });
    });

    it('should respect animation duration parameter', async () => {
      const onComplete = vi.fn();
      render(
        <BalanceUpdateIndicator
          oldValue={100}
          newValue={200}
          duration={2000}
          onAnimationComplete={onComplete}
        />
      );

      // Advance timer to just before completion
      act(() => {
        vi.advanceTimersByTime(1900);
      });
      expect(onComplete).not.toHaveBeenCalled();

      // Advance past completion
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledTimes(1);
      });
    });

    it('should call onAnimationComplete when animation finishes', async () => {
      const onComplete = vi.fn();
      render(
        <BalanceUpdateIndicator
          oldValue={100}
          newValue={200}
          duration={500}
          onAnimationComplete={onComplete}
        />
      );

      // Advance timer to complete animation
      act(() => {
        vi.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ==================== 3. OVERLAY TESTS (3 tests) ====================
  describe('Overlay Tests', () => {
    it('should show "+$X" overlay for balance increase', () => {
      render(<BalanceUpdateIndicator oldValue={1000} newValue={1500} showOverlay={true} />);

      const overlay = screen.getByTestId('balance-overlay');
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveTextContent('+$500.00');
    });

    it('should show "-$X" overlay for balance decrease', () => {
      render(<BalanceUpdateIndicator oldValue={1500} newValue={1000} showOverlay={true} />);

      const overlay = screen.getByTestId('balance-overlay');
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveTextContent('-$500.00');
    });

    it('should fade out overlay after overlayDuration', async () => {
      render(
        <BalanceUpdateIndicator
          oldValue={1000}
          newValue={1500}
          showOverlay={true}
          overlayDuration={2000}
        />
      );

      // Overlay should be visible initially
      const overlay = screen.getByTestId('balance-overlay');
      expect(overlay).toBeInTheDocument();

      // Advance timer past overlay duration
      act(() => {
        vi.advanceTimersByTime(2100);
      });

      await waitFor(() => {
        expect(screen.queryByTestId('balance-overlay')).not.toBeInTheDocument();
      });
    });
  });

  // ==================== 4. VISUAL EFFECTS TESTS (2 tests) ====================
  describe('Visual Effects Tests', () => {
    it('should have glow/pulse class during animation', () => {
      render(<BalanceUpdateIndicator oldValue={100} newValue={200} duration={1000} />);

      const display = screen.getByTestId('balance-display');
      expect(display).toHaveClass('animate-pulse');
    });

    it('should return to normal styling after animation complete', async () => {
      render(<BalanceUpdateIndicator oldValue={100} newValue={200} duration={500} />);

      // Advance timer to complete animation
      act(() => {
        vi.advanceTimersByTime(600);
      });

      await waitFor(() => {
        const display = screen.getByTestId('balance-display');
        expect(display).not.toHaveClass('animate-pulse');
      });
    });
  });

  // ==================== 5. EDGE CASES TESTS (1 test) ====================
  describe('Edge Cases Tests', () => {
    it('should handle no change (old === new) gracefully', () => {
      const onComplete = vi.fn();
      render(
        <BalanceUpdateIndicator oldValue={1000} newValue={1000} onAnimationComplete={onComplete} />
      );

      const display = screen.getByTestId('balance-display');
      expect(display).toBeInTheDocument();
      expect(screen.getByText('$1,000.00')).toBeInTheDocument();

      // Should not show overlay when there's no change
      expect(screen.queryByTestId('balance-overlay')).not.toBeInTheDocument();

      // Should not have animation class when there's no change
      expect(display).not.toHaveClass('animate-pulse');
    });
  });

  // ==================== 6. ACCESSIBILITY TESTS (2 bonus tests) ====================
  describe('Accessibility Tests', () => {
    it('should have aria-live region for screen reader announcements', () => {
      render(<BalanceUpdateIndicator oldValue={1000} newValue={1500} />);

      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    });

    it('should announce balance change to screen readers', async () => {
      render(<BalanceUpdateIndicator oldValue={1000} newValue={1500} />);

      // Advance timer to complete animation
      act(() => {
        vi.advanceTimersByTime(1100);
      });

      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/balance.*1,500/i);
      });
    });
  });

  // ==================== 7. PROPS TESTS (2 bonus tests) ====================
  describe('Props Tests', () => {
    it('should use custom prefix when provided', () => {
      render(<BalanceUpdateIndicator oldValue={1000} newValue={1000} prefix="EUR " />);

      expect(screen.getByText('EUR 1,000.00')).toBeInTheDocument();
    });

    it('should use custom decimal places when provided', () => {
      render(<BalanceUpdateIndicator oldValue={1234.5678} newValue={1234.5678} decimals={0} />);

      expect(screen.getByText('$1,235')).toBeInTheDocument();
    });
  });
});
