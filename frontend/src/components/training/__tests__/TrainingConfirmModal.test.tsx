/**
 * Tests for TrainingConfirmModal Component
 *
 * Tests cover:
 * - Rendering when open/closed
 * - Display of horse name, discipline, and scores
 * - Score calculation and progression display
 * - No trait or trainer modifier display (flat +5, owner ruling 2026-10-23)
 * - Next training availability date
 * - Button interactions (Confirm, Cancel, X button)
 * - Keyboard interaction (Escape key)
 * - Outside-interaction dismissal (GameDialog-owned)
 * - Loading state behavior
 * - Accessibility (ARIA attributes, focus management)
 * - Edge cases (zero gain, large values)
 *
 * Story 4-1: Training Session Interface - Task 4
 * Migrated from hand-rolled `fixed inset-0` portal overlay → GameDialog
 * (Equoria-8l8zc, DECISIONS.md §8). The custom `*-backdrop` testid and the
 * manual focus/scroll-lock/Escape/backdrop-click logic are gone — the native
 * Dialog primitive owns them now. Backdrop-click-to-close intent is re-expressed
 * as GameDialog dismissal (Escape / outside-interaction), and the loading guards
 * are asserted through that same dismissal path (onEscapeKeyDown/onInteractOutside
 * preventDefault while `isLoading`).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrainingConfirmModal from '../TrainingConfirmModal';

describe('TrainingConfirmModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    horseName: 'Thunder',
    disciplineName: 'Dressage',
    baseScoreGain: 5,
    currentScore: 25,
    cooldownDays: 7,
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset body overflow
    document.body.style.overflow = '';
  });

  afterEach(() => {
    // Clean up body overflow after tests
    document.body.style.overflow = '';
  });

  // ==================== RENDERING TESTS ====================
  describe('Rendering', () => {
    it('should render nothing when isOpen is false', () => {
      render(<TrainingConfirmModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByTestId('training-confirm-modal')).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render modal when isOpen is true', () => {
      render(<TrainingConfirmModal {...defaultProps} />);

      expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should display horse name and discipline name correctly', () => {
      render(<TrainingConfirmModal {...defaultProps} />);

      expect(screen.getByTestId('horse-name')).toHaveTextContent('Thunder');
      expect(screen.getByTestId('discipline-name')).toHaveTextContent('Dressage');
    });

    it('should show base score gain', () => {
      render(<TrainingConfirmModal {...defaultProps} />);

      const baseScoreGain = screen.getByTestId('base-score-gain');
      expect(baseScoreGain).toHaveTextContent('+5');
    });

    it('should display current score', () => {
      render(<TrainingConfirmModal {...defaultProps} />);

      expect(screen.getByTestId('current-score')).toHaveTextContent('25');
    });

    it('should show next training date/cooldown info', () => {
      render(<TrainingConfirmModal {...defaultProps} />);

      const nextDate = screen.getByTestId('next-training-date');
      expect(nextDate).toBeInTheDocument();
      // Should contain a date format (e.g., "Monday, February 6, 2026")
      expect(nextDate.textContent).toMatch(/\w+, \w+ \d+, \d{4}/);
    });
  });

  // ==================== INTERACTION TESTS ====================
  describe('Interactions', () => {
    it('should call onConfirm when Confirm button is clicked', async () => {
      const user = userEvent.setup();
      render(<TrainingConfirmModal {...defaultProps} />);

      const confirmButton = screen.getByTestId('confirm-button');
      await user.click(confirmButton);

      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<TrainingConfirmModal {...defaultProps} />);

      const cancelButton = screen.getByTestId('cancel-button');
      await user.click(cancelButton);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when X button is clicked', async () => {
      const user = userEvent.setup();
      render(<TrainingConfirmModal {...defaultProps} />);

      const closeButton = screen.getByTestId('close-button');
      await user.click(closeButton);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when Escape key is pressed', async () => {
      const user = userEvent.setup();
      render(<TrainingConfirmModal {...defaultProps} />);

      await user.keyboard('{Escape}');

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    // Backdrop-click-to-close intent: GameDialog dismisses on an outside
    // pointer interaction, routing through onOpenChange → onClose (the old
    // hand-rolled `*-backdrop` div is gone). A pointerdown on the body
    // (outside the dialog content) is the outside-interaction.
    it('should call onClose on outside interaction (GameDialog dismissal)', async () => {
      const user = userEvent.setup();
      render(<TrainingConfirmModal {...defaultProps} />);

      await user.click(document.body);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should NOT close when modal content is clicked', async () => {
      const user = userEvent.setup();
      render(<TrainingConfirmModal {...defaultProps} />);

      const modalContent = screen.getByTestId('training-confirm-modal');
      await user.click(modalContent);

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('should disable Confirm button when isLoading is true', () => {
      render(<TrainingConfirmModal {...defaultProps} isLoading={true} />);

      const confirmButton = screen.getByTestId('confirm-button');
      expect(confirmButton).toBeDisabled();
    });
  });

  // ==================== SCORE CALCULATION DISPLAY ====================
  describe('Score Calculation Display', () => {
    it('should show correct score progression (current to new)', () => {
      render(<TrainingConfirmModal {...defaultProps} />);

      const scoreProgression = screen.getByTestId('score-progression');
      expect(scoreProgression).toHaveTextContent('25');
      expect(scoreProgression).toHaveTextContent('30'); // 25 + the flat 5
    });

    // Owner ruling 2026-10-23: weekly training adds a flat +5 with no trait or trainer
    // scaling. Old contract: new score = current + base + the sum of trait modifiers (31).
    it('should calculate new score as current plus the flat gain', () => {
      render(<TrainingConfirmModal {...defaultProps} />);

      expect(screen.getByTestId('new-score')).toHaveTextContent('30');
    });

    it('should format score display properly with arrow', () => {
      render(<TrainingConfirmModal {...defaultProps} />);

      const scoreProgression = screen.getByTestId('score-progression');
      // Check that there's a visual separator (arrow symbol rendered in text)
      expect(scoreProgression.textContent).toContain('→');
    });
  });

  // ==================== NO TRAIT MODIFIERS ====================
  // Owner ruling 2026-10-23 (Equoria-576c0.1): training adds a flat +5; the confirm
  // dialog shows no trait modifier list and no modifier total. Old contract: it listed
  // each trait modifier with a colour-coded value and a total.
  describe('No trait modifiers', () => {
    it('shows no trait modifier list and no modifier total', () => {
      render(<TrainingConfirmModal {...defaultProps} />);

      expect(screen.queryByTestId('trait-modifiers-list')).not.toBeInTheDocument();
      expect(screen.queryByTestId('total-modifier')).not.toBeInTheDocument();
      expect(screen.queryByText(/trait modifiers/i)).not.toBeInTheDocument();
    });
  });

  // ==================== ACCESSIBILITY TESTS ====================
  describe('Accessibility', () => {
    it('should have role="dialog" attribute', () => {
      render(<TrainingConfirmModal {...defaultProps} />);

      const modal = screen.getByTestId('training-confirm-modal');
      expect(modal).toHaveAttribute('role', 'dialog');
    });

    it('should have aria-modal="true" attribute', () => {
      render(<TrainingConfirmModal {...defaultProps} />);

      const modal = screen.getByTestId('training-confirm-modal');
      expect(modal).toHaveAttribute('aria-modal', 'true');
    });

    it('should have proper aria-labelledby connection to title', () => {
      render(<TrainingConfirmModal {...defaultProps} />);

      const modal = screen.getByTestId('training-confirm-modal');
      expect(modal).toHaveAttribute('aria-labelledby', 'training-confirm-title');

      const title = document.getElementById('training-confirm-title');
      expect(title).toBeInTheDocument();
      expect(title).toHaveTextContent('Confirm Training');
    });

    it('should move focus into the dialog when opened (GameDialog focus trap)', async () => {
      render(<TrainingConfirmModal {...defaultProps} />);

      await waitFor(() => {
        const modal = screen.getByTestId('training-confirm-modal');
        // Native Dialog focuses the first focusable element inside the panel
        // (the close button), so focus lands within the dialog rather than on
        // the container itself.
        expect(modal.contains(document.activeElement)).toBe(true);
        expect(document.activeElement).not.toBe(document.body);
      });
    });
  });

  // ==================== EDGE CASES ====================
  describe('Edge Cases', () => {
    it('should handle zero base score gain', () => {
      render(<TrainingConfirmModal {...defaultProps} baseScoreGain={0} />);

      expect(screen.getByTestId('base-score-gain')).toHaveTextContent('+0');
      expect(screen.getByTestId('new-score')).toHaveTextContent('25'); // Current score remains
    });

    it('should handle very large score values', () => {
      render(<TrainingConfirmModal {...defaultProps} currentScore={999999} baseScoreGain={1000} />);

      expect(screen.getByTestId('current-score')).toHaveTextContent('999999');
      // 999999 + 1000 = 1000999
      expect(screen.getByTestId('new-score')).toHaveTextContent('1000999');
    });

    it('should handle multiple rapid open/close cycles', async () => {
      const { rerender } = render(<TrainingConfirmModal {...defaultProps} />);

      // Close
      rerender(<TrainingConfirmModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByTestId('training-confirm-modal')).not.toBeInTheDocument();

      // Open
      rerender(<TrainingConfirmModal {...defaultProps} isOpen={true} />);
      expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();

      // Close
      rerender(<TrainingConfirmModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByTestId('training-confirm-modal')).not.toBeInTheDocument();

      // Open again
      rerender(<TrainingConfirmModal {...defaultProps} isOpen={true} />);
      expect(screen.getByTestId('training-confirm-modal')).toBeInTheDocument();
    });
  });

  // ==================== LOADING STATE TESTS ====================
  describe('Loading State', () => {
    it('should show loading spinner when isLoading is true', () => {
      render(<TrainingConfirmModal {...defaultProps} isLoading={true} />);

      const spinner = screen.getByRole('status', { name: /loading/i });
      expect(spinner).toBeInTheDocument();
    });

    it('should show "Training..." text when loading', () => {
      render(<TrainingConfirmModal {...defaultProps} isLoading={true} />);

      expect(screen.getByText('Training...')).toBeInTheDocument();
    });

    it('should disable Cancel button when loading', () => {
      render(<TrainingConfirmModal {...defaultProps} isLoading={true} />);

      const cancelButton = screen.getByTestId('cancel-button');
      expect(cancelButton).toBeDisabled();
    });

    it('should disable X button when loading', () => {
      render(<TrainingConfirmModal {...defaultProps} isLoading={true} />);

      const closeButton = screen.getByTestId('close-button');
      expect(closeButton).toBeDisabled();
    });

    it('should NOT close on Escape when loading', async () => {
      const user = userEvent.setup();
      render(<TrainingConfirmModal {...defaultProps} isLoading={true} />);

      await user.keyboard('{Escape}');

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('should NOT close on outside interaction when loading', async () => {
      const user = userEvent.setup();
      render(<TrainingConfirmModal {...defaultProps} isLoading={true} />);

      await user.click(document.body);

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('should have aria-busy on confirm button when loading', () => {
      render(<TrainingConfirmModal {...defaultProps} isLoading={true} />);

      const confirmButton = screen.getByTestId('confirm-button');
      expect(confirmButton).toHaveAttribute('aria-busy', 'true');
    });
  });

  // ==================== COOLDOWN DISPLAY ====================
  describe('Cooldown Display', () => {
    it('should show cooldown days text when cooldown is positive', () => {
      render(<TrainingConfirmModal {...defaultProps} cooldownDays={7} />);

      expect(screen.getByText(/7 days cooldown/i)).toBeInTheDocument();
    });

    it('should use singular "day" for 1 day cooldown', () => {
      render(<TrainingConfirmModal {...defaultProps} cooldownDays={1} />);

      expect(screen.getByText(/1 day cooldown/i)).toBeInTheDocument();
    });

    it('should show immediate availability for zero cooldown', () => {
      render(<TrainingConfirmModal {...defaultProps} cooldownDays={0} />);

      expect(screen.getByTestId('next-training-date')).toHaveTextContent(
        'Immediately after this session'
      );
    });
  });

  // ==================== BODY SCROLL LOCK ====================
  describe('Body Scroll Lock', () => {
    it('should prevent body scroll when modal is open', () => {
      render(<TrainingConfirmModal {...defaultProps} />);

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should restore body scroll when modal closes', () => {
      const { rerender } = render(<TrainingConfirmModal {...defaultProps} />);

      expect(document.body.style.overflow).toBe('hidden');

      rerender(<TrainingConfirmModal {...defaultProps} isOpen={false} />);

      expect(document.body.style.overflow).toBe('');
    });
  });

  // ==================== MODAL TITLE ====================
  describe('Modal Title', () => {
    it('should display "Confirm Training" title', () => {
      render(<TrainingConfirmModal {...defaultProps} />);

      const title = screen.getByRole('heading', { name: /confirm training/i });
      expect(title).toBeInTheDocument();
      expect(title).toHaveClass('text-2xl', 'font-bold');
    });
  });

  // ==================== CLICK PROPAGATION ====================
  describe('Click Propagation', () => {
    it('should stop click propagation on modal content', async () => {
      const user = userEvent.setup();
      render(<TrainingConfirmModal {...defaultProps} />);

      // Click on inner content like the horse name
      const horseName = screen.getByTestId('horse-name');
      await user.click(horseName);

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('should stop click propagation on buttons within modal', async () => {
      const user = userEvent.setup();
      render(<TrainingConfirmModal {...defaultProps} />);

      // Clicking confirm should trigger onConfirm but not onClose
      await user.click(screen.getByTestId('confirm-button'));

      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
      // onClose should NOT be called from backdrop click
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });
});
