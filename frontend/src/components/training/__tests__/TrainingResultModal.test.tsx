/**
 * Tests for TrainingResultModal Component
 *
 * Tests cover:
 * - Rendering when open/closed
 * - Display of success message with celebration emoji
 * - Discipline name display
 * - Score gain display with breakdown
 * - New score display
 * - Additional gains (stat gains and XP)
 * - Next training date formatting
 * - Close button interaction
 * - Keyboard interaction (Escape key)
 * - Outside-interaction dismissal (GameDialog-owned)
 * - Click propagation handling
 * - Focus management
 * - Accessibility (ARIA attributes)
 * - Edge cases (large values, many stats, rapid cycles)
 *
 * Story 4-1: Training Session Interface - Task 5
 * Migrated from hand-rolled `fixed inset-0` portal overlay → GameDialog
 * (Equoria-8l8zc, DECISIONS.md §8). The custom `*-backdrop` testid and the
 * manual focus/scroll-lock/Escape/backdrop-click logic are gone — the native
 * Dialog primitive owns them. Backdrop-click-to-close intent is re-expressed as
 * GameDialog dismissal (Escape / outside-interaction), and the "dim backdrop"
 * visual test now asserts GameDialog's shared overlay (bg-black/60 +
 * backdrop-blur-sm, DECISIONS §4) instead of the old page-local bg-black/70 div.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrainingResultModal from '../TrainingResultModal';

describe('TrainingResultModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    disciplineName: 'Dressage',
    scoreGain: 6,
    baseScoreGain: 5,
    traitBonus: 1,
    newScore: 51,
    nextTrainingDate: new Date('2026-02-07'),
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
      render(<TrainingResultModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByTestId('training-result-modal')).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render modal when isOpen is true', () => {
      render(<TrainingResultModal {...defaultProps} />);

      expect(screen.getByTestId('training-result-modal')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should display success title with celebration emoji', () => {
      render(<TrainingResultModal {...defaultProps} />);

      const title = screen.getByRole('heading', { name: /training complete/i });
      expect(title).toBeInTheDocument();
      expect(title).toHaveClass('text-[var(--role-success-text)]');

      // Check for celebration emoji
      const celebrationEmoji = screen.getByRole('img', { name: /celebration/i });
      expect(celebrationEmoji).toBeInTheDocument();
    });

    it('should show discipline name correctly', () => {
      render(<TrainingResultModal {...defaultProps} />);

      expect(screen.getByTestId('discipline-name')).toHaveTextContent('Dressage');
    });

    it('should display total score gain prominently', () => {
      render(<TrainingResultModal {...defaultProps} />);

      const scoreGain = screen.getByTestId('score-gain');
      expect(scoreGain).toHaveTextContent('+6');
      expect(scoreGain).toHaveClass('text-4xl', 'font-bold', 'text-[var(--role-success-text)]');
    });

    it('should show new score value', () => {
      render(<TrainingResultModal {...defaultProps} />);

      const newScore = screen.getByTestId('new-score');
      expect(newScore).toHaveTextContent('New Score:');
      expect(newScore).toHaveTextContent('51');
    });
  });

  // ==================== SCORE DISPLAY TESTS ====================
  describe('Score Display', () => {
    it('should show correct score gain breakdown (base + trait bonus)', () => {
      render(<TrainingResultModal {...defaultProps} />);

      const breakdown = screen.getByTestId('score-breakdown');
      expect(breakdown).toHaveTextContent('+5 base');
      expect(breakdown).toHaveTextContent('+1 trait bonus');
    });

    it('should format score gain with + symbol', () => {
      render(<TrainingResultModal {...defaultProps} scoreGain={10} />);

      const scoreGain = screen.getByTestId('score-gain');
      expect(scoreGain).toHaveTextContent('+10');
    });

    it('should display breakdown text correctly for positive trait bonus', () => {
      render(<TrainingResultModal {...defaultProps} baseScoreGain={5} traitBonus={2} />);

      const breakdown = screen.getByTestId('score-breakdown');
      expect(breakdown).toHaveTextContent('(+5 base, +2 trait bonus)');
    });

    it('should handle zero trait bonus (only shows base)', () => {
      render(<TrainingResultModal {...defaultProps} traitBonus={0} scoreGain={5} />);

      const breakdown = screen.getByTestId('score-breakdown');
      expect(breakdown).toHaveTextContent('(+5 base)');
      expect(breakdown).not.toHaveTextContent('trait bonus');
    });

    it('should handle negative trait modifiers correctly', () => {
      render(<TrainingResultModal {...defaultProps} traitBonus={-2} scoreGain={3} />);

      const breakdown = screen.getByTestId('score-breakdown');
      expect(breakdown).toHaveTextContent('(+5 base, -2 trait bonus)');
    });
  });

  // ==================== ADDITIONAL GAINS DISPLAY ====================
  describe('Additional Gains Display', () => {
    // Old contract: the modal listed training stat gains. New contract (owner
    // rulings 2026-10-19, 2026-10-21): training never raises a stat; XP is the
    // only additional gain.
    it('should show XP gain when provided', () => {
      render(<TrainingResultModal {...defaultProps} xpGain={25} />);

      const xpGain = screen.getByTestId('xp-gain');
      expect(xpGain).toHaveTextContent('XP: +25');
      expect(xpGain).toHaveClass('text-[var(--role-warning-text)]', 'font-semibold');
    });

    it('should show no additional gains section without XP', () => {
      render(<TrainingResultModal {...defaultProps} xpGain={undefined} />);

      expect(screen.queryByTestId('additional-gains-section')).not.toBeInTheDocument();
    });
  });

  // ==================== DATE DISPLAY TESTS ====================
  describe('Date Display', () => {
    it('should format next training date correctly', () => {
      // Use explicit time to avoid timezone issues
      const testDate = new Date(2026, 1, 7, 12, 0, 0); // Feb 7, 2026 at noon local time
      render(<TrainingResultModal {...defaultProps} nextTrainingDate={testDate} />);

      const dateText = screen.getByTestId('next-training-date');
      // Should show the formatted date - just check it contains the key parts
      expect(dateText.textContent).toMatch(/February 7, 2026/);
    });

    it('should handle string date input', () => {
      // Use ISO format with explicit time to avoid timezone shifts
      render(<TrainingResultModal {...defaultProps} nextTrainingDate="2026-03-15T12:00:00" />);

      const dateText = screen.getByTestId('next-training-date');
      expect(dateText.textContent).toMatch(/March 15, 2026/);
    });

    it('should handle Date object input', () => {
      // Create date with local time to avoid UTC conversion issues
      const dateObj = new Date(2026, 3, 20, 12, 0, 0); // April 20, 2026 at noon local time
      render(<TrainingResultModal {...defaultProps} nextTrainingDate={dateObj} />);

      const dateText = screen.getByTestId('next-training-date');
      expect(dateText.textContent).toMatch(/April 20, 2026/);
    });
  });

  // ==================== INTERACTION TESTS ====================
  describe('Interactions', () => {
    it('should call onClose when Close button is clicked', async () => {
      const user = userEvent.setup();
      render(<TrainingResultModal {...defaultProps} />);

      const closeButton = screen.getByTestId('close-button');
      await user.click(closeButton);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when Escape key is pressed', async () => {
      const user = userEvent.setup();
      render(<TrainingResultModal {...defaultProps} />);

      await user.keyboard('{Escape}');

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    // Backdrop-click-to-close intent: GameDialog dismisses on an outside
    // pointer interaction (the old hand-rolled `*-backdrop` div is gone),
    // routing through onOpenChange → onClose.
    it('should call onClose on outside interaction (GameDialog dismissal)', async () => {
      const user = userEvent.setup();
      render(<TrainingResultModal {...defaultProps} />);

      await user.click(document.body);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should NOT close when modal content is clicked', async () => {
      const user = userEvent.setup();
      render(<TrainingResultModal {...defaultProps} />);

      const modalContent = screen.getByTestId('training-result-modal');
      await user.click(modalContent);

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('should focus Close button when modal opens', async () => {
      render(<TrainingResultModal {...defaultProps} />);

      await waitFor(() => {
        const closeButton = screen.getByTestId('close-button');
        expect(closeButton).toHaveFocus();
      });
    });
  });

  // ==================== ACCESSIBILITY TESTS ====================
  describe('Accessibility', () => {
    it('should have role="dialog" attribute', () => {
      render(<TrainingResultModal {...defaultProps} />);

      const modal = screen.getByTestId('training-result-modal');
      expect(modal).toHaveAttribute('role', 'dialog');
    });

    it('should have aria-modal="true" attribute', () => {
      render(<TrainingResultModal {...defaultProps} />);

      const modal = screen.getByTestId('training-result-modal');
      expect(modal).toHaveAttribute('aria-modal', 'true');
    });

    it('should have proper aria-labelledby connection to title', () => {
      render(<TrainingResultModal {...defaultProps} />);

      const modal = screen.getByTestId('training-result-modal');
      expect(modal).toHaveAttribute('aria-labelledby', 'training-result-title');

      const title = document.getElementById('training-result-title');
      expect(title).toBeInTheDocument();
      expect(title).toHaveTextContent('Training Complete!');
    });

    it('should have Close button that is keyboard accessible', async () => {
      const user = userEvent.setup();
      render(<TrainingResultModal {...defaultProps} />);

      const closeButton = screen.getByTestId('close-button');
      closeButton.focus();

      await user.keyboard('{Enter}');
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== EDGE CASES ====================
  describe('Edge Cases', () => {
    it('should handle very large score values', () => {
      render(
        <TrainingResultModal
          {...defaultProps}
          scoreGain={9999}
          baseScoreGain={9000}
          traitBonus={999}
          newScore={99999}
        />
      );

      expect(screen.getByTestId('score-gain')).toHaveTextContent('+9999');
      expect(screen.getByTestId('new-score')).toHaveTextContent('99999');
    });

    it('should handle multiple rapid open/close cycles', async () => {
      const { rerender } = render(<TrainingResultModal {...defaultProps} />);

      // Close
      rerender(<TrainingResultModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByTestId('training-result-modal')).not.toBeInTheDocument();

      // Open
      rerender(<TrainingResultModal {...defaultProps} isOpen={true} />);
      expect(screen.getByTestId('training-result-modal')).toBeInTheDocument();

      // Close
      rerender(<TrainingResultModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByTestId('training-result-modal')).not.toBeInTheDocument();

      // Open again
      rerender(<TrainingResultModal {...defaultProps} isOpen={true} />);
      expect(screen.getByTestId('training-result-modal')).toBeInTheDocument();
    });
  });

  // ==================== BODY SCROLL LOCK ====================
  describe('Body Scroll Lock', () => {
    it('should prevent body scroll when modal is open', () => {
      render(<TrainingResultModal {...defaultProps} />);

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should restore body scroll when modal closes', () => {
      const { rerender } = render(<TrainingResultModal {...defaultProps} />);

      expect(document.body.style.overflow).toBe('hidden');

      rerender(<TrainingResultModal {...defaultProps} isOpen={false} />);

      expect(document.body.style.overflow).toBe('');
    });
  });

  // ==================== CLICK PROPAGATION ====================
  describe('Click Propagation', () => {
    it('should stop click propagation on modal content', async () => {
      const user = userEvent.setup();
      render(<TrainingResultModal {...defaultProps} />);

      // Click on inner content like the discipline name
      const disciplineName = screen.getByTestId('discipline-name');
      await user.click(disciplineName);

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('should stop click propagation on score display', async () => {
      const user = userEvent.setup();
      render(<TrainingResultModal {...defaultProps} />);

      const scoreGain = screen.getByTestId('score-gain');
      await user.click(scoreGain);

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  // ==================== VISUAL STYLING ====================
  describe('Visual Styling', () => {
    it('should have green success color on title', () => {
      render(<TrainingResultModal {...defaultProps} />);

      const title = screen.getByRole('heading', { name: /training complete/i });
      expect(title).toHaveClass('text-[var(--role-success-text)]');
    });

    it('should have green color on score gain', () => {
      render(<TrainingResultModal {...defaultProps} />);

      const scoreGain = screen.getByTestId('score-gain');
      expect(scoreGain).toHaveClass('text-[var(--role-success-text)]');
    });

    it('should have blue primary button styling on close', () => {
      render(<TrainingResultModal {...defaultProps} />);

      const closeButton = screen.getByTestId('close-button');
      expect(closeButton).toHaveClass(
        'bg-[var(--electric-blue-700)]',
        'text-[var(--text-primary)]'
      );
    });

    it('should render GameDialog dim backdrop overlay (bg-black/60 + blur, DECISIONS §4)', () => {
      render(<TrainingResultModal {...defaultProps} />);

      // GameDialog owns the overlay now (the old page-local bg-black/70 div is
      // gone). The shared overlay is the single backdrop-blur-sm element and
      // carries the semi-transparent black scrim.
      const overlay = document.querySelector('.backdrop-blur-sm');
      expect(overlay).not.toBeNull();
      expect(overlay).toHaveClass('bg-black/60');
    });
  });

  // ==================== XP GAIN EDGE CASES ====================
  describe('XP Gain Edge Cases', () => {
    it('should not show XP section when xpGain is 0', () => {
      render(<TrainingResultModal {...defaultProps} xpGain={0} />);

      expect(screen.queryByTestId('xp-gain')).not.toBeInTheDocument();
    });

    it('should show XP section when xpGain is positive', () => {
      render(<TrainingResultModal {...defaultProps} xpGain={100} />);

      expect(screen.getByTestId('xp-gain')).toHaveTextContent('XP: +100');
    });

    it('lists XP as the only additional gain', () => {
      render(<TrainingResultModal {...defaultProps} xpGain={50} />);

      expect(screen.getByTestId('gains-list').children.length).toBe(1);
      expect(screen.getByTestId('xp-gain')).toBeInTheDocument();
    });
  });
});
