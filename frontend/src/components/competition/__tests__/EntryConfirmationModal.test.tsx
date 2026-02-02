/**
 * EntryConfirmationModal Component Tests
 *
 * Comprehensive tests for the competition entry confirmation modal:
 * - Component rendering states (open/closed, data display)
 * - Balance verification (sufficient/insufficient funds)
 * - Entry submission (loading, success, error states)
 * - Modal behavior (close actions, keyboard, backdrop)
 * - Accessibility compliance (ARIA, focus trap, keyboard nav)
 *
 * Story 5-1: Competition Entry System - Task 6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntryConfirmationModal, {
  type EntryConfirmationModalProps,
} from '../EntryConfirmationModal';

describe('EntryConfirmationModal', () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn().mockResolvedValue(undefined);

  const sampleCompetition = {
    id: 1,
    name: 'Spring Grand Prix',
    discipline: 'Show Jumping',
    date: '2026-04-15',
    entryFee: 250,
  };

  const sampleHorses = [
    { id: 1, name: 'Thunder', level: 5 },
    { id: 2, name: 'Lightning', level: 4 },
  ];

  const defaultProps: EntryConfirmationModalProps = {
    isOpen: true,
    onClose: mockOnClose,
    competition: sampleCompetition,
    selectedHorses: sampleHorses,
    userBalance: 1000,
    onConfirm: mockOnConfirm,
    isSubmitting: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.overflow = '';
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  // ==================== COMPONENT RENDERING (5 tests) ====================
  describe('Component Rendering', () => {
    it('should render nothing when isOpen is false', () => {
      render(<EntryConfirmationModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByTestId('entry-confirmation-modal')).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render modal content when isOpen is true', () => {
      render(<EntryConfirmationModal {...defaultProps} />);

      expect(screen.getByTestId('entry-confirmation-modal')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should display competition summary correctly', () => {
      render(<EntryConfirmationModal {...defaultProps} />);

      expect(screen.getByTestId('competition-name')).toHaveTextContent('Spring Grand Prix');
      expect(screen.getByTestId('competition-discipline')).toHaveTextContent('Show Jumping');
      expect(screen.getByTestId('competition-date')).toBeInTheDocument();
      expect(screen.getByTestId('entry-fee')).toHaveTextContent('$250');
    });

    it('should show selected horses list', () => {
      render(<EntryConfirmationModal {...defaultProps} />);

      const horsesList = screen.getByTestId('selected-horses-list');
      expect(horsesList).toBeInTheDocument();
      expect(within(horsesList).getByText('Thunder')).toBeInTheDocument();
      expect(within(horsesList).getByText('Lightning')).toBeInTheDocument();
    });

    it('should render action buttons (Confirm, Cancel)', () => {
      render(<EntryConfirmationModal {...defaultProps} />);

      expect(screen.getByTestId('confirm-button')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
      expect(screen.getByTestId('close-modal-button')).toBeInTheDocument();
    });
  });

  // ==================== BALANCE VERIFICATION (5 tests) ====================
  describe('Balance Verification', () => {
    it('should show current balance correctly', () => {
      render(<EntryConfirmationModal {...defaultProps} userBalance={1500} />);

      const currentBalance = screen.getByTestId('current-balance');
      expect(currentBalance).toHaveTextContent('$1,500');
    });

    it('should calculate new balance after entry fee', () => {
      render(<EntryConfirmationModal {...defaultProps} userBalance={1000} />);

      const newBalance = screen.getByTestId('new-balance');
      // 1000 - 250 = 750
      expect(newBalance).toHaveTextContent('$750');
    });

    it('should display sufficient balance state with green styling', () => {
      render(<EntryConfirmationModal {...defaultProps} userBalance={1000} />);

      const balanceSection = screen.getByTestId('balance-section');
      expect(balanceSection).toHaveClass('border-green-200');
      expect(screen.getByTestId('balance-status-icon')).toBeInTheDocument();
    });

    it('should display insufficient balance warning with red styling', () => {
      render(<EntryConfirmationModal {...defaultProps} userBalance={100} />);

      const balanceSection = screen.getByTestId('balance-section');
      expect(balanceSection).toHaveClass('border-red-200');
      expect(screen.getByTestId('insufficient-balance-warning')).toBeInTheDocument();
    });

    it('should disable confirm button when insufficient balance', () => {
      render(<EntryConfirmationModal {...defaultProps} userBalance={100} />);

      const confirmButton = screen.getByTestId('confirm-button');
      expect(confirmButton).toBeDisabled();
    });
  });

  // ==================== ENTRY SUBMISSION (6 tests) ====================
  describe('Entry Submission', () => {
    it('should call onConfirm when confirm button is clicked', async () => {
      const user = userEvent.setup();
      render(<EntryConfirmationModal {...defaultProps} />);

      const confirmButton = screen.getByTestId('confirm-button');
      await user.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it('should show loading state during submission', () => {
      render(<EntryConfirmationModal {...defaultProps} isSubmitting={true} />);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      // Look for "Submitting..." text within the confirm button
      const confirmButton = screen.getByTestId('confirm-button');
      expect(within(confirmButton).getByText(/submitting\.\.\./i)).toBeInTheDocument();
    });

    it('should disable all actions during submission', () => {
      render(<EntryConfirmationModal {...defaultProps} isSubmitting={true} />);

      expect(screen.getByTestId('confirm-button')).toBeDisabled();
      expect(screen.getByTestId('cancel-button')).toBeDisabled();
      expect(screen.getByTestId('close-modal-button')).toBeDisabled();
    });

    it('should display success state with confirmation message', () => {
      render(<EntryConfirmationModal {...defaultProps} submitSuccess={true} />);

      expect(screen.getByTestId('success-message')).toBeInTheDocument();
      expect(screen.getByText(/entry confirmed/i)).toBeInTheDocument();
    });

    it('should show entry details in success state', () => {
      render(<EntryConfirmationModal {...defaultProps} submitSuccess={true} />);

      const successSection = screen.getByTestId('success-message');
      expect(within(successSection).getByText(/spring grand prix/i)).toBeInTheDocument();
    });

    it('should display error message with retry option on failure', () => {
      render(
        <EntryConfirmationModal
          {...defaultProps}
          submitError="Failed to submit entry. Please try again."
        />
      );

      expect(screen.getByTestId('error-message')).toBeInTheDocument();
      expect(screen.getByText(/failed to submit entry/i)).toBeInTheDocument();
      // Confirm button should still be enabled to allow retry
      expect(screen.getByTestId('confirm-button')).not.toBeDisabled();
    });
  });

  // ==================== MODAL BEHAVIOR (5 tests) ====================
  describe('Modal Behavior', () => {
    it('should close when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<EntryConfirmationModal {...defaultProps} />);

      const cancelButton = screen.getByTestId('cancel-button');
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should close when close (X) button is clicked', async () => {
      const user = userEvent.setup();
      render(<EntryConfirmationModal {...defaultProps} />);

      const closeButton = screen.getByTestId('close-modal-button');
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should close when backdrop is clicked (not during submission)', async () => {
      const user = userEvent.setup();
      render(<EntryConfirmationModal {...defaultProps} />);

      const backdrop = screen.getByTestId('modal-backdrop');
      await user.click(backdrop);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should close when Escape key is pressed (not during submission)', () => {
      render(<EntryConfirmationModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should NOT close during submission', async () => {
      const user = userEvent.setup();
      render(<EntryConfirmationModal {...defaultProps} isSubmitting={true} />);

      // Try backdrop click
      const backdrop = screen.getByTestId('modal-backdrop');
      await user.click(backdrop);
      expect(mockOnClose).not.toHaveBeenCalled();

      // Try Escape key
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  // ==================== ACCESSIBILITY (4 tests) ====================
  describe('Accessibility', () => {
    it('should have role="dialog" attribute', () => {
      render(<EntryConfirmationModal {...defaultProps} />);

      const modal = screen.getByTestId('entry-confirmation-modal');
      expect(modal).toHaveAttribute('role', 'dialog');
    });

    it('should have aria-labelledby pointing to title', () => {
      render(<EntryConfirmationModal {...defaultProps} />);

      const modal = screen.getByTestId('entry-confirmation-modal');
      expect(modal).toHaveAttribute('aria-labelledby', 'entry-confirmation-title');

      const title = document.getElementById('entry-confirmation-title');
      expect(title).toBeInTheDocument();
    });

    it('should trap focus within modal', async () => {
      const user = userEvent.setup();
      render(<EntryConfirmationModal {...defaultProps} />);

      // Tab through elements
      await user.tab();
      expect(document.activeElement).not.toBe(document.body);

      // Focus should stay within modal
      const modal = screen.getByTestId('entry-confirmation-modal');
      expect(modal.contains(document.activeElement)).toBe(true);
    });

    it('should support keyboard navigation (Tab, Enter, Escape)', async () => {
      const user = userEvent.setup();
      render(<EntryConfirmationModal {...defaultProps} />);

      // Tab to close button
      await user.tab();

      // Tab should move focus
      expect(document.activeElement).not.toBe(document.body);

      // Escape should trigger close
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  // ==================== EDGE CASES ====================
  describe('Edge Cases', () => {
    it('should handle null competition gracefully', () => {
      render(<EntryConfirmationModal {...defaultProps} competition={null} />);

      expect(screen.queryByTestId('entry-confirmation-modal')).not.toBeInTheDocument();
    });

    it('should handle empty horses array', () => {
      render(<EntryConfirmationModal {...defaultProps} selectedHorses={[]} />);

      const horsesList = screen.getByTestId('selected-horses-list');
      expect(within(horsesList).getByText(/no horses selected/i)).toBeInTheDocument();
    });

    it('should handle zero balance correctly', () => {
      render(<EntryConfirmationModal {...defaultProps} userBalance={0} />);

      expect(screen.getByTestId('current-balance')).toHaveTextContent('$0');
      expect(screen.getByTestId('insufficient-balance-warning')).toBeInTheDocument();
    });

    it('should handle free entry (zero entry fee)', () => {
      const freeCompetition = { ...sampleCompetition, entryFee: 0 };
      render(
        <EntryConfirmationModal {...defaultProps} competition={freeCompetition} userBalance={0} />
      );

      expect(screen.getByTestId('entry-fee')).toHaveTextContent(/free/i);
      // Should be able to enter even with zero balance
      expect(screen.getByTestId('confirm-button')).not.toBeDisabled();
    });

    it('should handle single horse selection', () => {
      render(
        <EntryConfirmationModal
          {...defaultProps}
          selectedHorses={[{ id: 1, name: 'Thunder', level: 5 }]}
        />
      );

      const horsesList = screen.getByTestId('selected-horses-list');
      expect(within(horsesList).getByText('Thunder')).toBeInTheDocument();
      expect(within(horsesList).queryByText('Lightning')).not.toBeInTheDocument();
    });

    it('should format currency values correctly', () => {
      render(<EntryConfirmationModal {...defaultProps} userBalance={1234567} />);

      expect(screen.getByTestId('current-balance')).toHaveTextContent('$1,234,567');
    });

    it('should prevent body scroll when open', () => {
      render(<EntryConfirmationModal {...defaultProps} />);

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should restore body scroll when closed', () => {
      const { rerender } = render(<EntryConfirmationModal {...defaultProps} />);

      expect(document.body.style.overflow).toBe('hidden');

      rerender(<EntryConfirmationModal {...defaultProps} isOpen={false} />);

      expect(document.body.style.overflow).toBe('');
    });
  });

  // ==================== VISUAL ELEMENTS ====================
  describe('Visual Elements', () => {
    it('should display checkmark icon for sufficient balance', () => {
      render(<EntryConfirmationModal {...defaultProps} userBalance={1000} />);

      const icon = screen.getByTestId('balance-status-icon');
      expect(icon).toBeInTheDocument();
    });

    it('should display warning icon for insufficient balance', () => {
      render(<EntryConfirmationModal {...defaultProps} userBalance={100} />);

      const warning = screen.getByTestId('insufficient-balance-warning');
      const icon = warning.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should display success checkmark icon on success state', () => {
      render(<EntryConfirmationModal {...defaultProps} submitSuccess={true} />);

      const successSection = screen.getByTestId('success-message');
      const icon = successSection.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should display error X icon on error state', () => {
      render(<EntryConfirmationModal {...defaultProps} submitError="Error occurred" />);

      const errorSection = screen.getByTestId('error-message');
      const icon = errorSection.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should display dollar sign icon with entry fee', () => {
      render(<EntryConfirmationModal {...defaultProps} />);

      const feeSection = screen.getByTestId('entry-fee-section');
      const icon = feeSection.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  // ==================== BUTTON STATES ====================
  describe('Button States', () => {
    it('should have primary styling on confirm button', () => {
      render(<EntryConfirmationModal {...defaultProps} />);

      const confirmButton = screen.getByTestId('confirm-button');
      expect(confirmButton).toHaveClass('bg-blue-600');
    });

    it('should have secondary styling on cancel button', () => {
      render(<EntryConfirmationModal {...defaultProps} />);

      const cancelButton = screen.getByTestId('cancel-button');
      expect(cancelButton).toHaveClass('border-gray-300');
    });

    it('should show loading spinner in confirm button during submission', () => {
      render(<EntryConfirmationModal {...defaultProps} isSubmitting={true} />);

      const confirmButton = screen.getByTestId('confirm-button');
      const spinner = within(confirmButton).getByTestId('loading-spinner');
      expect(spinner).toBeInTheDocument();
    });
  });
});
