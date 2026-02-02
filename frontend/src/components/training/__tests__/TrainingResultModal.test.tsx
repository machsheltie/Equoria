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
 * - Backdrop click to close
 * - Click propagation handling
 * - Focus management
 * - Accessibility (ARIA attributes)
 * - Edge cases (large values, many stats, rapid cycles)
 *
 * Story 4-1: Training Session Interface - Task 5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
      expect(title).toHaveClass('text-green-600');

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
      expect(scoreGain).toHaveClass('text-4xl', 'font-bold', 'text-green-600');
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
    it('should show stat gains when provided', () => {
      render(<TrainingResultModal {...defaultProps} statGains={{ Precision: 2, Focus: 1 }} />);

      expect(screen.getByTestId('additional-gains-section')).toBeInTheDocument();
      expect(screen.getByTestId('stat-gain-Precision')).toHaveTextContent('Precision: +2');
    });

    it('should display multiple stat gains correctly', () => {
      const statGains = {
        Precision: 2,
        Focus: 1,
        Speed: 3,
      };

      render(<TrainingResultModal {...defaultProps} statGains={statGains} />);

      expect(screen.getByTestId('stat-gain-Precision')).toHaveTextContent('Precision: +2');
      expect(screen.getByTestId('stat-gain-Focus')).toHaveTextContent('Focus: +1');
      expect(screen.getByTestId('stat-gain-Speed')).toHaveTextContent('Speed: +3');
    });

    it('should show XP gain when provided', () => {
      render(<TrainingResultModal {...defaultProps} xpGain={25} />);

      const xpGain = screen.getByTestId('xp-gain');
      expect(xpGain).toHaveTextContent('XP: +25');
      expect(xpGain).toHaveClass('text-yellow-600', 'font-semibold');
    });

    it('should handle missing optional gains (statGains and xpGain undefined)', () => {
      render(<TrainingResultModal {...defaultProps} statGains={undefined} xpGain={undefined} />);

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

    it('should call onClose when Escape key is pressed', () => {
      render(<TrainingResultModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', async () => {
      const user = userEvent.setup();
      render(<TrainingResultModal {...defaultProps} />);

      const backdrop = screen.getByTestId('training-result-modal-backdrop');
      await user.click(backdrop);

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

    it('should handle many stat gains (5+ stats)', () => {
      const manyStats = {
        Precision: 2,
        Focus: 1,
        Speed: 3,
        Stamina: 2,
        Agility: 1,
        Intelligence: 1,
      };

      render(<TrainingResultModal {...defaultProps} statGains={manyStats} />);

      const gainsList = screen.getByTestId('gains-list');
      expect(gainsList.children.length).toBe(6);

      expect(screen.getByTestId('stat-gain-Precision')).toBeInTheDocument();
      expect(screen.getByTestId('stat-gain-Focus')).toBeInTheDocument();
      expect(screen.getByTestId('stat-gain-Speed')).toBeInTheDocument();
      expect(screen.getByTestId('stat-gain-Stamina')).toBeInTheDocument();
      expect(screen.getByTestId('stat-gain-Agility')).toBeInTheDocument();
      expect(screen.getByTestId('stat-gain-Intelligence')).toBeInTheDocument();
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
      expect(title).toHaveClass('text-green-600');
    });

    it('should have green color on score gain', () => {
      render(<TrainingResultModal {...defaultProps} />);

      const scoreGain = screen.getByTestId('score-gain');
      expect(scoreGain).toHaveClass('text-green-600');
    });

    it('should have blue primary button styling on close', () => {
      render(<TrainingResultModal {...defaultProps} />);

      const closeButton = screen.getByTestId('close-button');
      expect(closeButton).toHaveClass('bg-blue-600', 'text-white');
    });

    it('should have modal backdrop with semi-transparent black', () => {
      render(<TrainingResultModal {...defaultProps} />);

      const backdrop = screen.getByTestId('training-result-modal-backdrop');
      expect(backdrop).toHaveClass('bg-black/50');
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

    it('should show both stat gains and XP when both provided', () => {
      render(<TrainingResultModal {...defaultProps} statGains={{ Precision: 2 }} xpGain={50} />);

      expect(screen.getByTestId('stat-gain-Precision')).toBeInTheDocument();
      expect(screen.getByTestId('xp-gain')).toBeInTheDocument();
    });
  });

  // ==================== EMPTY STAT GAINS ====================
  describe('Empty Stat Gains', () => {
    it('should not show additional gains section when statGains is empty object', () => {
      render(<TrainingResultModal {...defaultProps} statGains={{}} />);

      expect(screen.queryByTestId('additional-gains-section')).not.toBeInTheDocument();
    });

    it('should show section only with XP when statGains is empty but xpGain exists', () => {
      render(<TrainingResultModal {...defaultProps} statGains={{}} xpGain={25} />);

      expect(screen.getByTestId('additional-gains-section')).toBeInTheDocument();
      expect(screen.getByTestId('xp-gain')).toBeInTheDocument();
    });
  });
});
