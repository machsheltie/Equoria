/**
 * CompetitionDetailModal — Non-Beta Tests
 *
 * Verifies that onEnter and the "Enter Competition" button work with live horse selection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CompetitionDetailModal, {
  type Competition,
  type CompetitionDetailModalProps,
} from '../CompetitionDetailModal';

describe('CompetitionDetailModal — live entry', () => {
  const mockOnClose = vi.fn();
  const mockOnEnter = vi.fn();

  const sampleCompetition: Competition = {
    id: 1,
    name: 'Spring Grand Prix',
    discipline: 'Show Jumping',
    date: '2026-04-15',
    prizePool: 10000,
    entryFee: 250,
  };

  const defaultProps: CompetitionDetailModalProps = {
    isOpen: true,
    onClose: mockOnClose,
    competition: sampleCompetition,
    onEnter: mockOnEnter,
    entryHorses: [{ id: 20, name: 'Moonlit Ridge' }],
    selectedHorseId: 20,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.overflow = '';
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('shows Enter Competition button when onEnter and a horse are provided', () => {
    render(<CompetitionDetailModal {...defaultProps} />);

    expect(screen.getByTestId('enter-competition-button')).toBeInTheDocument();
    expect(screen.getByText(/enter competition/i)).toBeInTheDocument();
  });

  it('calls onEnter with competition id when Enter Competition is clicked', async () => {
    const user = userEvent.setup();
    render(<CompetitionDetailModal {...defaultProps} />);

    await user.click(screen.getByTestId('enter-competition-button'));

    expect(mockOnEnter).toHaveBeenCalledWith(sampleCompetition.id);
  });

  it('does not show legacy entry exclusion notice', () => {
    render(<CompetitionDetailModal {...defaultProps} />);

    expect(screen.queryByTestId('competition-entry-beta-notice')).not.toBeInTheDocument();
  });

  it('does not show Enter Competition button when onEnter is not provided', () => {
    render(<CompetitionDetailModal {...defaultProps} onEnter={undefined} />);

    expect(screen.queryByTestId('enter-competition-button')).not.toBeInTheDocument();
  });
});
