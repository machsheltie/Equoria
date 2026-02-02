/**
 * PrizeNotificationModal Component Tests
 *
 * Comprehensive test suite for the prize notification modal component.
 * Tests cover:
 * - Component rendering states (open/closed)
 * - Prize data display (money, XP, placement)
 * - Placement-based icons and styling (gold/silver/bronze)
 * - User interactions (close button, backdrop, escape key, auto-dismiss)
 * - Animation classes
 * - Accessibility compliance (ARIA, focus trap, keyboard nav)
 * - Edge cases and prop defaults
 *
 * Target: 25+ tests following strict TDD methodology
 * Story 5-3: Prize Notification System
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PrizeNotificationModal, {
  type PrizeNotificationModalProps,
  type PrizeData,
} from '../PrizeNotificationModal';

describe('PrizeNotificationModal', () => {
  const mockOnClose = vi.fn();

  // Sample prize data for testing
  const samplePrizeData: PrizeData = {
    horseName: 'Thunder Bolt',
    competitionName: 'Spring Grand Prix',
    discipline: 'Show Jumping',
    date: '2026-04-15',
    placement: 1,
    prizeMoney: 5000,
    xpGained: 150,
  };

  const defaultProps: PrizeNotificationModalProps = {
    isOpen: true,
    onClose: mockOnClose,
    prizeData: samplePrizeData,
    autoDismiss: false, // Disable auto-dismiss for most tests
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    document.body.style.overflow = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.style.overflow = '';
  });

  // Helper to render the modal
  const renderModal = (props: Partial<PrizeNotificationModalProps> = {}) => {
    return render(<PrizeNotificationModal {...defaultProps} {...props} />);
  };

  // ==================== 1. RENDERING TESTS (6 tests) ====================
  describe('Rendering Tests', () => {
    it('should render null when isOpen is false', () => {
      renderModal({ isOpen: false });

      expect(screen.queryByTestId('prize-notification-modal')).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render modal when isOpen is true', () => {
      renderModal({ isOpen: true });

      expect(screen.getByTestId('prize-notification-modal')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should display horse name correctly', () => {
      renderModal();

      expect(screen.getByTestId('horse-name')).toHaveTextContent('Thunder Bolt');
    });

    it('should display competition details (name, discipline, date)', () => {
      renderModal();

      expect(screen.getByTestId('competition-name')).toHaveTextContent('Spring Grand Prix');
      expect(screen.getByTestId('competition-discipline')).toHaveTextContent('Show Jumping');
      expect(screen.getByTestId('competition-date')).toBeInTheDocument();
    });

    it('should show prize money with currency formatting ($X,XXX.XX)', () => {
      renderModal();

      const prizeMoney = screen.getByTestId('prize-money');
      expect(prizeMoney).toHaveTextContent('$5,000');
    });

    it('should show XP gained with "+X XP" format', () => {
      renderModal();

      const xpBadge = screen.getByTestId('xp-gained');
      expect(xpBadge).toHaveTextContent('+150 XP');
    });
  });

  // ==================== 2. PLACEMENT DISPLAY TESTS (3 tests) ====================
  describe('Placement Display Tests', () => {
    it('should show gold trophy and "1st Place" for placement 1', () => {
      renderModal({
        prizeData: { ...samplePrizeData, placement: 1 },
      });

      const placementBadge = screen.getByTestId('placement-badge');
      expect(placementBadge).toHaveTextContent('1st Place');
      expect(placementBadge).toHaveClass('bg-yellow-400');

      // Check for trophy icons (header and badge)
      const trophyIcons = screen.getAllByTestId('trophy-icon');
      expect(trophyIcons.length).toBeGreaterThanOrEqual(1);
    });

    it('should show silver medal and "2nd Place" for placement 2', () => {
      renderModal({
        prizeData: { ...samplePrizeData, placement: 2, prizeMoney: 3000 },
      });

      const placementBadge = screen.getByTestId('placement-badge');
      expect(placementBadge).toHaveTextContent('2nd Place');
      expect(placementBadge).toHaveClass('bg-gray-300');

      // Check for medal icons (header and badge)
      const medalIcons = screen.getAllByTestId('medal-icon');
      expect(medalIcons.length).toBeGreaterThanOrEqual(1);
    });

    it('should show bronze medal and "3rd Place" for placement 3', () => {
      renderModal({
        prizeData: { ...samplePrizeData, placement: 3, prizeMoney: 2000 },
      });

      const placementBadge = screen.getByTestId('placement-badge');
      expect(placementBadge).toHaveTextContent('3rd Place');
      expect(placementBadge).toHaveClass('bg-orange-600');

      // Check for medal icons (header and badge)
      const medalIcons = screen.getAllByTestId('medal-icon');
      expect(medalIcons.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==================== 3. USER INTERACTION TESTS (5 tests) ====================
  describe('User Interaction Tests', () => {
    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderModal();

      const closeButton = screen.getByTestId('close-button');
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when Escape key is pressed', () => {
      renderModal();

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when clicking outside modal (backdrop click)', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderModal();

      const backdrop = screen.getByTestId('modal-backdrop');
      await user.click(backdrop);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose after auto-dismiss delay when autoDismiss is true', async () => {
      renderModal({ autoDismiss: true, autoDismissDelay: 5000 });

      expect(mockOnClose).not.toHaveBeenCalled();

      // Advance timer to just before dismiss
      act(() => {
        vi.advanceTimersByTime(4999);
      });
      expect(mockOnClose).not.toHaveBeenCalled();

      // Advance timer past dismiss point
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should allow manual close during auto-dismiss countdown', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderModal({ autoDismiss: true, autoDismissDelay: 5000 });

      // Advance timer partially
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Manually close
      const closeButton = screen.getByTestId('close-button');
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== 4. ANIMATION TESTS (3 tests) ====================
  describe('Animation Tests', () => {
    it('should have fade-in animation class when opening', () => {
      renderModal();

      const modal = screen.getByTestId('prize-notification-modal');
      expect(modal).toHaveClass('animate-fade-in');
    });

    it('should have scale-up animation class when opening', () => {
      renderModal();

      const modal = screen.getByTestId('prize-notification-modal');
      expect(modal).toHaveClass('animate-scale-up');
    });

    it('should have celebration gradient background', () => {
      renderModal();

      const headerSection = screen.getByTestId('celebration-header');
      expect(headerSection).toHaveClass('bg-gradient-to-r');
    });
  });

  // ==================== 5. ACCESSIBILITY TESTS (4 tests) ====================
  describe('Accessibility Tests', () => {
    it('should have role="dialog" attribute', () => {
      renderModal();

      const modal = screen.getByTestId('prize-notification-modal');
      expect(modal).toHaveAttribute('role', 'dialog');
    });

    it('should have aria-labelledby referencing heading', () => {
      renderModal();

      const modal = screen.getByTestId('prize-notification-modal');
      expect(modal).toHaveAttribute('aria-labelledby', 'prize-modal-title');

      const title = document.getElementById('prize-modal-title');
      expect(title).toBeInTheDocument();
    });

    it('should have aria-label="Close prize notification" on close button', () => {
      renderModal();

      const closeButton = screen.getByTestId('close-button');
      expect(closeButton).toHaveAttribute('aria-label', 'Close prize notification');
    });

    it('should trap focus within modal when open', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderModal();

      // Tab through the modal - focus should stay within
      await user.tab();
      expect(document.activeElement).not.toBe(document.body);

      const modal = screen.getByTestId('prize-notification-modal');
      expect(modal.contains(document.activeElement)).toBe(true);
    });
  });

  // ==================== 6. EDGE CASES TESTS (4 tests) ====================
  describe('Edge Cases Tests', () => {
    it('should handle missing autoDismiss prop (defaults to true)', async () => {
      render(
        <PrizeNotificationModal
          isOpen={true}
          onClose={mockOnClose}
          prizeData={samplePrizeData}
          // autoDismiss not provided - should default to true
        />
      );

      expect(mockOnClose).not.toHaveBeenCalled();

      // Should auto-dismiss with default delay (5000ms)
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should handle missing autoDismissDelay (defaults to 5000)', async () => {
      render(
        <PrizeNotificationModal
          isOpen={true}
          onClose={mockOnClose}
          prizeData={samplePrizeData}
          autoDismiss={true}
          // autoDismissDelay not provided - should default to 5000
        />
      );

      act(() => {
        vi.advanceTimersByTime(4999);
      });
      expect(mockOnClose).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should handle very large prize amounts with proper formatting', () => {
      renderModal({
        prizeData: { ...samplePrizeData, prizeMoney: 1234567.89 },
      });

      const prizeMoney = screen.getByTestId('prize-money');
      expect(prizeMoney).toHaveTextContent('$1,234,568'); // Rounded
    });

    it('should handle zero XP gain correctly', () => {
      renderModal({
        prizeData: { ...samplePrizeData, xpGained: 0 },
      });

      const xpBadge = screen.getByTestId('xp-gained');
      expect(xpBadge).toHaveTextContent('+0 XP');
    });
  });

  // ==================== 7. ADDITIONAL INTERACTION TESTS (3 tests) ====================
  describe('Additional Interaction Tests', () => {
    it('should not close when clicking inside modal content', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderModal();

      const modalContent = screen.getByTestId('modal-content');
      await user.click(modalContent);

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should prevent body scroll when modal is open', () => {
      renderModal();

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should restore body scroll when modal closes', () => {
      const { rerender } = renderModal();
      expect(document.body.style.overflow).toBe('hidden');

      rerender(
        <PrizeNotificationModal
          {...defaultProps}
          isOpen={false}
        />
      );

      expect(document.body.style.overflow).toBe('');
    });
  });

  // ==================== 8. CONGRATULATIONS MESSAGE TESTS (2 tests) ====================
  describe('Congratulations Message Tests', () => {
    it('should display congratulations heading', () => {
      renderModal();

      const heading = screen.getByTestId('congratulations-heading');
      expect(heading).toHaveTextContent(/congratulations/i);
    });

    it('should display placement text in congratulations', () => {
      renderModal({
        prizeData: { ...samplePrizeData, placement: 2 },
      });

      const heading = screen.getByTestId('congratulations-heading');
      expect(heading).toHaveTextContent(/2nd/i);
    });
  });

  // ==================== 9. CLEANUP TESTS (2 tests) ====================
  describe('Cleanup Tests', () => {
    it('should clean up auto-dismiss timer on unmount', () => {
      const { unmount } = renderModal({ autoDismiss: true, autoDismissDelay: 5000 });

      // Advance timer partially
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Unmount before timer completes
      unmount();

      // Continue timer - should not call onClose
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should clean up keyboard event listener on unmount', () => {
      const { unmount } = renderModal();

      unmount();

      // Escape key should not trigger onClose after unmount
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  // ==================== 10. RESPONSIVE DESIGN TESTS (2 tests) ====================
  describe('Responsive Design Tests', () => {
    it('should have max-width constraint on desktop', () => {
      renderModal();

      const modal = screen.getByTestId('prize-notification-modal');
      expect(modal).toHaveClass('max-w-md');
    });

    it('should have proper z-index to overlay other modals', () => {
      renderModal();

      const backdrop = screen.getByTestId('modal-backdrop');
      expect(backdrop).toHaveClass('z-50');
    });
  });
});
