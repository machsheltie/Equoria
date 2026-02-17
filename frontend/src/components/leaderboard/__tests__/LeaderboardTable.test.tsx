/**
 * LeaderboardTable Component Tests
 *
 * Tests for the leaderboard table component including:
 * - Table rendering with entries
 * - Column headers
 * - Pagination controls (Previous/Next, page display)
 * - Loading state with skeleton rows
 * - Empty state with message
 * - Entry click propagation
 * - Previous/Next button disabled states
 * - Accessibility (table role, ARIA attributes)
 *
 * Story 5-5: Leaderboards - Task 2
 * Target: 13 tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeaderboardTable from '../LeaderboardTable';
import type { LeaderboardEntryData } from '../LeaderboardEntry';

/**
 * Factory to create a test entry with sensible defaults.
 */
const createEntry = (overrides: Partial<LeaderboardEntryData> = {}): LeaderboardEntryData => ({
  rank: 1,
  horseId: 101,
  horseName: 'Thunder',
  ownerId: 'user-1',
  ownerName: 'John Doe',
  primaryStat: 25,
  secondaryStats: {
    level: 25,
    totalCompetitions: 50,
    wins: 15,
    winRate: 30,
    totalPrizeMoney: 12500,
  },
  isCurrentUser: false,
  rankChange: 0,
  ...overrides,
});

/**
 * Creates a list of N entries with ascending ranks.
 */
const createEntries = (count: number): LeaderboardEntryData[] =>
  Array.from({ length: count }, (_, i) =>
    createEntry({
      rank: i + 1,
      horseId: 100 + i,
      horseName: `Horse ${i + 1}`,
      ownerId: `user-${i + 1}`,
      ownerName: `Owner ${i + 1}`,
      primaryStat: 100 - i,
      isCurrentUser: i === 2, // 3rd entry is current user
    })
  );

describe('LeaderboardTable', () => {
  const defaultProps = {
    entries: createEntries(5),
    category: 'level' as const,
    currentPage: 1,
    totalPages: 3,
    onPageChange: vi.fn(),
  };

  describe('Table Rendering', () => {
    it('renders the table container with correct role', () => {
      render(<LeaderboardTable {...defaultProps} />);
      expect(screen.getByTestId('leaderboard-table')).toBeInTheDocument();
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('renders all provided entries', () => {
      render(<LeaderboardTable {...defaultProps} />);
      const entries = screen.getAllByTestId('leaderboard-entry');
      expect(entries).toHaveLength(5);
    });

    it('renders column header row', () => {
      render(<LeaderboardTable {...defaultProps} />);
      expect(screen.getByTestId('table-header')).toBeInTheDocument();
      expect(screen.getByText('Rank')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    it('renders each entry with its rank badge', () => {
      render(<LeaderboardTable {...defaultProps} />);
      expect(screen.getByTestId('rank-badge-1')).toBeInTheDocument();
      expect(screen.getByTestId('rank-badge-2')).toBeInTheDocument();
      expect(screen.getByTestId('rank-badge-3')).toBeInTheDocument();
    });
  });

  describe('Pagination Controls', () => {
    it('renders pagination with current page and total pages', () => {
      render(<LeaderboardTable {...defaultProps} />);
      expect(screen.getByTestId('pagination')).toBeInTheDocument();
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    });

    it('calls onPageChange with next page when Next is clicked', async () => {
      const user = userEvent.setup();
      const onPageChange = vi.fn();
      render(<LeaderboardTable {...defaultProps} onPageChange={onPageChange} currentPage={1} />);

      await user.click(screen.getByTestId('pagination-next'));
      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('calls onPageChange with previous page when Previous is clicked', async () => {
      const user = userEvent.setup();
      const onPageChange = vi.fn();
      render(<LeaderboardTable {...defaultProps} onPageChange={onPageChange} currentPage={2} />);

      await user.click(screen.getByTestId('pagination-prev'));
      expect(onPageChange).toHaveBeenCalledWith(1);
    });

    it('disables Previous button on page 1', () => {
      render(<LeaderboardTable {...defaultProps} currentPage={1} />);
      expect(screen.getByTestId('pagination-prev')).toBeDisabled();
    });

    it('disables Next button on the last page', () => {
      render(<LeaderboardTable {...defaultProps} currentPage={3} totalPages={3} />);
      expect(screen.getByTestId('pagination-next')).toBeDisabled();
    });
  });

  describe('Loading State', () => {
    it('shows skeleton rows when isLoading is true', () => {
      render(<LeaderboardTable {...defaultProps} isLoading={true} entries={[]} />);
      const skeletons = screen.getAllByTestId('skeleton-row');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('does not render entries when loading', () => {
      render(<LeaderboardTable {...defaultProps} isLoading={true} />);
      expect(screen.queryAllByTestId('leaderboard-entry')).toHaveLength(0);
    });
  });

  describe('Empty State', () => {
    it('shows empty message when no entries and not loading', () => {
      render(<LeaderboardTable {...defaultProps} entries={[]} isLoading={false} />);
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No entries found')).toBeInTheDocument();
    });
  });

  describe('Entry Click Propagation', () => {
    it('fires onEntryClick with the clicked entry', async () => {
      const user = userEvent.setup();
      const onEntryClick = vi.fn();
      const entries = createEntries(3);
      render(<LeaderboardTable {...defaultProps} entries={entries} onEntryClick={onEntryClick} />);

      const allEntries = screen.getAllByTestId('leaderboard-entry');
      await user.click(allEntries[0]);
      expect(onEntryClick).toHaveBeenCalledTimes(1);
      expect(onEntryClick).toHaveBeenCalledWith(entries[0]);
    });
  });

  describe('Accessibility', () => {
    it('has aria-label on the table', () => {
      render(<LeaderboardTable {...defaultProps} />);
      expect(screen.getByRole('table')).toHaveAttribute('aria-label', 'Leaderboard rankings');
    });

    it('pagination buttons have accessible labels', () => {
      render(<LeaderboardTable {...defaultProps} />);
      expect(screen.getByTestId('pagination-prev')).toHaveAttribute('aria-label', 'Previous page');
      expect(screen.getByTestId('pagination-next')).toHaveAttribute('aria-label', 'Next page');
    });
  });
});
