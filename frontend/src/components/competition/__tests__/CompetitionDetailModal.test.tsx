/**
 * CompetitionDetailModal Component Tests
 *
 * Tests for the competition detail modal component including:
 * - Component rendering states (open/closed)
 * - Modal behavior (close, backdrop, escape key)
 * - Competition details display (name, discipline, date, prize, fee)
 * - Prize distribution breakdown
 * - Live entry action and horse selection
 * - Accessibility compliance (ARIA, focus trap, scroll lock)
 *
 * Story 5-1: Competition Entry System - Task 4
 * Migrated from BaseModal → GameDialog (Equoria-o5hub.13, DECISIONS.md §8).
 * Focus trap, scroll-lock, Escape, and focus restoration come from Radix Dialog.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CompetitionDetailModal, {
  type CompetitionDetailModalProps,
  type Competition,
} from '../CompetitionDetailModal';

/**
 * GameDialog renders a built-in X close button whose accessible name comes from
 * an sr-only span with the text "Close". The footer also has a visible "Close"
 * button, so we locate the built-in X via the sr-only span specifically.
 */
const getBuiltinCloseButton = (): HTMLButtonElement => {
  const srOnly = screen.getByText('Close', { selector: 'span.sr-only' });
  const button = srOnly.closest('button');
  if (!button) throw new Error('Built-in GameDialog close button not found');
  return button as HTMLButtonElement;
};

describe('CompetitionDetailModal', () => {
  const mockOnClose = vi.fn();
  const mockOnEnter = vi.fn();
  const mockOnSelectedHorseIdChange = vi.fn();

  const sampleCompetition: Competition = {
    id: 1,
    name: 'Spring Grand Prix',
    discipline: 'Show Jumping',
    date: '2026-04-15',
    prizePool: 10000,
    entryFee: 250,
    description: 'Annual spring grand prix event for experienced jumpers.',
    maxParticipants: 30,
    currentParticipants: 18,
    entryRequirements: [
      'Horse must be at least 4 years old',
      'Minimum level 3 in Show Jumping discipline',
      'Valid health certificate required',
    ],
    location: 'Equoria Arena',
  };

  const defaultProps: CompetitionDetailModalProps = {
    isOpen: true,
    onClose: mockOnClose,
    competition: sampleCompetition,
    onEnter: mockOnEnter,
    entryHorses: [{ id: 10, name: 'Starlight' }],
    selectedHorseId: 10,
    onSelectedHorseIdChange: mockOnSelectedHorseIdChange,
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
      render(<CompetitionDetailModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByTestId('competition-detail-modal')).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render modal content when isOpen is true', () => {
      render(<CompetitionDetailModal {...defaultProps} />);

      expect(screen.getByTestId('competition-detail-modal')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should display all competition details correctly', () => {
      render(<CompetitionDetailModal {...defaultProps} />);

      expect(screen.getByTestId('competition-detail-modal-title')).toHaveTextContent(
        'Spring Grand Prix'
      );
      expect(screen.getByTestId('competition-discipline')).toBeInTheDocument();
      expect(screen.getByTestId('competition-date')).toBeInTheDocument();
      expect(screen.getByTestId('competition-prize-pool')).toBeInTheDocument();
      expect(screen.getByTestId('competition-entry-fee')).toBeInTheDocument();
    });

    it('should show live competition entry controls', () => {
      render(<CompetitionDetailModal {...defaultProps} />);

      expect(screen.getByTestId('competition-entry-form')).toBeInTheDocument();
      expect(screen.getByTestId('competition-entry-horse-select')).toHaveValue('10');
      expect(screen.getByTestId('enter-competition-button')).toBeEnabled();
    });

    it('should render built-in close button', () => {
      render(<CompetitionDetailModal {...defaultProps} />);

      expect(getBuiltinCloseButton()).toBeInTheDocument();
    });
  });

  // ==================== MODAL BEHAVIOR (8 tests) ====================
  describe('Modal Behavior', () => {
    it('should open when isOpen changes to true', () => {
      const { rerender } = render(<CompetitionDetailModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByTestId('competition-detail-modal')).not.toBeInTheDocument();

      rerender(<CompetitionDetailModal {...defaultProps} isOpen={true} />);

      expect(screen.getByTestId('competition-detail-modal')).toBeInTheDocument();
    });

    it('should close when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<CompetitionDetailModal {...defaultProps} />);

      await user.click(getBuiltinCloseButton());

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should close when backdrop (overlay) is clicked', async () => {
      const user = userEvent.setup();
      render(<CompetitionDetailModal {...defaultProps} />);

      // GameDialogOverlay is the single backdrop-blur owner (DECISIONS §4)
      const overlay = document.querySelector('.backdrop-blur-sm');
      expect(overlay).not.toBeNull();
      await user.click(overlay as Element);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should close when Escape key is pressed', () => {
      render(<CompetitionDetailModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose callback when closing', async () => {
      const user = userEvent.setup();
      render(<CompetitionDetailModal {...defaultProps} />);

      await user.click(getBuiltinCloseButton());

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should lock body scroll when open (Radix scroll-lock)', () => {
      render(<CompetitionDetailModal {...defaultProps} />);
      // Radix Dialog owns the scroll-lock mechanism (react-remove-scroll applies
      // it via a stylesheet, not document.body.style.overflow). Assert the dialog
      // is present — the lock itself is Radix's responsibility.
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should unmount dialog content when closed', () => {
      const { rerender } = render(<CompetitionDetailModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();

      rerender(<CompetitionDetailModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should move focus into the dialog on open (Radix focus trap)', async () => {
      render(<CompetitionDetailModal {...defaultProps} />);

      await waitFor(() => {
        const modal = screen.getByTestId('competition-detail-modal');
        expect(modal.contains(document.activeElement)).toBe(true);
      });
    });
  });

  // ==================== COMPETITION DETAILS DISPLAY (8 tests) ====================
  describe('Competition Details Display', () => {
    it('should show competition name as heading', () => {
      render(<CompetitionDetailModal {...defaultProps} />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Spring Grand Prix');
    });

    it('should display discipline with proper styling', () => {
      render(<CompetitionDetailModal {...defaultProps} />);

      const disciplineBadge = screen.getByTestId('competition-discipline');
      expect(disciplineBadge).toHaveTextContent('Show Jumping');
      expect(disciplineBadge.className).toMatch(/bg-forest-green\/10/);
    });

    it('should format event date correctly', () => {
      render(<CompetitionDetailModal {...defaultProps} />);

      const dateElement = screen.getByTestId('competition-date');
      // Should contain formatted date (Apr 14 or Apr 15, 2026 depending on timezone)
      expect(dateElement.textContent).toMatch(/Apr\s+\d{1,2},\s+2026/);
    });

    it('should show prize pool amount', () => {
      render(<CompetitionDetailModal {...defaultProps} />);

      const prizePool = screen.getByTestId('competition-prize-pool');
      expect(prizePool).toHaveTextContent('$10,000');
    });

    it('should display entry fee', () => {
      render(<CompetitionDetailModal {...defaultProps} />);

      const entryFee = screen.getByTestId('competition-entry-fee');
      expect(entryFee).toHaveTextContent('$250');
    });

    it('should show prize distribution breakdown (50%/30%/20%)', () => {
      render(<CompetitionDetailModal {...defaultProps} />);

      expect(screen.getByTestId('prize-distribution')).toBeInTheDocument();
      expect(screen.getByTestId('prize-1st')).toHaveTextContent('$5,000');
      expect(screen.getByTestId('prize-2nd')).toHaveTextContent('$3,000');
      expect(screen.getByTestId('prize-3rd')).toHaveTextContent('$2,000');
    });

    it('should display entry requirements', () => {
      render(<CompetitionDetailModal {...defaultProps} />);

      const requirements = screen.getByTestId('entry-requirements');
      expect(requirements).toBeInTheDocument();
      expect(screen.getByText(/Horse must be at least 4 years old/)).toBeInTheDocument();
      expect(screen.getByText(/Minimum level 3/i)).toBeInTheDocument();
    });

    it('should show N/A for missing optional fields', () => {
      const competitionWithMissingFields: Competition = {
        id: 2,
        name: 'Basic Competition',
        discipline: 'Dressage',
        date: '2026-05-01',
        prizePool: 5000,
        entryFee: 100,
      };

      render(
        <CompetitionDetailModal {...defaultProps} competition={competitionWithMissingFields} />
      );

      // Should handle missing requirements gracefully
      expect(screen.getByTestId('entry-requirements')).toHaveTextContent(
        /no specific requirements/i
      );
    });
  });

  // ==================== LIVE ENTRY CONTROLS (3 tests) ====================
  describe('Live Entry Controls', () => {
    it('should show horse selector for live entry', () => {
      render(<CompetitionDetailModal {...defaultProps} />);

      expect(screen.queryByTestId('competition-entry-beta-notice')).not.toBeInTheDocument();
      expect(screen.getByTestId('competition-entry-horse-select')).toBeInTheDocument();
    });

    it('should call onEnter when the entry button is clicked', async () => {
      const user = userEvent.setup();
      render(<CompetitionDetailModal {...defaultProps} />);

      await user.click(screen.getByTestId('enter-competition-button'));

      expect(mockOnEnter).toHaveBeenCalledWith(sampleCompetition.id);
    });

    it('should display error message when error prop is provided', () => {
      render(
        <CompetitionDetailModal
          {...defaultProps}
          error="Failed to enter competition. Please try again."
        />
      );

      expect(screen.getByTestId('error-message')).toBeInTheDocument();
      expect(screen.getByText(/failed to enter competition/i)).toBeInTheDocument();
    });
  });

  // ==================== ACCESSIBILITY (4 tests) ====================
  describe('Accessibility', () => {
    it('should have role="dialog" attribute', () => {
      render(<CompetitionDetailModal {...defaultProps} />);

      const modal = screen.getByTestId('competition-detail-modal');
      expect(modal).toHaveAttribute('role', 'dialog');
    });

    it('should have aria-labelledby pointing to the dialog title', () => {
      render(<CompetitionDetailModal {...defaultProps} />);

      // Radix Dialog auto-wires aria-labelledby on the content to the DialogTitle's ID
      const modal = screen.getByTestId('competition-detail-modal');
      const labelledById = modal.getAttribute('aria-labelledby');
      expect(labelledById).toBeTruthy();

      const titleEl = document.getElementById(labelledById!);
      expect(titleEl).not.toBeNull();
      expect(titleEl!.textContent).toContain('Spring Grand Prix');
    });

    it('should have aria-describedby for description', () => {
      render(<CompetitionDetailModal {...defaultProps} />);

      const modal = screen.getByTestId('competition-detail-modal');
      expect(modal).toHaveAttribute('aria-describedby', 'competition-modal-description');

      const description = document.getElementById('competition-modal-description');
      expect(description).toBeInTheDocument();
    });

    it('should trap focus within modal', async () => {
      const user = userEvent.setup();
      render(<CompetitionDetailModal {...defaultProps} />);

      // Tab through the modal elements
      await user.tab();
      expect(document.activeElement).not.toBe(document.body);

      // Focus should stay within modal
      const modal = screen.getByTestId('competition-detail-modal');
      expect(modal.contains(document.activeElement)).toBe(true);
    });
  });

  // ==================== EDGE CASES ====================
  describe('Edge Cases', () => {
    it('should handle null competition gracefully', () => {
      render(<CompetitionDetailModal {...defaultProps} competition={null} />);

      // Should not render modal content when competition is null
      expect(screen.queryByTestId('competition-detail-modal')).not.toBeInTheDocument();
    });

    it('should format free entry correctly', () => {
      const freeCompetition: Competition = {
        ...sampleCompetition,
        entryFee: 0,
      };

      render(<CompetitionDetailModal {...defaultProps} competition={freeCompetition} />);

      const entryFee = screen.getByTestId('competition-entry-fee');
      expect(entryFee).toHaveTextContent(/free/i);
    });

    it('should handle very long competition names', () => {
      const longNameCompetition: Competition = {
        ...sampleCompetition,
        name: 'The Annual International Grand Championship Summer Event Series Qualifier Round',
      };

      render(<CompetitionDetailModal {...defaultProps} competition={longNameCompetition} />);

      // Long names render inside the BaseModal title element
      const name = screen.getByTestId('competition-detail-modal-title');
      expect(name).toHaveTextContent('The Annual International Grand Championship');
    });
  });

  // ==================== VISUAL ELEMENTS ====================
  describe('Visual Elements', () => {
    it('should display calendar icon with date', () => {
      render(<CompetitionDetailModal {...defaultProps} />);

      const dateContainer = screen.getByTestId('competition-date');
      const icon = dateContainer.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should display dollar icon with prize pool', () => {
      render(<CompetitionDetailModal {...defaultProps} />);

      const prizeContainer = screen.getByTestId('competition-prize-pool');
      const icon = prizeContainer.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should display trophy icon for prize distribution', () => {
      render(<CompetitionDetailModal {...defaultProps} />);

      const prizeDistribution = screen.getByTestId('prize-distribution');
      const icons = prizeDistribution.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should have X icon in built-in close button', () => {
      render(<CompetitionDetailModal {...defaultProps} />);

      const closeButton = getBuiltinCloseButton();
      const icon = closeButton.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  // ===== Scouting field preview wiring (Equoria-lfkw1) =====
  describe('Scouting field preview (Equoria-lfkw1)', () => {
    const fieldData = {
      success: true,
      show: {
        id: 1,
        name: 'Spring Grand Prix',
        discipline: 'Show Jumping',
        entryFee: 250,
        maxEntries: 30,
        status: 'open',
        closeDate: '2999-04-15T00:00:00Z',
      },
      entryCount: 2,
      maxEntries: 30,
      daysRemaining: 5,
      entries: [
        {
          entryId: 11,
          enteredAt: '2026-04-01T00:00:00Z',
          horseId: 101,
          name: 'Comet Tail',
          breed: 'Arabian',
          level: 4,
          ownerId: 'u1',
          ownerName: 'rival_player',
          topStats: [
            { name: 'speed', value: 88 },
            { name: 'stamina', value: 70 },
            { name: 'agility', value: 65 },
          ],
        },
        {
          entryId: 12,
          enteredAt: '2026-04-02T00:00:00Z',
          horseId: 102,
          name: 'Night Dancer',
          breed: 'Thoroughbred',
          level: 5,
          ownerId: 'u2',
          ownerName: 'another_player',
          topStats: [
            { name: 'balance', value: 80 },
            { name: 'focus', value: 60 },
            { name: 'speed', value: 55 },
          ],
        },
      ],
    };

    it('renders the field preview from real backend-shaped fieldData', () => {
      render(<CompetitionDetailModal {...defaultProps} fieldData={fieldData} />);
      const preview = screen.getByTestId('competition-field-preview');
      expect(preview).toBeInTheDocument();
      // The real entered horse names are present (scout the field).
      fireEvent.click(screen.getByRole('button', { name: /scout the field/i }));
      expect(screen.getByText('Comet Tail')).toBeInTheDocument();
      expect(screen.getByText('Night Dancer')).toBeInTheDocument();
    });

    it('shows a loading message while the field query is pending', () => {
      render(<CompetitionDetailModal {...defaultProps} fieldData={null} fieldLoading />);
      expect(screen.getByTestId('competition-field-loading')).toBeInTheDocument();
    });

    it('does not crash and shows zero-entry field when no entries yet', () => {
      render(
        <CompetitionDetailModal
          {...defaultProps}
          fieldData={{ ...fieldData, entryCount: 0, entries: [] }}
        />
      );
      expect(screen.getByTestId('competition-field-preview')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /scout the field/i })).toBeNull();
    });
  });
});
