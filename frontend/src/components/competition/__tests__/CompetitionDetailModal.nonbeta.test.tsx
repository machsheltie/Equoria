/**
 * CompetitionDetailModal — Non-Beta Tests
 *
 * Verifies that onEnter and the "Enter Competition" button are present
 * in non-beta mode. The main test file mocks isBetaMode: true; this file
 * tests the non-beta (production) code path.
 *
 * Story 21R-2: Remove production frontend mocks from beta-facing code (fourth-pass correction)
 * Finding: onEnter was removed globally — must be restored behind !isBetaMode.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CompetitionDetailModal, {
  type Competition,
  type CompetitionDetailModalProps,
} from '../CompetitionDetailModal';

// Non-beta environment
vi.mock('@/config/betaRouteScope', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/betaRouteScope')>();
  return { ...actual, isBetaMode: false };
});

describe('CompetitionDetailModal — non-beta mode', () => {
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
  };

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.overflow = '';
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('shows Enter Competition button when onEnter is provided in non-beta', () => {
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

  it('does not show the beta-excluded notice in non-beta mode', () => {
    render(<CompetitionDetailModal {...defaultProps} />);

    expect(screen.queryByTestId('competition-entry-beta-notice')).not.toBeInTheDocument();
  });

  it('does not show Enter Competition button when onEnter is not provided', () => {
    render(<CompetitionDetailModal {...defaultProps} onEnter={undefined} />);

    expect(screen.queryByTestId('enter-competition-button')).not.toBeInTheDocument();
  });
});
