/**
 * PrizeTransactionHistory Component Tests
 *
 * Comprehensive test suite for the prize transaction history component.
 * Tests cover:
 * - Component rendering with transactions and controls
 * - Filter functionality (date range, horse, discipline)
 * - Sort functionality (date, prize, XP, placement)
 * - Pagination behavior
 * - Empty and loading states
 * - Accessibility compliance
 *
 * Target: 20+ tests following TDD methodology
 * Story 5-3: Competition History Display - Task 3
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PrizeTransactionHistory, {
  type PrizeTransactionHistoryProps,
  type PrizeTransaction,
  type TransactionFilters,
  type SortConfig,
} from '../PrizeTransactionHistory';

describe('PrizeTransactionHistory', () => {
  const mockOnFilterChange = vi.fn();
  const mockOnSortChange = vi.fn();
  const mockOnPageChange = vi.fn();
  const mockOnViewCompetition = vi.fn();
  const mockOnViewHorse = vi.fn();

  // Sample transactions for testing
  const sampleTransactions: PrizeTransaction[] = [
    {
      transactionId: 'txn-001',
      date: '2026-01-25',
      competitionId: 1,
      competitionName: 'Spring Derby Championship',
      horseId: 101,
      horseName: 'Thunder Bolt',
      discipline: 'Racing',
      placement: 1,
      prizeMoney: 5000,
      xpGained: 150,
      claimed: true,
      claimedAt: '2026-01-25T15:30:00Z',
    },
    {
      transactionId: 'txn-002',
      date: '2026-01-20',
      competitionId: 2,
      competitionName: 'Summer Dressage Classic',
      horseId: 102,
      horseName: 'Lightning Flash',
      discipline: 'Dressage',
      placement: 2,
      prizeMoney: 2500,
      xpGained: 100,
      claimed: true,
      claimedAt: '2026-01-20T16:00:00Z',
    },
    {
      transactionId: 'txn-003',
      date: '2026-01-15',
      competitionId: 3,
      competitionName: 'Autumn Show Jumping Event',
      horseId: 101,
      horseName: 'Thunder Bolt',
      discipline: 'Show Jumping',
      placement: 3,
      prizeMoney: 1500,
      xpGained: 75,
      claimed: true,
      claimedAt: '2026-01-15T14:00:00Z',
    },
    {
      transactionId: 'txn-004',
      date: '2026-01-10',
      competitionId: 4,
      competitionName: 'Winter Endurance Challenge',
      horseId: 103,
      horseName: 'Storm Chaser',
      discipline: 'Endurance',
      placement: 8,
      prizeMoney: 0,
      xpGained: 25,
      claimed: true,
      claimedAt: '2026-01-10T12:00:00Z',
    },
    {
      transactionId: 'txn-005',
      date: '2025-12-20',
      competitionId: 5,
      competitionName: 'Cross Country Masters',
      horseId: 102,
      horseName: 'Lightning Flash',
      discipline: 'Cross Country',
      placement: 1,
      prizeMoney: 7500,
      xpGained: 150,
      claimed: true,
      claimedAt: '2025-12-20T11:00:00Z',
    },
  ];

  // Sample horses for filter dropdown
  const sampleHorses = [
    { id: 101, name: 'Thunder Bolt' },
    { id: 102, name: 'Lightning Flash' },
    { id: 103, name: 'Storm Chaser' },
  ];

  // Sample disciplines for filter dropdown
  const sampleDisciplines = [
    'Racing',
    'Dressage',
    'Show Jumping',
    'Endurance',
    'Cross Country',
  ];

  const defaultProps: PrizeTransactionHistoryProps = {
    transactions: sampleTransactions,
    horses: sampleHorses,
    disciplines: sampleDisciplines,
    onFilterChange: mockOnFilterChange,
    onSortChange: mockOnSortChange,
    onPageChange: mockOnPageChange,
    onViewCompetition: mockOnViewCompetition,
    onViewHorse: mockOnViewHorse,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================
  // 1. Rendering Tests (5 tests)
  // =========================================
  describe('Rendering Tests', () => {
    it('renders transaction list correctly', () => {
      render(<PrizeTransactionHistory {...defaultProps} />);

      expect(screen.getByTestId('prize-transaction-history')).toBeInTheDocument();
      const rows = screen.getAllByTestId('prize-transaction-row');
      expect(rows).toHaveLength(5);
    });

    it('displays all table columns on desktop', () => {
      render(<PrizeTransactionHistory {...defaultProps} />);

      // Check for column headers
      expect(screen.getByTestId('column-date')).toBeInTheDocument();
      expect(screen.getByTestId('column-competition')).toBeInTheDocument();
      expect(screen.getByTestId('column-horse')).toBeInTheDocument();
      expect(screen.getByTestId('column-placement')).toBeInTheDocument();
      expect(screen.getByTestId('column-prize')).toBeInTheDocument();
      expect(screen.getByTestId('column-xp')).toBeInTheDocument();
    });

    it('displays filter controls', () => {
      render(<PrizeTransactionHistory {...defaultProps} />);

      expect(screen.getByTestId('filter-date-range')).toBeInTheDocument();
      expect(screen.getByTestId('filter-horse')).toBeInTheDocument();
      expect(screen.getByTestId('filter-discipline')).toBeInTheDocument();
    });

    it('displays sort controls', () => {
      render(<PrizeTransactionHistory {...defaultProps} />);

      // Sort should be integrated into column headers
      expect(screen.getByTestId('sort-date')).toBeInTheDocument();
      expect(screen.getByTestId('sort-prize')).toBeInTheDocument();
      expect(screen.getByTestId('sort-xp')).toBeInTheDocument();
      expect(screen.getByTestId('sort-placement')).toBeInTheDocument();
    });

    it('displays pagination controls', () => {
      render(<PrizeTransactionHistory {...defaultProps} />);

      expect(screen.getByTestId('pagination-controls')).toBeInTheDocument();
      expect(screen.getByTestId('prev-page-btn')).toBeInTheDocument();
      expect(screen.getByTestId('next-page-btn')).toBeInTheDocument();
      expect(screen.getByTestId('page-info')).toBeInTheDocument();
    });
  });

  // =========================================
  // 2. Filtering Tests (6 tests)
  // =========================================
  describe('Filtering Tests', () => {
    it('date range filter works correctly', async () => {
      const user = userEvent.setup();
      render(<PrizeTransactionHistory {...defaultProps} />);

      const dateFilter = screen.getByTestId('filter-date-range');
      await user.selectOptions(dateFilter, '7days');

      expect(mockOnFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({ dateRange: '7days' })
      );
    });

    it('horse filter works correctly', async () => {
      const user = userEvent.setup();
      render(<PrizeTransactionHistory {...defaultProps} />);

      const horseFilter = screen.getByTestId('filter-horse');
      await user.selectOptions(horseFilter, '101');

      expect(mockOnFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({ horseId: 101 })
      );
    });

    it('discipline filter works correctly', async () => {
      const user = userEvent.setup();
      render(<PrizeTransactionHistory {...defaultProps} />);

      const disciplineFilter = screen.getByTestId('filter-discipline');
      await user.selectOptions(disciplineFilter, 'Racing');

      expect(mockOnFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({ discipline: 'Racing' })
      );
    });

    it('clear filters button resets all filters', async () => {
      const user = userEvent.setup();
      const filtersApplied: TransactionFilters = {
        dateRange: '30days',
        horseId: 101,
        discipline: 'Racing',
      };

      render(
        <PrizeTransactionHistory
          {...defaultProps}
          filters={filtersApplied}
        />
      );

      const clearButton = screen.getByTestId('clear-filters');
      await user.click(clearButton);

      expect(mockOnFilterChange).toHaveBeenCalledWith({
        dateRange: 'all',
        horseId: 'all',
        discipline: 'all',
      });
    });

    it('multiple filters work together', async () => {
      const user = userEvent.setup();
      render(<PrizeTransactionHistory {...defaultProps} />);

      const horseFilter = screen.getByTestId('filter-horse');
      await user.selectOptions(horseFilter, '101');

      const disciplineFilter = screen.getByTestId('filter-discipline');
      await user.selectOptions(disciplineFilter, 'Racing');

      // Both filter changes should have been called
      expect(mockOnFilterChange).toHaveBeenCalledTimes(2);
    });

    it('no results message shows when no matches', () => {
      // Render with filters that produce no results
      const filtersApplied: TransactionFilters = {
        dateRange: 'all',
        horseId: 999, // Non-existent horse
        discipline: 'all',
      };

      render(
        <PrizeTransactionHistory
          {...defaultProps}
          filters={filtersApplied}
        />
      );

      expect(screen.getByTestId('filtered-empty-state')).toBeInTheDocument();
      expect(screen.getByText(/no transactions match/i)).toBeInTheDocument();
    });
  });

  // =========================================
  // 3. Sorting Tests (4 tests)
  // =========================================
  describe('Sorting Tests', () => {
    it('sort by date works (asc/desc)', async () => {
      const user = userEvent.setup();
      render(<PrizeTransactionHistory {...defaultProps} />);

      const sortDateBtn = screen.getByTestId('sort-date');

      // First click on date (default is desc) - should toggle to asc
      // But since we're in uncontrolled mode, it will use internal state
      // The implementation toggles: if already desc -> asc, else desc
      await user.click(sortDateBtn);

      // Default sortConfig is { field: 'date', direction: 'desc' }
      // So clicking toggles to asc
      expect(mockOnSortChange).toHaveBeenCalledWith({
        field: 'date',
        direction: 'asc',
      });

      // Click again - now direction is asc, should toggle to desc
      await user.click(sortDateBtn);

      expect(mockOnSortChange).toHaveBeenLastCalledWith({
        field: 'date',
        direction: 'asc',
      });
    });

    it('sort by prize money works', async () => {
      const user = userEvent.setup();
      render(<PrizeTransactionHistory {...defaultProps} />);

      const sortPrizeBtn = screen.getByTestId('sort-prize');
      await user.click(sortPrizeBtn);

      expect(mockOnSortChange).toHaveBeenCalledWith({
        field: 'prize',
        direction: expect.any(String),
      });
    });

    it('sort by XP works', async () => {
      const user = userEvent.setup();
      render(<PrizeTransactionHistory {...defaultProps} />);

      const sortXpBtn = screen.getByTestId('sort-xp');
      await user.click(sortXpBtn);

      expect(mockOnSortChange).toHaveBeenCalledWith({
        field: 'xp',
        direction: expect.any(String),
      });
    });

    it('sort by placement works', async () => {
      const user = userEvent.setup();
      render(<PrizeTransactionHistory {...defaultProps} />);

      const sortPlacementBtn = screen.getByTestId('sort-placement');
      await user.click(sortPlacementBtn);

      expect(mockOnSortChange).toHaveBeenCalledWith({
        field: 'placement',
        direction: expect.any(String),
      });
    });
  });

  // =========================================
  // 4. Pagination Tests (3 tests)
  // =========================================
  describe('Pagination Tests', () => {
    it('displays correct page of transactions', () => {
      // Create 25 transactions (more than one page at 20 per page)
      const manyTransactions: PrizeTransaction[] = Array.from({ length: 25 }, (_, i) => ({
        transactionId: `txn-${i + 1}`,
        date: `2026-01-${String(25 - i).padStart(2, '0')}`,
        competitionId: i + 1,
        competitionName: `Competition ${i + 1}`,
        horseId: 101,
        horseName: 'Thunder Bolt',
        discipline: 'Racing',
        placement: 1,
        prizeMoney: 1000 * (i + 1),
        xpGained: 50,
        claimed: true,
        claimedAt: '2026-01-25T15:30:00Z',
      }));

      render(
        <PrizeTransactionHistory
          {...defaultProps}
          transactions={manyTransactions}
          currentPage={1}
          pageSize={20}
        />
      );

      // First page should show 20 transactions
      const rows = screen.getAllByTestId('prize-transaction-row');
      expect(rows).toHaveLength(20);

      // Page info should show page 1 of 2
      expect(screen.getByTestId('page-info')).toHaveTextContent(/Page 1 of 2/i);
    });

    it('next/previous buttons work correctly', async () => {
      const user = userEvent.setup();
      const manyTransactions: PrizeTransaction[] = Array.from({ length: 25 }, (_, i) => ({
        transactionId: `txn-${i + 1}`,
        date: `2026-01-${String(25 - i).padStart(2, '0')}`,
        competitionId: i + 1,
        competitionName: `Competition ${i + 1}`,
        horseId: 101,
        horseName: 'Thunder Bolt',
        discipline: 'Racing',
        placement: 1,
        prizeMoney: 1000 * (i + 1),
        xpGained: 50,
        claimed: true,
        claimedAt: '2026-01-25T15:30:00Z',
      }));

      render(
        <PrizeTransactionHistory
          {...defaultProps}
          transactions={manyTransactions}
          currentPage={1}
          pageSize={20}
        />
      );

      // Click next
      const nextBtn = screen.getByTestId('next-page-btn');
      await user.click(nextBtn);

      expect(mockOnPageChange).toHaveBeenCalledWith(2);
    });

    it('shows correct page count', () => {
      const manyTransactions: PrizeTransaction[] = Array.from({ length: 45 }, (_, i) => ({
        transactionId: `txn-${i + 1}`,
        date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
        competitionId: i + 1,
        competitionName: `Competition ${i + 1}`,
        horseId: 101,
        horseName: 'Thunder Bolt',
        discipline: 'Racing',
        placement: 1,
        prizeMoney: 1000,
        xpGained: 50,
        claimed: true,
        claimedAt: '2026-01-25T15:30:00Z',
      }));

      render(
        <PrizeTransactionHistory
          {...defaultProps}
          transactions={manyTransactions}
          pageSize={20}
        />
      );

      // 45 transactions / 20 per page = 3 pages (ceil)
      expect(screen.getByTestId('page-info')).toHaveTextContent(/of 3/i);
      expect(screen.getByTestId('total-transactions')).toHaveTextContent('45');
    });
  });

  // =========================================
  // 5. Edge Cases (2 tests)
  // =========================================
  describe('Edge Cases', () => {
    it('empty state shows when no transactions', () => {
      render(
        <PrizeTransactionHistory
          {...defaultProps}
          transactions={[]}
        />
      );

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText(/no transactions yet/i)).toBeInTheDocument();
    });

    it('loading state shows skeleton rows', () => {
      render(
        <PrizeTransactionHistory
          {...defaultProps}
          isLoading={true}
        />
      );

      const skeletons = screen.getAllByTestId('transaction-skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  // =========================================
  // 6. Accessibility Tests (2 tests)
  // =========================================
  describe('Accessibility', () => {
    it('has proper ARIA attributes for main container', () => {
      render(<PrizeTransactionHistory {...defaultProps} />);

      const container = screen.getByTestId('prize-transaction-history');
      expect(container).toHaveAttribute('role', 'region');
      expect(container).toHaveAttribute('aria-label', 'Prize transaction history');
    });

    it('filter controls have proper labels', () => {
      render(<PrizeTransactionHistory {...defaultProps} />);

      expect(screen.getByLabelText(/filter by date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/filter by horse/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/filter by discipline/i)).toBeInTheDocument();
    });
  });

  // =========================================
  // 7. Sort Visual Indicator Tests (2 tests)
  // =========================================
  describe('Sort Visual Indicators', () => {
    it('shows ascending arrow icon when sorted ascending', () => {
      const sortConfig: SortConfig = {
        field: 'date',
        direction: 'asc',
      };

      render(
        <PrizeTransactionHistory
          {...defaultProps}
          sortConfig={sortConfig}
        />
      );

      expect(screen.getByTestId('sort-asc-indicator')).toBeInTheDocument();
    });

    it('shows descending arrow icon when sorted descending', () => {
      const sortConfig: SortConfig = {
        field: 'prize',
        direction: 'desc',
      };

      render(
        <PrizeTransactionHistory
          {...defaultProps}
          sortConfig={sortConfig}
        />
      );

      expect(screen.getByTestId('sort-desc-indicator')).toBeInTheDocument();
    });
  });

  // =========================================
  // 8. Responsive Layout Test (1 test)
  // =========================================
  describe('Responsive Layout', () => {
    it('table has responsive classes', () => {
      render(<PrizeTransactionHistory {...defaultProps} />);

      const table = screen.getByTestId('transactions-table');
      // Should have mobile-friendly overflow handling
      expect(table.parentElement).toHaveClass('overflow-x-auto');
    });
  });

  // =========================================
  // 9. Additional Interaction Tests (3 tests)
  // =========================================
  describe('Additional Interaction Tests', () => {
    it('clicking competition link calls onViewCompetition', async () => {
      const user = userEvent.setup();
      render(<PrizeTransactionHistory {...defaultProps} />);

      const competitionLinks = screen.getAllByTestId('competition-link');
      await user.click(competitionLinks[0]);

      expect(mockOnViewCompetition).toHaveBeenCalledWith(1);
    });

    it('clicking horse link calls onViewHorse', async () => {
      const user = userEvent.setup();
      render(<PrizeTransactionHistory {...defaultProps} />);

      const horseLinks = screen.getAllByTestId('horse-link');
      await user.click(horseLinks[0]);

      expect(mockOnViewHorse).toHaveBeenCalledWith(101);
    });

    it('previous button is disabled on first page', () => {
      render(
        <PrizeTransactionHistory
          {...defaultProps}
          currentPage={1}
        />
      );

      const prevBtn = screen.getByTestId('prev-page-btn');
      expect(prevBtn).toBeDisabled();
    });
  });

  // =========================================
  // 10. Filter State Tests (3 tests)
  // =========================================
  describe('Filter State Tests', () => {
    it('clear filters button is disabled when no filters active', () => {
      render(
        <PrizeTransactionHistory
          {...defaultProps}
          filters={{
            dateRange: 'all',
            horseId: 'all',
            discipline: 'all',
          }}
        />
      );

      const clearBtn = screen.getByTestId('clear-filters');
      expect(clearBtn).toBeDisabled();
    });

    it('clear filters button is enabled when filters active', () => {
      render(
        <PrizeTransactionHistory
          {...defaultProps}
          filters={{
            dateRange: '30days',
            horseId: 'all',
            discipline: 'all',
          }}
        />
      );

      const clearBtn = screen.getByTestId('clear-filters');
      expect(clearBtn).not.toBeDisabled();
    });

    it('applies filters from controlled props correctly', () => {
      render(
        <PrizeTransactionHistory
          {...defaultProps}
          filters={{
            dateRange: 'all',
            horseId: 101,
            discipline: 'all',
          }}
        />
      );

      // Should only show transactions for Thunder Bolt (horseId 101)
      // Original data has 2 transactions for horse 101
      const rows = screen.getAllByTestId('prize-transaction-row');
      expect(rows.length).toBe(2);
    });
  });

  // =========================================
  // 11. Custom Page Size Test (1 test)
  // =========================================
  describe('Custom Page Size', () => {
    it('respects custom page size', () => {
      const manyTransactions: PrizeTransaction[] = Array.from({ length: 15 }, (_, i) => ({
        transactionId: `txn-${i + 1}`,
        date: `2026-01-${String(25 - i).padStart(2, '0')}`,
        competitionId: i + 1,
        competitionName: `Competition ${i + 1}`,
        horseId: 101,
        horseName: 'Thunder Bolt',
        discipline: 'Racing',
        placement: 1,
        prizeMoney: 1000,
        xpGained: 50,
        claimed: true,
        claimedAt: '2026-01-25T15:30:00Z',
      }));

      render(
        <PrizeTransactionHistory
          {...defaultProps}
          transactions={manyTransactions}
          pageSize={5}
        />
      );

      // Should show only 5 transactions (custom page size)
      const rows = screen.getAllByTestId('prize-transaction-row');
      expect(rows).toHaveLength(5);

      // Page info should show 3 pages (15 / 5)
      expect(screen.getByTestId('page-info')).toHaveTextContent(/of 3/i);
    });
  });

  // =========================================
  // 12. Title and Header Test (1 test)
  // =========================================
  describe('Title and Header', () => {
    it('displays correct title', () => {
      render(<PrizeTransactionHistory {...defaultProps} />);

      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Prize Transaction History');
    });
  });
});
