/**
 * Tests for TrainingConfirmModal Component
 *
 * Tests cover:
 * - Rendering when open/closed
 * - Display of horse name, discipline, and scores
 * - Score calculation and progression display
 * - Trait modifiers with color coding (positive/negative)
 * - Next training availability date
 * - Button interactions (Confirm, Cancel, X button)
 * - Keyboard interaction (Escape key)
 * - Backdrop click to close
 * - Loading state behavior
 * - Accessibility (ARIA attributes, focus management)
 * - Edge cases (zero gain, large values, empty modifiers)
 *
 * Story 4-1: Training Session Interface - Task 4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
    traitModifiers: [
      { name: 'Quick Learner', modifier: 2 },
      { name: 'Nervous', modifier: -1 },
    ],
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

    it('should call onClose when Escape key is pressed', () => {
      render(<TrainingConfirmModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', async () => {
      const user = userEvent.setup();
      render(<TrainingConfirmModal {...defaultProps} />);

      const backdrop = screen.getByTestId('training-confirm-modal-backdrop');
      await user.click(backdrop);

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
      expect(scoreProgression).toHaveTextContent('31'); // 25 + 5 + (2 - 1) = 31
    });

    it('should calculate new score correctly including modifiers', () => {
      // Base: 5, Quick Learner: +2, Nervous: -1 = Total gain: 6
      // Current: 25, New: 31
      render(<TrainingConfirmModal {...defaultProps} />);

      expect(screen.getByTestId('new-score')).toHaveTextContent('31');
    });

    it('should format score display properly with arrow', () => {
      render(<TrainingConfirmModal {...defaultProps} />);

      const scoreProgression = screen.getByTestId('score-progression');
      // Check that there's a visual separator (arrow symbol rendered in text)
      expect(scoreProgression.textContent).toContain('→');
    });
  });

  // ==================== TRAIT MODIFIERS DISPLAY ====================
  describe('Trait Modifiers Display', () => {
    it('should display positive modifiers in green with + symbol', () => {
      render(<TrainingConfirmModal {...defaultProps} />);

      const quickLearnerValue = screen.getByTestId('trait-modifier-value-0');
      expect(quickLearnerValue).toHaveTextContent('+2');
      expect(quickLearnerValue).toHaveClass('text-green-600');
    });

    it('should display negative modifiers in red with - symbol', () => {
      render(<TrainingConfirmModal {...defaultProps} />);

      const nervousValue = screen.getByTestId('trait-modifier-value-1');
      expect(nervousValue).toHaveTextContent('-1');
      expect(nervousValue).toHaveClass('text-red-600');
    });

    it('should handle empty trait modifiers array', () => {
      render(<TrainingConfirmModal {...defaultProps} traitModifiers={[]} />);

      // Should not render trait modifiers section
      expect(screen.queryByTestId('trait-modifiers-list')).not.toBeInTheDocument();
    });

    it('should display multiple trait modifiers correctly', () => {
      const manyModifiers = [
        { name: 'Quick Learner', modifier: 2 },
        { name: 'Nervous', modifier: -1 },
        { name: 'Athletic', modifier: 1 },
        { name: 'Stubborn', modifier: -2 },
      ];

      render(<TrainingConfirmModal {...defaultProps} traitModifiers={manyModifiers} />);

      const modifiersList = screen.getByTestId('trait-modifiers-list');
      const modifierItems = within(modifiersList).getAllByRole('listitem');
      expect(modifierItems).toHaveLength(4);

      expect(screen.getByTestId('trait-modifier-0')).toHaveTextContent('Quick Learner');
      expect(screen.getByTestId('trait-modifier-1')).toHaveTextContent('Nervous');
      expect(screen.getByTestId('trait-modifier-2')).toHaveTextContent('Athletic');
      expect(screen.getByTestId('trait-modifier-3')).toHaveTextContent('Stubborn');
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

    it('should focus modal when opened', async () => {
      render(<TrainingConfirmModal {...defaultProps} />);

      await waitFor(() => {
        const modal = screen.getByTestId('training-confirm-modal');
        expect(modal).toHaveFocus();
      });
    });
  });

  // ==================== EDGE CASES ====================
  describe('Edge Cases', () => {
    it('should handle zero base score gain', () => {
      render(<TrainingConfirmModal {...defaultProps} baseScoreGain={0} traitModifiers={[]} />);

      expect(screen.getByTestId('base-score-gain')).toHaveTextContent('+0');
      expect(screen.getByTestId('new-score')).toHaveTextContent('25'); // Current score remains
    });

    it('should handle very large score values', () => {
      render(<TrainingConfirmModal {...defaultProps} currentScore={999999} baseScoreGain={1000} />);

      expect(screen.getByTestId('current-score')).toHaveTextContent('999999');
      // 999999 + 1000 + (2 - 1) = 1001000
      expect(screen.getByTestId('new-score')).toHaveTextContent('1001000');
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

    it('should NOT close on Escape when loading', () => {
      render(<TrainingConfirmModal {...defaultProps} isLoading={true} />);

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('should NOT close on backdrop click when loading', async () => {
      const user = userEvent.setup();
      render(<TrainingConfirmModal {...defaultProps} isLoading={true} />);

      const backdrop = screen.getByTestId('training-confirm-modal-backdrop');
      await user.click(backdrop);

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('should have aria-busy on confirm button when loading', () => {
      render(<TrainingConfirmModal {...defaultProps} isLoading={true} />);

      const confirmButton = screen.getByTestId('confirm-button');
      expect(confirmButton).toHaveAttribute('aria-busy', 'true');
    });
  });

  // ==================== TOTAL MODIFIER DISPLAY ====================
  describe('Total Modifier Display', () => {
    it('should show total modifier when traits exist', () => {
      render(<TrainingConfirmModal {...defaultProps} />);

      const totalModifier = screen.getByTestId('total-modifier');
      // Quick Learner: +2, Nervous: -1 = +1
      expect(totalModifier).toHaveTextContent('+1');
    });

    it('should show positive total modifier in green', () => {
      render(<TrainingConfirmModal {...defaultProps} />);

      const totalModifier = screen.getByTestId('total-modifier');
      expect(totalModifier).toHaveClass('text-green-600');
    });

    it('should show negative total modifier in red', () => {
      render(
        <TrainingConfirmModal
          {...defaultProps}
          traitModifiers={[
            { name: 'Nervous', modifier: -1 },
            { name: 'Stubborn', modifier: -2 },
          ]}
        />
      );

      const totalModifier = screen.getByTestId('total-modifier');
      expect(totalModifier).toHaveTextContent('-3');
      expect(totalModifier).toHaveClass('text-red-600');
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
