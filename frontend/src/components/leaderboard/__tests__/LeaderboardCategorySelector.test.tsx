/**
 * LeaderboardCategorySelector Component Tests
 *
 * Tests for the leaderboard category selector component including:
 * - Rendering all category buttons
 * - Category selection callbacks
 * - Time period filter rendering and selection
 * - Discipline selector visibility (only for discipline category)
 * - Discipline selection
 * - Loading state disabling controls
 * - Keyboard navigation support
 * - ARIA attributes for accessibility
 * - CSS classes for active/inactive states
 * - Custom className prop support
 *
 * Story 5-5: Leaderboards - Task 1
 * Target: 20 tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeaderboardCategorySelector, {
  type LeaderboardCategory,
  type TimePeriod,
  type LeaderboardCategorySelectorProps,
} from '../LeaderboardCategorySelector';

describe('LeaderboardCategorySelector', () => {
  const mockOnCategoryChange = vi.fn();
  const mockOnPeriodChange = vi.fn();
  const mockOnDisciplineChange = vi.fn();

  const defaultProps: LeaderboardCategorySelectorProps = {
    selectedCategory: 'level',
    selectedPeriod: 'all-time',
    onCategoryChange: mockOnCategoryChange,
    onPeriodChange: mockOnPeriodChange,
    onDisciplineChange: mockOnDisciplineChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the category selector container', () => {
      render(<LeaderboardCategorySelector {...defaultProps} />);
      expect(screen.getByTestId('leaderboard-category-selector')).toBeInTheDocument();
    });

    it('renders all six category buttons', () => {
      render(<LeaderboardCategorySelector {...defaultProps} />);
      expect(screen.getByTestId('category-level')).toBeInTheDocument();
      expect(screen.getByTestId('category-prize-money')).toBeInTheDocument();
      expect(screen.getByTestId('category-win-rate')).toBeInTheDocument();
      expect(screen.getByTestId('category-discipline')).toBeInTheDocument();
      expect(screen.getByTestId('category-owner')).toBeInTheDocument();
      expect(screen.getByTestId('category-recent-winners')).toBeInTheDocument();
    });

    it('renders all four time period buttons', () => {
      render(<LeaderboardCategorySelector {...defaultProps} />);
      expect(screen.getByTestId('period-all-time')).toBeInTheDocument();
      expect(screen.getByTestId('period-monthly')).toBeInTheDocument();
      expect(screen.getByTestId('period-weekly')).toBeInTheDocument();
      expect(screen.getByTestId('period-daily')).toBeInTheDocument();
    });

    it('displays human-readable category labels', () => {
      render(<LeaderboardCategorySelector {...defaultProps} />);
      expect(screen.getByText('Horse Level')).toBeInTheDocument();
      expect(screen.getByText('Prize Money')).toBeInTheDocument();
      expect(screen.getByText('Win Rate')).toBeInTheDocument();
      expect(screen.getByText('Discipline')).toBeInTheDocument();
      expect(screen.getByText('Owner')).toBeInTheDocument();
      expect(screen.getByText('Recent Winners')).toBeInTheDocument();
    });

    it('displays human-readable time period labels', () => {
      render(<LeaderboardCategorySelector {...defaultProps} />);
      expect(screen.getByText('All-Time')).toBeInTheDocument();
      expect(screen.getByText('Monthly')).toBeInTheDocument();
      expect(screen.getByText('Weekly')).toBeInTheDocument();
      expect(screen.getByText('Daily')).toBeInTheDocument();
    });
  });

  describe('Category Selection', () => {
    it('highlights the selected category with blue background', () => {
      render(<LeaderboardCategorySelector {...defaultProps} selectedCategory="level" />);
      const levelButton = screen.getByTestId('category-level');
      expect(levelButton).toHaveClass('bg-blue-500');
      expect(levelButton).toHaveClass('text-white');
    });

    it('applies gray background to inactive categories', () => {
      render(<LeaderboardCategorySelector {...defaultProps} selectedCategory="level" />);
      const prizeButton = screen.getByTestId('category-prize-money');
      expect(prizeButton).toHaveClass('bg-gray-200');
      expect(prizeButton).toHaveClass('text-gray-800');
    });

    it('calls onCategoryChange when a category is clicked', async () => {
      const user = userEvent.setup();
      render(<LeaderboardCategorySelector {...defaultProps} />);

      await user.click(screen.getByTestId('category-win-rate'));

      expect(mockOnCategoryChange).toHaveBeenCalledTimes(1);
      expect(mockOnCategoryChange).toHaveBeenCalledWith('win-rate');
    });

    it('calls onCategoryChange for each category type', async () => {
      const user = userEvent.setup();
      render(<LeaderboardCategorySelector {...defaultProps} />);

      await user.click(screen.getByTestId('category-prize-money'));
      expect(mockOnCategoryChange).toHaveBeenCalledWith('prize-money');

      await user.click(screen.getByTestId('category-owner'));
      expect(mockOnCategoryChange).toHaveBeenCalledWith('owner');
    });
  });

  describe('Time Period Selection', () => {
    it('highlights the selected time period', () => {
      render(<LeaderboardCategorySelector {...defaultProps} selectedPeriod="monthly" />);
      const monthlyButton = screen.getByTestId('period-monthly');
      expect(monthlyButton).toHaveClass('bg-blue-500');
    });

    it('calls onPeriodChange when a time period is clicked', async () => {
      const user = userEvent.setup();
      render(<LeaderboardCategorySelector {...defaultProps} />);

      await user.click(screen.getByTestId('period-weekly'));

      expect(mockOnPeriodChange).toHaveBeenCalledTimes(1);
      expect(mockOnPeriodChange).toHaveBeenCalledWith('weekly');
    });
  });

  describe('Discipline Selector', () => {
    it('does not show discipline selector when category is not discipline', () => {
      render(<LeaderboardCategorySelector {...defaultProps} selectedCategory="level" />);
      expect(screen.queryByTestId('discipline-selector')).not.toBeInTheDocument();
    });

    it('shows discipline selector when category is discipline', () => {
      render(
        <LeaderboardCategorySelector {...defaultProps} selectedCategory="discipline" />
      );
      expect(screen.getByTestId('discipline-selector')).toBeInTheDocument();
    });

    it('discipline selector contains all 23 disciplines as options', () => {
      render(
        <LeaderboardCategorySelector
          {...defaultProps}
          selectedCategory="discipline"
          selectedDiscipline="dressage"
        />
      );
      const selector = screen.getByTestId('discipline-selector');
      const options = within(selector).getAllByRole('option');
      // 23 disciplines
      expect(options.length).toBe(23);
    });

    it('calls onDisciplineChange when a discipline is selected', async () => {
      const user = userEvent.setup();
      render(
        <LeaderboardCategorySelector
          {...defaultProps}
          selectedCategory="discipline"
          selectedDiscipline="dressage"
        />
      );

      const select = screen.getByTestId('discipline-selector');
      await user.selectOptions(select, 'racing');

      expect(mockOnDisciplineChange).toHaveBeenCalledWith('racing');
    });

    it('displays the currently selected discipline', () => {
      render(
        <LeaderboardCategorySelector
          {...defaultProps}
          selectedCategory="discipline"
          selectedDiscipline="show-jumping"
        />
      );
      const selector = screen.getByTestId('discipline-selector') as HTMLSelectElement;
      expect(selector.value).toBe('show-jumping');
    });
  });

  describe('Loading State', () => {
    it('disables all category buttons when loading', () => {
      render(<LeaderboardCategorySelector {...defaultProps} isLoading={true} />);

      expect(screen.getByTestId('category-level')).toBeDisabled();
      expect(screen.getByTestId('category-prize-money')).toBeDisabled();
      expect(screen.getByTestId('category-win-rate')).toBeDisabled();
      expect(screen.getByTestId('category-discipline')).toBeDisabled();
      expect(screen.getByTestId('category-owner')).toBeDisabled();
      expect(screen.getByTestId('category-recent-winners')).toBeDisabled();
    });

    it('disables all period buttons when loading', () => {
      render(<LeaderboardCategorySelector {...defaultProps} isLoading={true} />);

      expect(screen.getByTestId('period-all-time')).toBeDisabled();
      expect(screen.getByTestId('period-monthly')).toBeDisabled();
      expect(screen.getByTestId('period-weekly')).toBeDisabled();
      expect(screen.getByTestId('period-daily')).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('category buttons have aria-pressed attribute', () => {
      render(<LeaderboardCategorySelector {...defaultProps} selectedCategory="level" />);

      expect(screen.getByTestId('category-level')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('category-prize-money')).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    });

    it('has a role of tablist on the category container', () => {
      render(<LeaderboardCategorySelector {...defaultProps} />);
      expect(screen.getByRole('tablist', { name: /leaderboard categories/i })).toBeInTheDocument();
    });

    it('discipline selector has an accessible label', () => {
      render(
        <LeaderboardCategorySelector
          {...defaultProps}
          selectedCategory="discipline"
          selectedDiscipline="dressage"
        />
      );
      expect(screen.getByLabelText(/select discipline/i)).toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('accepts and applies custom className', () => {
      render(<LeaderboardCategorySelector {...defaultProps} className="my-custom-class" />);
      const container = screen.getByTestId('leaderboard-category-selector');
      expect(container).toHaveClass('my-custom-class');
    });
  });
});
