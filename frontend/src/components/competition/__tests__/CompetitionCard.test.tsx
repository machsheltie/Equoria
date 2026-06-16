/**
 * CompetitionCard Component Tests
 *
 * Tests for the individual competition card component including:
 * - Rendering competition data (name, discipline, date, prize, fee)
 * - Click handler functionality
 * - Loading skeleton state
 * - Participant count display
 * - Accessibility compliance
 *
 * Story 5-1: Competition Entry System - Task 3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CompetitionCard, { type Competition, type CompetitionCardProps } from '../CompetitionCard';

describe('CompetitionCard', () => {
  const mockOnClick = vi.fn();

  const sampleCompetition: Competition = {
    id: 1,
    name: 'Spring Derby',
    discipline: 'Racing',
    date: '2025-03-15',
    prizePool: 5000,
    entryFee: 100,
    maxParticipants: 20,
    currentParticipants: 12,
  };

  const defaultProps: CompetitionCardProps = {
    competition: sampleCompetition,
    onClick: mockOnClick,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders competition card container', () => {
      render(<CompetitionCard {...defaultProps} />);
      expect(screen.getByTestId('competition-card')).toBeInTheDocument();
    });

    it('displays competition name', () => {
      render(<CompetitionCard {...defaultProps} />);
      expect(screen.getByText('Spring Derby')).toBeInTheDocument();
    });

    it('displays competition discipline', () => {
      render(<CompetitionCard {...defaultProps} />);
      expect(screen.getByText('Racing')).toBeInTheDocument();
    });

    it('displays formatted date', () => {
      render(<CompetitionCard {...defaultProps} />);
      // Date should be formatted as readable string
      expect(screen.getByTestId('competition-date')).toBeInTheDocument();
    });

    it('displays formatted prize pool as coins (no USD)', () => {
      render(<CompetitionCard {...defaultProps} />);
      const prize = screen.getByTestId('competition-prize');
      expect(prize).toBeInTheDocument();
      expect(prize).toHaveTextContent('5,000');
      expect(prize).not.toHaveTextContent('$');
    });

    it('displays formatted entry fee as coins (no USD)', () => {
      render(<CompetitionCard {...defaultProps} />);
      const fee = screen.getByTestId('competition-fee');
      expect(fee).toBeInTheDocument();
      expect(fee).toHaveTextContent('100');
      expect(fee).not.toHaveTextContent('$');
    });

    it('displays participant count when provided', () => {
      render(<CompetitionCard {...defaultProps} />);
      expect(screen.getByTestId('competition-participants')).toBeInTheDocument();
      expect(screen.getByText(/12\/20/)).toBeInTheDocument();
    });
  });

  describe('Click Handler', () => {
    it('calls onClick when card is clicked', async () => {
      const user = userEvent.setup();
      render(<CompetitionCard {...defaultProps} />);

      await user.click(screen.getByTestId('competition-card'));

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClick with competition id', async () => {
      const user = userEvent.setup();
      render(<CompetitionCard {...defaultProps} />);

      await user.click(screen.getByTestId('competition-card'));

      expect(mockOnClick).toHaveBeenCalledWith(1);
    });

    it('handles keyboard enter key press', async () => {
      const user = userEvent.setup();
      render(<CompetitionCard {...defaultProps} />);

      const card = screen.getByTestId('competition-card');
      card.focus();
      await user.keyboard('{Enter}');

      expect(mockOnClick).toHaveBeenCalledWith(1);
    });
  });

  describe('Loading Skeleton', () => {
    it('renders loading skeleton when isLoading is true', () => {
      render(<CompetitionCard {...defaultProps} isLoading={true} />);
      expect(screen.getByTestId('competition-card-skeleton')).toBeInTheDocument();
    });

    it('does not render competition data when loading', () => {
      render(<CompetitionCard {...defaultProps} isLoading={true} />);
      expect(screen.queryByText('Spring Derby')).not.toBeInTheDocument();
    });

    it('skeleton has proper animated class', () => {
      render(<CompetitionCard {...defaultProps} isLoading={true} />);
      const skeleton = screen.getByTestId('competition-card-skeleton');
      expect(skeleton).toHaveClass('animate-pulse');
    });
  });

  describe('Optional Fields', () => {
    it('handles missing maxParticipants gracefully', () => {
      const competitionWithoutMax: Competition = {
        ...sampleCompetition,
        maxParticipants: undefined,
        currentParticipants: undefined,
      };
      render(<CompetitionCard competition={competitionWithoutMax} onClick={mockOnClick} />);
      expect(screen.queryByTestId('competition-participants')).not.toBeInTheDocument();
    });

    it('renders correctly with zero entry fee', () => {
      const freeCompetition: Competition = {
        ...sampleCompetition,
        entryFee: 0,
      };
      render(<CompetitionCard competition={freeCompetition} onClick={mockOnClick} />);
      expect(screen.getByText(/free/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('is a real button element (native button semantics)', () => {
      // Equoria-o5hub ratchet (c): the card is a native <button> via
      // Surface(interactive) — implicit role="button", no ARIA bolt-on needed.
      render(<CompetitionCard {...defaultProps} />);
      const card = screen.getByTestId('competition-card');
      expect(card.tagName).toBe('BUTTON');
      expect(screen.getByRole('button', { name: /spring derby/i })).toBe(card);
    });

    it('is keyboard focusable (native button, no manual tabindex)', () => {
      render(<CompetitionCard {...defaultProps} />);
      const card = screen.getByTestId('competition-card');
      card.focus();
      expect(document.activeElement).toBe(card);
    });

    it('has descriptive aria-label', () => {
      render(<CompetitionCard {...defaultProps} />);
      const card = screen.getByTestId('competition-card');
      expect(card).toHaveAttribute('aria-label', expect.stringContaining('Spring Derby'));
    });

    it('icons are hidden from screen readers', () => {
      const { container } = render(<CompetitionCard {...defaultProps} />);
      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Custom Styling', () => {
    it('accepts and applies custom className', () => {
      render(<CompetitionCard {...defaultProps} className="custom-test-class" />);
      const card = screen.getByTestId('competition-card');
      expect(card).toHaveClass('custom-test-class');
    });

    it('has the interactive surface hover/focus affordance', () => {
      // Hover lift/glow + token focus ring are owned by the canonical
      // glass-panel-interactive recipe (D-05), not a hand-rolled hover class.
      render(<CompetitionCard {...defaultProps} />);
      const card = screen.getByTestId('competition-card');
      expect(card).toHaveClass('glass-panel');
      expect(card).toHaveClass('glass-panel-interactive');
    });
  });

  /**
   * Equoria-f19cz — Invalid Date sentinel.
   *
   * `date` is typed `string` but the backend can send '' or a non-parseable
   * value at runtime. Without the isNaN(getTime()) guard in formatDate,
   * `new Date(x).toLocaleDateString()` renders the literal "Invalid Date".
   * These sentinels assert the honest "Date unavailable" fallback. Sentinel-
   * positive: a formatDate WITHOUT the guard renders "Invalid Date" in the
   * competition-date cell and fails these assertions.
   */
  describe('Invalid Date handling (Equoria-f19cz)', () => {
    it('renders "Date unavailable", not "Invalid Date", for an unparseable date', () => {
      render(
        <CompetitionCard
          competition={{ ...sampleCompetition, date: 'not-a-date' }}
          onClick={mockOnClick}
        />
      );
      const dateCell = screen.getByTestId('competition-date');
      expect(dateCell).toHaveTextContent('Date unavailable');
      expect(dateCell).not.toHaveTextContent(/Invalid Date/i);
    });

    it('renders "Date unavailable" for an empty-string date', () => {
      render(
        <CompetitionCard competition={{ ...sampleCompetition, date: '' }} onClick={mockOnClick} />
      );
      const dateCell = screen.getByTestId('competition-date');
      expect(dateCell).toHaveTextContent('Date unavailable');
      expect(dateCell).not.toHaveTextContent(/Invalid Date/i);
    });

    it('renders the real formatted date when the date is valid (guard does not break the happy path)', () => {
      render(<CompetitionCard {...defaultProps} />);
      const dateCell = screen.getByTestId('competition-date');
      expect(dateCell).not.toHaveTextContent('Date unavailable');
      expect(dateCell).not.toHaveTextContent(/Invalid Date/i);
      expect(dateCell.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    });
  });
});
