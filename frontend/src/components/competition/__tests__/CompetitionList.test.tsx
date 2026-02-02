/**
 * CompetitionList Component Tests
 *
 * Tests for the competition grid component including:
 * - Responsive grid layout (1 col mobile, 2 tablet, 3 desktop)
 * - Loading skeleton cards
 * - Empty state handling
 * - Click handler propagation
 * - Competition count display
 * - Accessibility compliance
 *
 * Story 5-1: Competition Entry System - Task 3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CompetitionList, { type CompetitionListProps } from '../CompetitionList';
import { type Competition } from '../CompetitionCard';

describe('CompetitionList', () => {
  const mockOnCompetitionClick = vi.fn();

  const sampleCompetitions: Competition[] = [
    {
      id: 1,
      name: 'Spring Derby',
      discipline: 'Racing',
      date: '2025-03-15',
      prizePool: 5000,
      entryFee: 100,
      maxParticipants: 20,
      currentParticipants: 12,
    },
    {
      id: 2,
      name: 'Summer Dressage Classic',
      discipline: 'Dressage',
      date: '2025-06-20',
      prizePool: 3500,
      entryFee: 75,
      maxParticipants: 15,
      currentParticipants: 8,
    },
    {
      id: 3,
      name: 'Autumn Show Jumping',
      discipline: 'Show Jumping',
      date: '2025-09-10',
      prizePool: 4000,
      entryFee: 90,
      maxParticipants: 25,
      currentParticipants: 20,
    },
    {
      id: 4,
      name: 'Winter Endurance',
      discipline: 'Endurance',
      date: '2025-12-05',
      prizePool: 2500,
      entryFee: 50,
      maxParticipants: 30,
      currentParticipants: 15,
    },
  ];

  const defaultProps: CompetitionListProps = {
    competitions: sampleCompetitions,
    onCompetitionClick: mockOnCompetitionClick,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders competition list container', () => {
      render(<CompetitionList {...defaultProps} />);
      expect(screen.getByTestId('competition-list')).toBeInTheDocument();
    });

    it('renders all competition cards', () => {
      render(<CompetitionList {...defaultProps} />);
      const cards = screen.getAllByTestId('competition-card');
      expect(cards).toHaveLength(4);
    });

    it('displays all competition names', () => {
      render(<CompetitionList {...defaultProps} />);
      expect(screen.getByText('Spring Derby')).toBeInTheDocument();
      expect(screen.getByText('Summer Dressage Classic')).toBeInTheDocument();
      expect(screen.getByText('Autumn Show Jumping')).toBeInTheDocument();
      expect(screen.getByText('Winter Endurance')).toBeInTheDocument();
    });

    it('shows competition count header', () => {
      render(<CompetitionList {...defaultProps} />);
      expect(screen.getByText(/4 competitions/i)).toBeInTheDocument();
    });

    it('shows singular form for 1 competition', () => {
      render(
        <CompetitionList
          competitions={[sampleCompetitions[0]]}
          onCompetitionClick={mockOnCompetitionClick}
        />
      );
      expect(screen.getByText(/1 competition/i)).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no competitions', () => {
      render(<CompetitionList competitions={[]} onCompetitionClick={mockOnCompetitionClick} />);
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    it('displays empty state message', () => {
      render(<CompetitionList competitions={[]} onCompetitionClick={mockOnCompetitionClick} />);
      expect(screen.getByText(/no competitions found/i)).toBeInTheDocument();
    });

    it('displays empty state description', () => {
      render(<CompetitionList competitions={[]} onCompetitionClick={mockOnCompetitionClick} />);
      expect(screen.getByText(/check back later/i)).toBeInTheDocument();
    });

    it('does not show competition cards in empty state', () => {
      render(<CompetitionList competitions={[]} onCompetitionClick={mockOnCompetitionClick} />);
      expect(screen.queryByTestId('competition-card')).not.toBeInTheDocument();
    });

    it('shows trophy icon in empty state', () => {
      const { container } = render(
        <CompetitionList competitions={[]} onCompetitionClick={mockOnCompetitionClick} />
      );
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading skeletons when isLoading is true', () => {
      render(
        <CompetitionList {...defaultProps} isLoading={true} />
      );
      expect(screen.getAllByTestId('competition-card-skeleton')).toHaveLength(6);
    });

    it('does not show competition cards when loading', () => {
      render(
        <CompetitionList {...defaultProps} isLoading={true} />
      );
      expect(screen.queryByTestId('competition-card')).not.toBeInTheDocument();
    });

    it('shows loading message', () => {
      render(
        <CompetitionList {...defaultProps} isLoading={true} />
      );
      expect(screen.getByText(/loading competitions/i)).toBeInTheDocument();
    });

    it('skeleton cards have animation', () => {
      render(
        <CompetitionList {...defaultProps} isLoading={true} />
      );
      const skeletons = screen.getAllByTestId('competition-card-skeleton');
      skeletons.forEach((skeleton) => {
        expect(skeleton).toHaveClass('animate-pulse');
      });
    });
  });

  describe('Click Handler', () => {
    it('calls onCompetitionClick when a card is clicked', async () => {
      const user = userEvent.setup();
      render(<CompetitionList {...defaultProps} />);

      const cards = screen.getAllByTestId('competition-card');
      await user.click(cards[0]);

      expect(mockOnCompetitionClick).toHaveBeenCalledTimes(1);
    });

    it('calls onCompetitionClick with correct competition id', async () => {
      const user = userEvent.setup();
      render(<CompetitionList {...defaultProps} />);

      const cards = screen.getAllByTestId('competition-card');
      await user.click(cards[1]); // Second card has id 2

      expect(mockOnCompetitionClick).toHaveBeenCalledWith(2);
    });

    it('handles multiple card clicks correctly', async () => {
      const user = userEvent.setup();
      render(<CompetitionList {...defaultProps} />);

      const cards = screen.getAllByTestId('competition-card');
      await user.click(cards[0]);
      await user.click(cards[2]);

      expect(mockOnCompetitionClick).toHaveBeenCalledTimes(2);
      expect(mockOnCompetitionClick).toHaveBeenNthCalledWith(1, 1);
      expect(mockOnCompetitionClick).toHaveBeenNthCalledWith(2, 3);
    });
  });

  describe('Responsive Grid Layout', () => {
    it('renders grid container', () => {
      render(<CompetitionList {...defaultProps} />);
      const grid = screen.getByTestId('competition-grid');
      expect(grid).toHaveClass('grid');
    });

    it('applies single column layout for mobile', () => {
      render(<CompetitionList {...defaultProps} />);
      const grid = screen.getByTestId('competition-grid');
      expect(grid).toHaveClass('grid-cols-1');
    });

    it('applies two column layout for tablet', () => {
      render(<CompetitionList {...defaultProps} />);
      const grid = screen.getByTestId('competition-grid');
      expect(grid).toHaveClass('md:grid-cols-2');
    });

    it('applies three column layout for desktop', () => {
      render(<CompetitionList {...defaultProps} />);
      const grid = screen.getByTestId('competition-grid');
      expect(grid).toHaveClass('lg:grid-cols-3');
    });

    it('has proper gap between cards', () => {
      render(<CompetitionList {...defaultProps} />);
      const grid = screen.getByTestId('competition-grid');
      expect(grid).toHaveClass('gap-4');
    });
  });

  describe('Accessibility', () => {
    it('has semantic structure with heading', () => {
      render(<CompetitionList {...defaultProps} />);
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    });

    it('empty state has proper heading', () => {
      render(<CompetitionList competitions={[]} onCompetitionClick={mockOnCompetitionClick} />);
      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
    });

    it('all cards are keyboard navigable', () => {
      render(<CompetitionList {...defaultProps} />);
      const cards = screen.getAllByTestId('competition-card');
      cards.forEach((card) => {
        expect(card).toHaveAttribute('tabindex', '0');
      });
    });

    it('has region landmark', () => {
      render(<CompetitionList {...defaultProps} />);
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('accepts and applies custom className', () => {
      render(<CompetitionList {...defaultProps} className="custom-test-class" />);
      const container = screen.getByTestId('competition-list');
      expect(container).toHaveClass('custom-test-class');
    });
  });

  describe('Title Customization', () => {
    it('displays custom title when provided', () => {
      render(<CompetitionList {...defaultProps} title="Available Competitions" />);
      expect(screen.getByText('Available Competitions')).toBeInTheDocument();
    });

    it('displays default title when not provided', () => {
      render(<CompetitionList {...defaultProps} />);
      expect(screen.getByRole('heading', { level: 2, name: /competitions/i })).toBeInTheDocument();
    });
  });
});
