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
import CompetitionCard, {
  type Competition,
  type CompetitionCardProps,
} from '../CompetitionCard';

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

    it('displays formatted prize pool', () => {
      render(<CompetitionCard {...defaultProps} />);
      expect(screen.getByTestId('competition-prize')).toBeInTheDocument();
      expect(screen.getByText(/\$5,000/)).toBeInTheDocument();
    });

    it('displays formatted entry fee', () => {
      render(<CompetitionCard {...defaultProps} />);
      expect(screen.getByTestId('competition-fee')).toBeInTheDocument();
      expect(screen.getByText(/\$100/)).toBeInTheDocument();
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
    it('has role of button for clickable card', () => {
      render(<CompetitionCard {...defaultProps} />);
      const card = screen.getByTestId('competition-card');
      expect(card).toHaveAttribute('role', 'button');
    });

    it('has proper tabindex for keyboard navigation', () => {
      render(<CompetitionCard {...defaultProps} />);
      const card = screen.getByTestId('competition-card');
      expect(card).toHaveAttribute('tabindex', '0');
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

    it('has hover styling classes', () => {
      render(<CompetitionCard {...defaultProps} />);
      const card = screen.getByTestId('competition-card');
      expect(card).toHaveClass('hover:shadow-lg');
    });
  });
});
