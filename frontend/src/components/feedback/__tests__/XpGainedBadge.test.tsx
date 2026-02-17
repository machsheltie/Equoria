/**
 * XpGainedBadge Component Tests
 *
 * Comprehensive test suite for the XP gained badge component.
 * Tests cover:
 * - Component rendering states (show/hide, XP amount display)
 * - Animation behavior (scale-in entrance, pulse effect)
 * - Position variants (top-right, top-left, bottom-right, bottom-left)
 * - Fade-out behavior and callback
 *
 * Target: 10+ tests following strict TDD methodology
 * Story 5-3: Balance Update Indicators - Task 4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import XpGainedBadge from '../XpGainedBadge';

describe('XpGainedBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==================== 1. RENDERING TESTS (3 tests) ====================
  describe('Rendering Tests', () => {
    it('should render when show is true', () => {
      render(<XpGainedBadge xpAmount={150} show={true} />);

      const badge = screen.getByTestId('xp-gained-badge');
      expect(badge).toBeInTheDocument();
    });

    it('should not render when show is false', () => {
      render(<XpGainedBadge xpAmount={150} show={false} />);

      expect(screen.queryByTestId('xp-gained-badge')).not.toBeInTheDocument();
    });

    it('should display correct XP amount with "+X XP" format', () => {
      render(<XpGainedBadge xpAmount={250} show={true} />);

      const badge = screen.getByTestId('xp-gained-badge');
      expect(badge).toHaveTextContent('+250 XP');
    });
  });

  // ==================== 2. ANIMATION TESTS (2 tests) ====================
  describe('Animation Tests', () => {
    it('should have scale-in animation class when rendered', () => {
      render(<XpGainedBadge xpAmount={150} show={true} />);

      const badge = screen.getByTestId('xp-gained-badge');
      expect(badge).toHaveClass('animate-scale-in');
    });

    it('should have pulse animation class', () => {
      render(<XpGainedBadge xpAmount={150} show={true} />);

      const badge = screen.getByTestId('xp-gained-badge');
      expect(badge).toHaveClass('animate-pulse');
    });
  });

  // ==================== 3. POSITION TESTS (4 tests) ====================
  describe('Position Tests', () => {
    it('should position correctly for top-right (default)', () => {
      render(<XpGainedBadge xpAmount={150} show={true} position="top-right" />);

      const badge = screen.getByTestId('xp-gained-badge');
      expect(badge).toHaveClass('top-2');
      expect(badge).toHaveClass('right-2');
    });

    it('should position correctly for top-left', () => {
      render(<XpGainedBadge xpAmount={150} show={true} position="top-left" />);

      const badge = screen.getByTestId('xp-gained-badge');
      expect(badge).toHaveClass('top-2');
      expect(badge).toHaveClass('left-2');
    });

    it('should position correctly for bottom-right', () => {
      render(<XpGainedBadge xpAmount={150} show={true} position="bottom-right" />);

      const badge = screen.getByTestId('xp-gained-badge');
      expect(badge).toHaveClass('bottom-2');
      expect(badge).toHaveClass('right-2');
    });

    it('should position correctly for bottom-left', () => {
      render(<XpGainedBadge xpAmount={150} show={true} position="bottom-left" />);

      const badge = screen.getByTestId('xp-gained-badge');
      expect(badge).toHaveClass('bottom-2');
      expect(badge).toHaveClass('left-2');
    });
  });

  // ==================== 4. FADE-OUT TESTS (1 test) ====================
  describe('Fade-out Tests', () => {
    it('should call onFadeComplete after duration', async () => {
      const onFadeComplete = vi.fn();
      render(
        <XpGainedBadge xpAmount={150} show={true} duration={2000} onFadeComplete={onFadeComplete} />
      );

      // Badge should be visible
      expect(screen.getByTestId('xp-gained-badge')).toBeInTheDocument();

      // Advance timer to just before fade complete
      act(() => {
        vi.advanceTimersByTime(1900);
      });
      expect(onFadeComplete).not.toHaveBeenCalled();

      // Advance past fade duration
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(onFadeComplete).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ==================== 5. VISUAL DESIGN TESTS (3 bonus tests) ====================
  describe('Visual Design Tests', () => {
    it('should have gradient background styling', () => {
      render(<XpGainedBadge xpAmount={150} show={true} />);

      const badge = screen.getByTestId('xp-gained-badge');
      expect(badge).toHaveClass('bg-gradient-to-r');
      expect(badge).toHaveClass('from-blue-500');
      expect(badge).toHaveClass('to-purple-600');
    });

    it('should have white text for contrast', () => {
      render(<XpGainedBadge xpAmount={150} show={true} />);

      const badge = screen.getByTestId('xp-gained-badge');
      expect(badge).toHaveClass('text-white');
    });

    it('should have rounded pill shape and shadow', () => {
      render(<XpGainedBadge xpAmount={150} show={true} />);

      const badge = screen.getByTestId('xp-gained-badge');
      expect(badge).toHaveClass('rounded-full');
      expect(badge).toHaveClass('shadow-lg');
    });
  });

  // ==================== 6. ICON TESTS (1 bonus test) ====================
  describe('Icon Tests', () => {
    it('should display star icon prefix', () => {
      render(<XpGainedBadge xpAmount={150} show={true} />);

      const starIcon = screen.getByTestId('xp-star-icon');
      expect(starIcon).toBeInTheDocument();
    });
  });

  // ==================== 7. ABSOLUTE POSITIONING TEST (1 bonus test) ====================
  describe('Positioning Type Tests', () => {
    it('should have absolute positioning for overlay use', () => {
      render(<XpGainedBadge xpAmount={150} show={true} />);

      const badge = screen.getByTestId('xp-gained-badge');
      expect(badge).toHaveClass('absolute');
    });
  });

  // ==================== 8. EDGE CASES (2 bonus tests) ====================
  describe('Edge Cases', () => {
    it('should handle zero XP amount', () => {
      render(<XpGainedBadge xpAmount={0} show={true} />);

      const badge = screen.getByTestId('xp-gained-badge');
      expect(badge).toHaveTextContent('+0 XP');
    });

    it('should handle large XP amounts with formatting', () => {
      render(<XpGainedBadge xpAmount={1500} show={true} />);

      const badge = screen.getByTestId('xp-gained-badge');
      expect(badge).toHaveTextContent('+1,500 XP');
    });
  });
});
