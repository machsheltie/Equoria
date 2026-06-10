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

import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeaderboardCategorySelector, {
  type LeaderboardCategory,
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
    it('marks the selected category tab as active', () => {
      // CanonicalTabs (Equoria-o5hub.11): active styling (gold underline) is
      // driven by Radix's data-state attribute; assert the state, not palette
      // classes, so the test survives token changes while still proving the
      // selected tab is visually/semantically distinguished.
      render(<LeaderboardCategorySelector {...defaultProps} selectedCategory="level" />);
      const levelButton = screen.getByTestId('category-level');
      expect(levelButton).toHaveAttribute('data-state', 'active');
      expect(levelButton).toHaveAttribute('aria-selected', 'true');
    });

    it('marks non-selected category tabs as inactive', () => {
      render(<LeaderboardCategorySelector {...defaultProps} selectedCategory="level" />);
      const prizeButton = screen.getByTestId('category-prize-money');
      expect(prizeButton).toHaveAttribute('data-state', 'inactive');
      expect(prizeButton).toHaveAttribute('aria-selected', 'false');
    });

    it('calls onCategoryChange when a category is clicked', async () => {
      const user = userEvent.setup();
      // Stateful harness mirrors real LeaderboardsPage usage: the controlled
      // selectedCategory updates on change. (With a frozen controlled value,
      // Radix fires onValueChange on both mousedown and focus-activation —
      // an artifact of the never-updating mock, not of real usage.)
      const Harness = () => {
        const [category, setCategory] = useState<LeaderboardCategory>('level');
        return (
          <LeaderboardCategorySelector
            {...defaultProps}
            selectedCategory={category}
            onCategoryChange={(c) => {
              mockOnCategoryChange(c);
              setCategory(c);
            }}
          />
        );
      };
      render(<Harness />);

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
      render(<LeaderboardCategorySelector {...defaultProps} selectedCategory="discipline" />);
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
    it('category buttons expose tab selection state via aria-selected', () => {
      // Categories are tabs (role="tab"), so they use aria-selected, not aria-pressed
      render(<LeaderboardCategorySelector {...defaultProps} selectedCategory="level" />);

      expect(screen.getByTestId('category-level')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('category-prize-money')).toHaveAttribute('aria-selected', 'false');
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
