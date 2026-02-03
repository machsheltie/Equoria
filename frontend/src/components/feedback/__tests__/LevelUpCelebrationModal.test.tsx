/**
 * LevelUpCelebrationModal Component Tests
 *
 * Comprehensive test suite for the level-up celebration modal component.
 * Tests cover:
 * - Component rendering states (open/closed)
 * - Level badge display (old vs new level)
 * - Stat changes table rendering
 * - Before/after stat comparison display
 * - Stat increase arrows and highlighting
 * - Total stat gain calculation
 * - Continue button functionality
 * - Escape key closing
 * - Backdrop click closing
 * - Focus management and trap
 * - Keyboard navigation (Tab through interactive elements)
 * - Accessibility compliance (ARIA roles, labels, announcements)
 * - Animation presence (confetti, scale, fade)
 * - Empty stat changes handling
 * - Large stat change datasets
 * - Responsive layout variants
 * - Portal rendering for proper stacking
 * - XP display
 * - Cleanup on unmount
 *
 * Target: 30+ tests following strict TDD red-green-refactor methodology
 * Story 5-4: Level-Up Celebration Modal - Task 2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LevelUpCelebrationModal, {
  type LevelUpCelebrationModalProps,
  type StatChange,
} from '../LevelUpCelebrationModal';

describe('LevelUpCelebrationModal', () => {
  const mockOnClose = vi.fn();

  /** Sample stat changes for testing */
  const sampleStatChanges: StatChange[] = [
    { statName: 'Speed', oldValue: 45, newValue: 52 },
    { statName: 'Stamina', oldValue: 38, newValue: 42 },
    { statName: 'Agility', oldValue: 60, newValue: 67 },
  ];

  const defaultProps: LevelUpCelebrationModalProps = {
    isOpen: true,
    onClose: mockOnClose,
    horseId: 101,
    horseName: 'Thunder Bolt',
    oldLevel: 4,
    newLevel: 5,
    statChanges: sampleStatChanges,
    totalXpGained: 250,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.overflow = '';
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  /** Helper to render the modal with overridable props */
  const renderModal = (props: Partial<LevelUpCelebrationModalProps> = {}) => {
    return render(<LevelUpCelebrationModal {...defaultProps} {...props} />);
  };

  // ==================== 1. RENDERING TESTS (5 tests) ====================
  describe('Rendering Tests', () => {
    it('should render null when isOpen is false', () => {
      renderModal({ isOpen: false });

      expect(screen.queryByTestId('levelup-celebration-modal')).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render modal when isOpen is true', () => {
      renderModal({ isOpen: true });

      expect(screen.getByTestId('levelup-celebration-modal')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should display the horse name', () => {
      renderModal();

      expect(screen.getByTestId('horse-name')).toHaveTextContent('Thunder Bolt');
    });

    it('should display a congratulations heading', () => {
      renderModal();

      const heading = screen.getByTestId('congratulations-heading');
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent(/level up/i);
    });

    it('should render via portal in document.body', () => {
      renderModal();

      // The modal should be rendered as a direct child of document.body
      const modal = screen.getByTestId('levelup-celebration-modal');
      expect(modal).toBeInTheDocument();
      expect(document.body.contains(modal)).toBe(true);
    });
  });

  // ==================== 2. LEVEL BADGE DISPLAY TESTS (4 tests) ====================
  describe('Level Badge Display Tests', () => {
    it('should display the new level in the level badge', () => {
      renderModal({ newLevel: 5 });

      const badge = screen.getByTestId('level-badge');
      expect(badge).toHaveTextContent('5');
    });

    it('should display old level to new level transition text', () => {
      renderModal({ oldLevel: 4, newLevel: 5 });

      const transitionText = screen.getByTestId('level-transition');
      expect(transitionText).toHaveTextContent('4');
      expect(transitionText).toHaveTextContent('5');
    });

    it('should display level badge with scale animation class', () => {
      renderModal();

      const badge = screen.getByTestId('level-badge');
      expect(badge.className).toMatch(/animate/i);
    });

    it('should handle multi-level jump (e.g., level 3 to level 7)', () => {
      renderModal({ oldLevel: 3, newLevel: 7 });

      const transitionText = screen.getByTestId('level-transition');
      expect(transitionText).toHaveTextContent('3');
      expect(transitionText).toHaveTextContent('7');

      const badge = screen.getByTestId('level-badge');
      expect(badge).toHaveTextContent('7');
    });
  });

  // ==================== 3. STAT CHANGES TABLE TESTS (6 tests) ====================
  describe('Stat Changes Table Tests', () => {
    it('should render a stat changes table', () => {
      renderModal();

      const table = screen.getByTestId('stat-changes-table');
      expect(table).toBeInTheDocument();
    });

    it('should display each stat change row with stat name', () => {
      renderModal();

      expect(screen.getByText('Speed')).toBeInTheDocument();
      expect(screen.getByText('Stamina')).toBeInTheDocument();
      expect(screen.getByText('Agility')).toBeInTheDocument();
    });

    it('should display before (old) values for each stat', () => {
      renderModal();

      // Speed old value = 45
      const speedRow = screen.getByTestId('stat-row-Speed');
      expect(within(speedRow).getByTestId('stat-old-value')).toHaveTextContent('45');
    });

    it('should display after (new) values for each stat', () => {
      renderModal();

      const speedRow = screen.getByTestId('stat-row-Speed');
      expect(within(speedRow).getByTestId('stat-new-value')).toHaveTextContent('52');
    });

    it('should display increase arrows for stats that improved', () => {
      renderModal();

      const speedRow = screen.getByTestId('stat-row-Speed');
      const arrow = within(speedRow).getByTestId('stat-increase-indicator');
      expect(arrow).toBeInTheDocument();
      // Should show increase amount (+7 for Speed: 52 - 45)
      expect(arrow).toHaveTextContent('+7');
    });

    it('should highlight changed stats with green styling', () => {
      renderModal();

      const speedRow = screen.getByTestId('stat-row-Speed');
      const newValue = within(speedRow).getByTestId('stat-new-value');
      // Should have green text coloring for increased stat
      expect(newValue.className).toMatch(/green/i);
    });
  });

  // ==================== 4. TOTAL STAT GAIN TESTS (3 tests) ====================
  describe('Total Stat Gain Tests', () => {
    it('should display total stat gain summary', () => {
      renderModal();

      const totalGain = screen.getByTestId('total-stat-gain');
      expect(totalGain).toBeInTheDocument();
      // Speed: +7, Stamina: +4, Agility: +7 = 18 total
      expect(totalGain).toHaveTextContent('18');
    });

    it('should calculate total correctly for single stat change', () => {
      renderModal({
        statChanges: [{ statName: 'Speed', oldValue: 10, newValue: 15 }],
      });

      const totalGain = screen.getByTestId('total-stat-gain');
      expect(totalGain).toHaveTextContent('5');
    });

    it('should display 0 total when stats did not change', () => {
      renderModal({
        statChanges: [{ statName: 'Speed', oldValue: 50, newValue: 50 }],
      });

      const totalGain = screen.getByTestId('total-stat-gain');
      expect(totalGain).toHaveTextContent('0');
    });
  });

  // ==================== 5. XP DISPLAY TESTS (2 tests) ====================
  describe('XP Display Tests', () => {
    it('should display total XP gained when provided', () => {
      renderModal({ totalXpGained: 250 });

      const xpDisplay = screen.getByTestId('xp-gained-display');
      expect(xpDisplay).toHaveTextContent('250');
    });

    it('should not display XP section when totalXpGained is not provided', () => {
      renderModal({ totalXpGained: undefined });

      expect(screen.queryByTestId('xp-gained-display')).not.toBeInTheDocument();
    });
  });

  // ==================== 6. CONTINUE BUTTON TESTS (2 tests) ====================
  describe('Continue Button Tests', () => {
    it('should render a Continue button', () => {
      renderModal();

      const continueButton = screen.getByTestId('continue-button');
      expect(continueButton).toBeInTheDocument();
      expect(continueButton).toHaveTextContent(/continue/i);
    });

    it('should call onClose when Continue button is clicked', async () => {
      const user = userEvent.setup();
      renderModal();

      const continueButton = screen.getByTestId('continue-button');
      await user.click(continueButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== 7. ESCAPE KEY TESTS (2 tests) ====================
  describe('Escape Key Tests', () => {
    it('should call onClose when Escape key is pressed', () => {
      renderModal();

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose on other key presses', () => {
      renderModal();

      fireEvent.keyDown(document, { key: 'Enter' });
      fireEvent.keyDown(document, { key: 'a' });

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  // ==================== 8. BACKDROP CLICK TESTS (2 tests) ====================
  describe('Backdrop Click Tests', () => {
    it('should call onClose when clicking the backdrop', async () => {
      const user = userEvent.setup();
      renderModal();

      const backdrop = screen.getByTestId('modal-backdrop');
      await user.click(backdrop);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when clicking inside modal content', async () => {
      const user = userEvent.setup();
      renderModal();

      const modalContent = screen.getByTestId('levelup-celebration-modal');
      await user.click(modalContent);

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  // ==================== 9. FOCUS MANAGEMENT TESTS (3 tests) ====================
  describe('Focus Management Tests', () => {
    it('should focus the modal when opened', () => {
      renderModal();

      const modal = screen.getByTestId('levelup-celebration-modal');
      expect(modal).toHaveFocus();
    });

    it('should trap focus within modal (Tab does not escape)', async () => {
      const user = userEvent.setup();
      renderModal();

      // Tab multiple times; focus should remain within the modal
      await user.tab();
      const modal = screen.getByTestId('levelup-celebration-modal');
      expect(modal.contains(document.activeElement)).toBe(true);

      await user.tab();
      expect(modal.contains(document.activeElement)).toBe(true);
    });

    it('should prevent body scroll when modal is open', () => {
      renderModal();

      expect(document.body.style.overflow).toBe('hidden');
    });
  });

  // ==================== 10. ACCESSIBILITY TESTS (4 tests) ====================
  describe('Accessibility Tests', () => {
    it('should have role="dialog" on the modal', () => {
      renderModal();

      const modal = screen.getByTestId('levelup-celebration-modal');
      expect(modal).toHaveAttribute('role', 'dialog');
    });

    it('should have aria-modal="true" attribute', () => {
      renderModal();

      const modal = screen.getByTestId('levelup-celebration-modal');
      expect(modal).toHaveAttribute('aria-modal', 'true');
    });

    it('should have aria-labelledby referencing the heading', () => {
      renderModal();

      const modal = screen.getByTestId('levelup-celebration-modal');
      expect(modal).toHaveAttribute('aria-labelledby', 'levelup-modal-title');

      const title = document.getElementById('levelup-modal-title');
      expect(title).toBeInTheDocument();
    });

    it('should have a screen reader announcement for level up', () => {
      renderModal({ oldLevel: 4, newLevel: 5, horseName: 'Thunder Bolt' });

      const announcement = screen.getByTestId('sr-announcement');
      expect(announcement).toHaveAttribute('aria-live', 'assertive');
      expect(announcement.textContent).toMatch(/thunder bolt/i);
      expect(announcement.textContent).toMatch(/level 5/i);
    });
  });

  // ==================== 11. ANIMATION TESTS (3 tests) ====================
  describe('Animation Tests', () => {
    it('should have fade-in animation class on the modal', () => {
      renderModal();

      const modal = screen.getByTestId('levelup-celebration-modal');
      expect(modal).toHaveClass('animate-fade-in');
    });

    it('should render confetti or celebration effect element', () => {
      renderModal();

      const confetti = screen.getByTestId('celebration-effect');
      expect(confetti).toBeInTheDocument();
    });

    it('should have scale animation on level badge', () => {
      renderModal();

      const badge = screen.getByTestId('level-badge');
      expect(badge.className).toMatch(/scale/i);
    });
  });

  // ==================== 12. EMPTY AND EDGE CASE TESTS (3 tests) ====================
  describe('Empty and Edge Case Tests', () => {
    it('should handle empty stat changes array gracefully', () => {
      renderModal({ statChanges: [] });

      // Modal should still render
      expect(screen.getByTestId('levelup-celebration-modal')).toBeInTheDocument();
      // Table should show empty state or no rows
      expect(screen.queryAllByTestId(/^stat-row-/)).toHaveLength(0);
    });

    it('should handle large stat change datasets (10+ stats)', () => {
      const largeStatChanges: StatChange[] = Array.from({ length: 10 }, (_, i) => ({
        statName: `Stat${i + 1}`,
        oldValue: 10 + i,
        newValue: 20 + i,
      }));

      renderModal({ statChanges: largeStatChanges });

      expect(rows).toHaveLength(10);
    });

    it('should handle stat with no change (oldValue equals newValue)', () => {
      renderModal({
        statChanges: [
          { statName: 'Speed', oldValue: 50, newValue: 50 },
          { statName: 'Stamina', oldValue: 30, newValue: 35 },
        ],
      });

      // Speed row should not show increase indicator
      const speedRow = screen.getByTestId('stat-row-Speed');
      expect(within(speedRow).queryByTestId('stat-increase-indicator')).not.toBeInTheDocument();

      // Stamina row should show increase indicator
      const staminaRow = screen.getByTestId('stat-row-Stamina');
      expect(within(staminaRow).getByTestId('stat-increase-indicator')).toBeInTheDocument();
    });
  });

  // ==================== 13. RESPONSIVE DESIGN TESTS (2 tests) ====================
  describe('Responsive Design Tests', () => {
    it('should have max-width constraint for desktop layout', () => {
      renderModal();

      const modal = screen.getByTestId('levelup-celebration-modal');
      expect(modal).toHaveClass('max-w-lg');
    });

    it('should have proper z-index for stacking context', () => {
      renderModal();

      const backdrop = screen.getByTestId('modal-backdrop');
      expect(backdrop).toHaveClass('z-50');
    });
  });

  // ==================== 14. CLEANUP TESTS (2 tests) ====================
  describe('Cleanup Tests', () => {
    it('should clean up keyboard event listener on unmount', () => {
      const { unmount } = renderModal();

      unmount();

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should restore body scroll on unmount', () => {
      const { unmount } = renderModal();

      expect(document.body.style.overflow).toBe('hidden');

      unmount();

      expect(document.body.style.overflow).toBe('');
    });
  });
});
