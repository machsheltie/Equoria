/**
 * Tests for TrainingHistoryTable Component
 *
 * Tests cover:
 * - Rendering (table structure, headers, data rows, pagination)
 * - Data display (dates, disciplines, scores, gains)
 * - Sorting (column sorting, direction toggle, callbacks)
 * - Pagination (navigation, button states, page display)
 * - Color coding (positive/negative gains)
 * - Loading state (skeleton rows)
 * - Empty state (empty message)
 * - Mobile responsiveness (responsive classes)
 * - Accessibility (caption, scope, ARIA labels)
 *
 * Story 4-2: Training History Display - Task 2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import TrainingHistoryTable from '../TrainingHistoryTable';
import type { TrainingHistoryEntry } from '../TrainingHistoryTable';

describe('TrainingHistoryTable', () => {
  // ==================== TEST DATA ====================

  const mockHistory: TrainingHistoryEntry[] = [
    {
      id: 1,
      date: '2026-01-15T10:00:00Z',
      discipline: 'dressage',
      previousScore: 45,
      newScore: 50,
      scoreGain: 5,
      traits: ['Graceful', 'Focused'],
    },
    {
      id: 2,
      date: '2026-01-10T14:30:00Z',
      discipline: 'show-jumping',
      previousScore: 30,
      newScore: 38,
      scoreGain: 8,
    },
    {
      id: 3,
      date: '2026-01-05T09:15:00Z',
      discipline: 'western-pleasure',
      previousScore: 60,
      newScore: 58,
      scoreGain: -2,
    },
    {
      id: 4,
      date: '2026-01-20T16:45:00Z',
      discipline: 'racing',
      previousScore: 55,
      newScore: 60,
      scoreGain: 5,
    },
    {
      id: 5,
      date: '2026-01-08T11:00:00Z',
      discipline: 'barrel-racing',
      previousScore: 40,
      newScore: 40,
      scoreGain: 0,
    },
  ];

  // Generate more entries for pagination testing
  const generateManyEntries = (count: number): TrainingHistoryEntry[] => {
    return Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      date: new Date(2026, 0, 30 - index).toISOString(),
      discipline: 'dressage',
      previousScore: 40 + index,
      newScore: 45 + index,
      scoreGain: 5,
    }));
  };

  const mockOnSort = vi.fn();

  beforeEach(() => {
    mockOnSort.mockClear();
  });

  // ==================== RENDERING TESTS (5) ====================
  describe('Rendering', () => {
    it('should render table with training history data', () => {
      render(<TrainingHistoryTable history={mockHistory} />);

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });

    it('should render all column headers', () => {
      render(<TrainingHistoryTable history={mockHistory} />);

      expect(screen.getByText('Date')).toBeInTheDocument();
      expect(screen.getByText('Discipline')).toBeInTheDocument();
      expect(screen.getByText('Before')).toBeInTheDocument();
      expect(screen.getByText('After')).toBeInTheDocument();
      expect(screen.getByText('Gain')).toBeInTheDocument();
    });

    it('should render correct number of data rows', () => {
      render(<TrainingHistoryTable history={mockHistory} />);

      const tbody = screen.getByTestId('history-tbody');
      const rows = within(tbody).getAllByRole('row');
      expect(rows.length).toBe(5);
    });

    it('should render pagination controls', () => {
      const manyEntries = generateManyEntries(15);
      render(<TrainingHistoryTable history={manyEntries} pageSize={10} />);

      expect(screen.getByTestId('pagination-previous')).toBeInTheDocument();
      expect(screen.getByTestId('pagination-next')).toBeInTheDocument();
      expect(screen.getByTestId('pagination-info')).toBeInTheDocument();
    });

    it('should accept className prop', () => {
      render(<TrainingHistoryTable history={mockHistory} className="custom-class" />);

      const container = screen.getByTestId('training-history-table');
      expect(container).toHaveClass('custom-class');
    });
  });

  // ==================== DATA DISPLAY TESTS (5) ====================
  describe('Data Display', () => {
    it('should display formatted dates correctly', () => {
      render(<TrainingHistoryTable history={mockHistory} />);

      // Check for "Jan 15" format (MMM DD)
      expect(screen.getByText('Jan 15')).toBeInTheDocument();
      expect(screen.getByText('Jan 10')).toBeInTheDocument();
      expect(screen.getByText('Jan 05')).toBeInTheDocument();
    });

    it('should display discipline names formatted', () => {
      render(<TrainingHistoryTable history={mockHistory} />);

      // formatDisciplineName converts 'dressage' to 'Dressage', etc.
      expect(screen.getByText('Dressage')).toBeInTheDocument();
      expect(screen.getByText('Show Jumping')).toBeInTheDocument();
      expect(screen.getByText('Western Pleasure')).toBeInTheDocument();
    });

    it('should display before scores', () => {
      render(<TrainingHistoryTable history={mockHistory} />);

      // Check that previous scores are displayed (using getAllByText for duplicates)
      expect(screen.getByText('45')).toBeInTheDocument();
      expect(screen.getByText('30')).toBeInTheDocument();
      // 60 appears twice (previousScore and newScore), so use getAllByText
      expect(screen.getAllByText('60').length).toBeGreaterThan(0);
    });

    it('should display after scores', () => {
      render(<TrainingHistoryTable history={mockHistory} />);

      // Check that new scores are displayed
      expect(screen.getByText('50')).toBeInTheDocument();
      expect(screen.getByText('38')).toBeInTheDocument();
      expect(screen.getByText('58')).toBeInTheDocument();
    });

    it('should display score gains', () => {
      render(<TrainingHistoryTable history={mockHistory} />);

      // Positive gains have + prefix (use getAllByText for multiple +5 gains)
      expect(screen.getAllByText('+5').length).toBeGreaterThan(0);
      expect(screen.getByText('+8')).toBeInTheDocument();
      // Negative gain
      expect(screen.getByText('-2')).toBeInTheDocument();
    });
  });

  // ==================== SORTING TESTS (6) ====================
  describe('Sorting', () => {
    it('should call onSort when Date column header is clicked', () => {
      render(<TrainingHistoryTable history={mockHistory} onSort={mockOnSort} />);

      const dateHeader = screen.getByTestId('sort-date');
      fireEvent.click(dateHeader);

      expect(mockOnSort).toHaveBeenCalledWith('date', 'asc');
    });

    it('should call onSort when Discipline column header is clicked', () => {
      render(<TrainingHistoryTable history={mockHistory} onSort={mockOnSort} />);

      const disciplineHeader = screen.getByTestId('sort-discipline');
      fireEvent.click(disciplineHeader);

      expect(mockOnSort).toHaveBeenCalledWith('discipline', 'asc');
    });

    it('should call onSort when Gain column header is clicked', () => {
      render(<TrainingHistoryTable history={mockHistory} onSort={mockOnSort} />);

      const gainHeader = screen.getByTestId('sort-gain');
      fireEvent.click(gainHeader);

      expect(mockOnSort).toHaveBeenCalledWith('scoreGain', 'asc');
    });

    it('should toggle sort direction between asc and desc on repeated clicks', () => {
      render(<TrainingHistoryTable history={mockHistory} onSort={mockOnSort} />);

      const dateHeader = screen.getByTestId('sort-date');

      fireEvent.click(dateHeader);
      expect(mockOnSort).toHaveBeenLastCalledWith('date', 'asc');

      fireEvent.click(dateHeader);
      expect(mockOnSort).toHaveBeenLastCalledWith('date', 'desc');

      fireEvent.click(dateHeader);
      expect(mockOnSort).toHaveBeenLastCalledWith('date', 'asc');
    });

    it('should show sort indicator for current sort direction', () => {
      render(<TrainingHistoryTable history={mockHistory} onSort={mockOnSort} />);

      const dateHeader = screen.getByTestId('sort-date');
      fireEvent.click(dateHeader);

      // Should show ascending indicator
      expect(screen.getByTestId('sort-indicator-date')).toHaveTextContent('↑');

      fireEvent.click(dateHeader);

      // Should show descending indicator
      expect(screen.getByTestId('sort-indicator-date')).toHaveTextContent('↓');
    });

    it('should call onSort callback with correct parameters', () => {
      render(<TrainingHistoryTable history={mockHistory} onSort={mockOnSort} />);

      const disciplineHeader = screen.getByTestId('sort-discipline');
      fireEvent.click(disciplineHeader);

      expect(mockOnSort).toHaveBeenCalledTimes(1);
      expect(mockOnSort).toHaveBeenCalledWith('discipline', 'asc');
    });
  });

  // ==================== PAGINATION TESTS (6) ====================
  describe('Pagination', () => {
    it('should show correct page of data', () => {
      const manyEntries = generateManyEntries(25);
      render(<TrainingHistoryTable history={manyEntries} pageSize={10} />);

      const tbody = screen.getByTestId('history-tbody');
      const rows = within(tbody).getAllByRole('row');
      expect(rows.length).toBe(10);
    });

    it('should disable Previous button on first page', () => {
      const manyEntries = generateManyEntries(25);
      render(<TrainingHistoryTable history={manyEntries} pageSize={10} />);

      const prevButton = screen.getByTestId('pagination-previous');
      expect(prevButton).toBeDisabled();
    });

    it('should disable Next button on last page', () => {
      const manyEntries = generateManyEntries(25);
      render(<TrainingHistoryTable history={manyEntries} pageSize={10} />);

      // Navigate to last page
      const nextButton = screen.getByTestId('pagination-next');
      fireEvent.click(nextButton);
      fireEvent.click(nextButton);

      // On page 3 (last page with 5 items)
      expect(nextButton).toBeDisabled();
    });

    it('should show next page when Next button is clicked', () => {
      const manyEntries = generateManyEntries(25);
      render(<TrainingHistoryTable history={manyEntries} pageSize={10} />);

      const nextButton = screen.getByTestId('pagination-next');
      fireEvent.click(nextButton);

      const paginationInfo = screen.getByTestId('pagination-info');
      expect(paginationInfo).toHaveTextContent('Page 2 of 3');
    });

    it('should show previous page when Previous button is clicked', () => {
      const manyEntries = generateManyEntries(25);
      render(<TrainingHistoryTable history={manyEntries} pageSize={10} />);

      // Go to page 2
      const nextButton = screen.getByTestId('pagination-next');
      fireEvent.click(nextButton);

      // Go back to page 1
      const prevButton = screen.getByTestId('pagination-previous');
      fireEvent.click(prevButton);

      const paginationInfo = screen.getByTestId('pagination-info');
      expect(paginationInfo).toHaveTextContent('Page 1 of 3');
    });

    it('should show correct page number and total pages', () => {
      const manyEntries = generateManyEntries(25);
      render(<TrainingHistoryTable history={manyEntries} pageSize={10} />);

      const paginationInfo = screen.getByTestId('pagination-info');
      expect(paginationInfo).toHaveTextContent('Page 1 of 3');
    });
  });

  // ==================== COLOR CODING TESTS (3) ====================
  describe('Color Coding', () => {
    it('should show positive gains in green text', () => {
      render(<TrainingHistoryTable history={mockHistory} />);

      // Use getAllByText since +5 appears multiple times
      const positiveGains = screen.getAllByText('+5');
      expect(positiveGains[0]).toHaveClass('text-green-600');
    });

    it('should show negative gains in red text', () => {
      render(<TrainingHistoryTable history={mockHistory} />);

      const negativeGain = screen.getByText('-2');
      expect(negativeGain).toHaveClass('text-red-600');
    });

    it('should prefix positive gains with + sign', () => {
      render(<TrainingHistoryTable history={mockHistory} />);

      // Score gain of 5 should be displayed as "+5" (use getAllByText for duplicates)
      expect(screen.getAllByText('+5').length).toBeGreaterThan(0);
      expect(screen.getByText('+8')).toBeInTheDocument();
    });
  });

  // ==================== LOADING STATE TESTS (2) ====================
  describe('Loading State', () => {
    it('should show skeleton rows when loading is true', () => {
      render(<TrainingHistoryTable history={[]} loading={true} />);

      const skeletonRows = screen.getAllByTestId(/skeleton-row-/);
      expect(skeletonRows.length).toBeGreaterThan(0);
    });

    it('should show correct number of skeleton rows', () => {
      render(<TrainingHistoryTable history={[]} loading={true} />);

      const skeletonRows = screen.getAllByTestId(/skeleton-row-/);
      // Default should show 5 skeleton rows
      expect(skeletonRows.length).toBe(5);
    });
  });

  // ==================== EMPTY STATE TESTS (2) ====================
  describe('Empty State', () => {
    it('should show empty message when history is empty', () => {
      render(<TrainingHistoryTable history={[]} />);

      expect(screen.getByText('No training history found')).toBeInTheDocument();
    });

    it('should have appropriate styling on empty message', () => {
      render(<TrainingHistoryTable history={[]} />);

      const emptyMessage = screen.getByTestId('empty-state');
      expect(emptyMessage).toHaveClass('text-gray-500');
    });
  });

  // ==================== MOBILE RESPONSIVE TESTS (1) ====================
  describe('Mobile Responsive', () => {
    it('should have responsive table classes', () => {
      render(<TrainingHistoryTable history={mockHistory} />);

      const tableContainer = screen.getByTestId('table-container');
      expect(tableContainer).toHaveClass('overflow-x-auto');
    });
  });

  // ==================== ACCESSIBILITY TESTS (5) ====================
  describe('Accessibility', () => {
    it('should have caption element describing the table', () => {
      render(<TrainingHistoryTable history={mockHistory} />);

      const caption = screen.getByText(
        'Training history showing date, discipline, and score changes'
      );
      expect(caption).toBeInTheDocument();
      expect(caption.tagName.toLowerCase()).toBe('caption');
    });

    it('should have scope attributes on th elements', () => {
      render(<TrainingHistoryTable history={mockHistory} />);

      const headerCells = screen.getAllByRole('columnheader');
      headerCells.forEach((header) => {
        expect(header).toHaveAttribute('scope', 'col');
      });
    });

    it('should have ARIA labels for sort buttons', () => {
      render(<TrainingHistoryTable history={mockHistory} onSort={mockOnSort} />);

      const dateSort = screen.getByTestId('sort-date');
      expect(dateSort).toHaveAttribute('aria-label');
      expect(dateSort.getAttribute('aria-label')).toContain('Sort by date');
    });

    it('should have ARIA labels for pagination controls', () => {
      const manyEntries = generateManyEntries(25);
      render(<TrainingHistoryTable history={manyEntries} pageSize={10} />);

      const prevButton = screen.getByTestId('pagination-previous');
      const nextButton = screen.getByTestId('pagination-next');

      expect(prevButton).toHaveAttribute('aria-label', 'Go to previous page');
      expect(nextButton).toHaveAttribute('aria-label', 'Go to next page');
    });

    it('should use semantic HTML table elements', () => {
      render(<TrainingHistoryTable history={mockHistory} />);

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader').length).toBe(5);
      expect(screen.getAllByRole('row').length).toBeGreaterThan(0);
    });
  });

  // ==================== STYLING TESTS (3) ====================
  describe('Styling', () => {
    it('should have alternating row colors', () => {
      render(<TrainingHistoryTable history={mockHistory} />);

      const tbody = screen.getByTestId('history-tbody');
      const rows = within(tbody).getAllByRole('row');

      // Even rows should have bg-gray-50 class
      expect(rows[1]).toHaveClass('even:bg-gray-50');
    });

    it('should have header styling', () => {
      render(<TrainingHistoryTable history={mockHistory} />);

      const thead = screen.getByTestId('history-thead');
      expect(thead).toHaveClass('bg-gray-100');
    });

    it('should have divide-y border styling', () => {
      render(<TrainingHistoryTable history={mockHistory} />);

      const tbody = screen.getByTestId('history-tbody');
      expect(tbody).toHaveClass('divide-y', 'divide-gray-200');
    });
  });

  // ==================== EDGE CASES TESTS (3) ====================
  describe('Edge Cases', () => {
    it('should handle zero score gain', () => {
      render(<TrainingHistoryTable history={mockHistory} />);

      // Score gain of 0 should be displayed as "0" without + or -
      const zeroGain = screen.getByText('0');
      expect(zeroGain).toBeInTheDocument();
      // Zero gain should have neutral styling
      expect(zeroGain).toHaveClass('text-gray-600');
    });

    it('should handle entries without traits', () => {
      const historyWithoutTraits: TrainingHistoryEntry[] = [
        {
          id: 1,
          date: '2026-01-15T10:00:00Z',
          discipline: 'dressage',
          previousScore: 45,
          newScore: 50,
          scoreGain: 5,
        },
      ];

      render(<TrainingHistoryTable history={historyWithoutTraits} />);

      // Should render without error
      expect(screen.getByText('Dressage')).toBeInTheDocument();
    });

    it('should not show pagination when entries fit on one page', () => {
      render(<TrainingHistoryTable history={mockHistory} pageSize={10} />);

      // 5 entries with pageSize 10 should not show pagination
      expect(screen.queryByTestId('pagination-previous')).not.toBeInTheDocument();
    });
  });

  // ==================== DEFAULT PROPS TESTS (2) ====================
  describe('Default Props', () => {
    it('should default pageSize to 10', () => {
      const manyEntries = generateManyEntries(25);
      render(<TrainingHistoryTable history={manyEntries} />);

      const tbody = screen.getByTestId('history-tbody');
      const rows = within(tbody).getAllByRole('row');
      expect(rows.length).toBe(10);
    });

    it('should default loading to false', () => {
      render(<TrainingHistoryTable history={mockHistory} />);

      // Should not show skeleton rows
      expect(screen.queryByTestId('skeleton-row-0')).not.toBeInTheDocument();
    });
  });
});
