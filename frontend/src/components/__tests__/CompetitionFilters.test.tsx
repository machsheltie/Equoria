/**
 * CompetitionFilters Component Tests
 *
 * Tests cover:
 * - Rendering all filter controls (discipline, date range, entry fee)
 * - Filter state management and callbacks
 * - URL query parameter integration
 * - Clear filters functionality
 * - Accessibility compliance
 *
 * Story 5-1: Competition Entry System - Task 2
 * Target: 20 tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CompetitionFilters from '../CompetitionFilters';
import { DISCIPLINES } from '@/lib/utils/training-utils';

describe('CompetitionFilters', () => {
  // Default props for testing
  const defaultProps = {
    disciplineFilter: 'all' as const,
    dateRangeFilter: 'all' as const,
    entryFeeFilter: 'all' as const,
    onDisciplineChange: vi.fn(),
    onDateRangeChange: vi.fn(),
    onEntryFeeChange: vi.fn(),
    onClearFilters: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders filter container with correct data-testid', () => {
      render(<CompetitionFilters {...defaultProps} />);
      const container = screen.getByTestId('competition-filters');
      expect(container).toBeInTheDocument();
    });

    it('renders discipline dropdown with all 23 options plus "All"', () => {
      render(<CompetitionFilters {...defaultProps} />);
      const select = screen.getByTestId('filter-discipline');
      expect(select).toBeInTheDocument();

      // Should have 24 options (23 disciplines + "All")
      const options = select.querySelectorAll('option');
      expect(options).toHaveLength(24);

      // First option should be "All Disciplines"
      expect(options[0].textContent).toBe('All Disciplines');

      // Should include all disciplines
      DISCIPLINES.forEach(discipline => {
        expect(screen.getByRole('option', { name: discipline.name })).toBeInTheDocument();
      });
    });

    it('renders all filter sections with proper labels', () => {
      render(<CompetitionFilters {...defaultProps} />);

      // Check for filter sections
      expect(screen.getByText('Discipline')).toBeInTheDocument();
      expect(screen.getByText('Date Range')).toBeInTheDocument();
      expect(screen.getByText('Entry Fee')).toBeInTheDocument();

      // Check for clear button
      expect(screen.getByTestId('filter-clear')).toBeInTheDocument();
    });
  });

  describe('Discipline Filter', () => {
    it('shows selected discipline from props', () => {
      render(<CompetitionFilters {...defaultProps} disciplineFilter="dressage" />);
      const select = screen.getByTestId('filter-discipline') as HTMLSelectElement;
      expect(select.value).toBe('dressage');
    });

    it('calls onDisciplineChange when discipline is selected', async () => {
      const onDisciplineChange = vi.fn();
      render(<CompetitionFilters {...defaultProps} onDisciplineChange={onDisciplineChange} />);

      const select = screen.getByTestId('filter-discipline');
      await userEvent.selectOptions(select, 'racing');

      expect(onDisciplineChange).toHaveBeenCalledWith('racing');
    });

    it('groups disciplines by category', () => {
      render(<CompetitionFilters {...defaultProps} />);
      const select = screen.getByTestId('filter-discipline');

      // Check for optgroup elements
      const optgroups = select.querySelectorAll('optgroup');
      expect(optgroups.length).toBeGreaterThan(0);

      // Check for category labels in optgroups
      const optgroupLabels = Array.from(optgroups).map(og => og.getAttribute('label'));
      expect(optgroupLabels).toContain('Western');
      expect(optgroupLabels).toContain('English');
      expect(optgroupLabels).toContain('Racing');
      expect(optgroupLabels).toContain('Specialized');
    });

    it('resets to "All Disciplines" when cleared', async () => {
      const onDisciplineChange = vi.fn();
      render(<CompetitionFilters {...defaultProps} onDisciplineChange={onDisciplineChange} />);

      const select = screen.getByTestId('filter-discipline');
      await userEvent.selectOptions(select, 'all');

      expect(onDisciplineChange).toHaveBeenCalledWith('all');
    });

    it('handles discipline with special characters correctly', async () => {
      const onDisciplineChange = vi.fn();
      render(<CompetitionFilters {...defaultProps} onDisciplineChange={onDisciplineChange} />);

      const select = screen.getByTestId('filter-discipline');
      await userEvent.selectOptions(select, 'show-jumping');

      expect(onDisciplineChange).toHaveBeenCalledWith('show-jumping');
    });
  });

  describe('Date Range Filter', () => {
    it('highlights active date range filter', () => {
      render(<CompetitionFilters {...defaultProps} dateRangeFilter="week" />);

      const weekButton = screen.getByTestId('filter-date-week');
      expect(weekButton).toHaveClass('bg-blue-600', 'text-white');

      // Other buttons should not be active
      const allButton = screen.getByTestId('filter-date-all');
      expect(allButton).not.toHaveClass('bg-blue-600');
    });

    it('calls onDateRangeChange when filter clicked', async () => {
      const onDateRangeChange = vi.fn();
      render(<CompetitionFilters {...defaultProps} onDateRangeChange={onDateRangeChange} />);

      const monthButton = screen.getByTestId('filter-date-month');
      await userEvent.click(monthButton);

      expect(onDateRangeChange).toHaveBeenCalledWith('month');
    });

    it('renders all 4 date range options', () => {
      render(<CompetitionFilters {...defaultProps} />);

      expect(screen.getByTestId('filter-date-all')).toBeInTheDocument();
      expect(screen.getByTestId('filter-date-today')).toBeInTheDocument();
      expect(screen.getByTestId('filter-date-week')).toBeInTheDocument();
      expect(screen.getByTestId('filter-date-month')).toBeInTheDocument();
    });
  });

  describe('Entry Fee Filter', () => {
    it('highlights active entry fee filter', () => {
      render(<CompetitionFilters {...defaultProps} entryFeeFilter="free" />);

      const freeButton = screen.getByTestId('filter-fee-free');
      expect(freeButton).toHaveClass('bg-blue-600', 'text-white');

      // Other buttons should not be active
      const allButton = screen.getByTestId('filter-fee-all');
      expect(allButton).not.toHaveClass('bg-blue-600');
    });

    it('calls onEntryFeeChange when filter clicked', async () => {
      const onEntryFeeChange = vi.fn();
      render(<CompetitionFilters {...defaultProps} onEntryFeeChange={onEntryFeeChange} />);

      const under100Button = screen.getByTestId('filter-fee-under100');
      await userEvent.click(under100Button);

      expect(onEntryFeeChange).toHaveBeenCalledWith('under100');
    });

    it('renders all 5 entry fee options', () => {
      render(<CompetitionFilters {...defaultProps} />);

      expect(screen.getByTestId('filter-fee-all')).toBeInTheDocument();
      expect(screen.getByTestId('filter-fee-free')).toBeInTheDocument();
      expect(screen.getByTestId('filter-fee-under100')).toBeInTheDocument();
      expect(screen.getByTestId('filter-fee-range')).toBeInTheDocument();
      expect(screen.getByTestId('filter-fee-over500')).toBeInTheDocument();
    });
  });

  describe('Clear Button', () => {
    it('is disabled when no filters are active', () => {
      render(<CompetitionFilters {...defaultProps} />);

      const clearButton = screen.getByTestId('filter-clear');
      expect(clearButton).toBeDisabled();
    });

    it('is enabled when at least one filter is active', () => {
      render(<CompetitionFilters {...defaultProps} disciplineFilter="racing" />);

      const clearButton = screen.getByTestId('filter-clear');
      expect(clearButton).not.toBeDisabled();
    });

    it('calls onClearFilters when clicked', async () => {
      const onClearFilters = vi.fn();
      render(<CompetitionFilters
        {...defaultProps}
        disciplineFilter="racing"
        onClearFilters={onClearFilters}
      />);

      const clearButton = screen.getByTestId('filter-clear');
      await userEvent.click(clearButton);

      expect(onClearFilters).toHaveBeenCalled();
    });
  });

  describe('Responsive Design', () => {
    it('applies responsive grid classes', () => {
      render(<CompetitionFilters {...defaultProps} />);
      const container = screen.getByTestId('competition-filters');

      // Should have responsive grid layout
      const gridContainer = container.querySelector('.grid');
      expect(gridContainer).toHaveClass('md:grid-cols-4');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes for all controls', () => {
      render(<CompetitionFilters {...defaultProps} dateRangeFilter="week" />);

      // Select should have aria-label
      const select = screen.getByTestId('filter-discipline');
      expect(select).toHaveAttribute('aria-label', 'Filter by discipline');

      // Active buttons should have aria-pressed
      const weekButton = screen.getByTestId('filter-date-week');
      expect(weekButton).toHaveAttribute('aria-pressed', 'true');

      // Inactive buttons should have aria-pressed false
      const todayButton = screen.getByTestId('filter-date-today');
      expect(todayButton).toHaveAttribute('aria-pressed', 'false');

      // Clear button should have aria-label
      const clearButton = screen.getByTestId('filter-clear');
      expect(clearButton).toHaveAttribute('aria-label', 'Clear all filters');
    });

    it('supports keyboard navigation', async () => {
      render(<CompetitionFilters {...defaultProps} />);

      const select = screen.getByTestId('filter-discipline');
      const firstButton = screen.getByTestId('filter-date-all');

      // Tab to select
      select.focus();
      expect(document.activeElement).toBe(select);

      // Tab to button
      await userEvent.tab();
      expect(document.activeElement).toBe(firstButton);
    });
  });
});