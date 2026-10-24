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
 * Story 5-5: Leaderboards - Task 1. Equoria-y3nia: nine boards (owner rulings
 * q10, q11, q40), each with an Overall and a Monthly period.
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
    selectedCategory: 'player-xp',
    selectedPeriod: 'overall',
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

    it('renders all nine board tabs', () => {
      render(<LeaderboardCategorySelector {...defaultProps} />);
      for (const category of [
        'player-xp',
        'player-earnings',
        'player-wins',
        'player-win-rate',
        'horse-points',
        'horse-earnings',
        'horse-wins',
        'horse-win-rate',
        'discipline',
      ]) {
        expect(screen.getByTestId(`category-${category}`)).toBeInTheDocument();
      }
    });

    // Every board has an Overall and a Monthly reading, so the buttons always filter.
    it.each(['player-xp', 'horse-points', 'horse-win-rate', 'discipline'] as const)(
      'offers Overall and Monthly, and no other period, on the %s board',
      (category) => {
        render(<LeaderboardCategorySelector {...defaultProps} selectedCategory={category} />);
        expect(screen.getByRole('group', { name: /time period filter/i })).toBeInTheDocument();
        expect(screen.getByTestId('period-overall')).toBeInTheDocument();
        expect(screen.getByTestId('period-monthly')).toBeInTheDocument();
        expect(screen.queryByTestId('period-weekly')).not.toBeInTheDocument();
        expect(screen.queryByTestId('period-daily')).not.toBeInTheDocument();
      }
    );

    it('displays human-readable board labels', () => {
      render(<LeaderboardCategorySelector {...defaultProps} />);
      for (const label of [
        'Player XP',
        'Player Earnings',
        'Player Wins',
        'Player Win %',
        'Horse Points',
        'Horse Earnings',
        'Horse Wins',
        'Horse Win %',
        'By Discipline',
      ]) {
        expect(screen.getByText(label)).toBeInTheDocument();
      }
    });

    it('displays human-readable time period labels', () => {
      render(<LeaderboardCategorySelector {...defaultProps} />);
      expect(screen.getByText('Overall')).toBeInTheDocument();
      expect(screen.getByText('Monthly')).toBeInTheDocument();
    });
  });

  describe('Category Selection', () => {
    it('marks the selected category tab as active', () => {
      // CanonicalTabs (Equoria-o5hub.11): active styling (gold underline) is
      // driven by Radix's data-state attribute; assert the state, not palette
      // classes, so the test survives token changes while still proving the
      // selected tab is visually/semantically distinguished.
      render(<LeaderboardCategorySelector {...defaultProps} selectedCategory="player-xp" />);
      const levelButton = screen.getByTestId('category-player-xp');
      expect(levelButton).toHaveAttribute('data-state', 'active');
      expect(levelButton).toHaveAttribute('aria-selected', 'true');
    });

    it('marks non-selected category tabs as inactive', () => {
      render(<LeaderboardCategorySelector {...defaultProps} selectedCategory="player-xp" />);
      const prizeButton = screen.getByTestId('category-player-earnings');
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
        const [category, setCategory] = useState<LeaderboardCategory>('player-xp');
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

      await user.click(screen.getByTestId('category-horse-win-rate'));

      expect(mockOnCategoryChange).toHaveBeenCalledTimes(1);
      expect(mockOnCategoryChange).toHaveBeenCalledWith('horse-win-rate');
    });

    it('calls onCategoryChange for each category type', async () => {
      const user = userEvent.setup();
      render(<LeaderboardCategorySelector {...defaultProps} />);

      await user.click(screen.getByTestId('category-player-earnings'));
      expect(mockOnCategoryChange).toHaveBeenCalledWith('player-earnings');

      await user.click(screen.getByTestId('category-horse-points'));
      expect(mockOnCategoryChange).toHaveBeenCalledWith('horse-points');
    });
  });

  describe('Time Period Selection', () => {
    it('highlights the selected time period', () => {
      render(<LeaderboardCategorySelector {...defaultProps} selectedPeriod="monthly" />);
      const monthlyButton = screen.getByTestId('period-monthly');
      expect(monthlyButton).toHaveClass('bg-[var(--status-info)]');
    });

    it('calls onPeriodChange when a time period is clicked', async () => {
      const user = userEvent.setup();
      render(<LeaderboardCategorySelector {...defaultProps} />);

      await user.click(screen.getByTestId('period-monthly'));

      expect(mockOnPeriodChange).toHaveBeenCalledTimes(1);
      expect(mockOnPeriodChange).toHaveBeenCalledWith('monthly');
    });
  });

  describe('Discipline Selector', () => {
    it('does not show discipline selector when category is not discipline', () => {
      render(<LeaderboardCategorySelector {...defaultProps} selectedCategory="player-xp" />);
      expect(screen.queryByTestId('discipline-selector')).not.toBeInTheDocument();
    });

    it('shows discipline selector when category is discipline', () => {
      render(<LeaderboardCategorySelector {...defaultProps} selectedCategory="discipline" />);
      expect(screen.getByTestId('discipline-selector')).toBeInTheDocument();
    });

    it('discipline selector contains all 24 disciplines as options', () => {
      render(
        <LeaderboardCategorySelector
          {...defaultProps}
          selectedCategory="discipline"
          selectedDiscipline="dressage"
        />
      );
      const selector = screen.getByTestId('discipline-selector');
      const options = within(selector).getAllByRole('option');
      // Owner ruling 2026-10-21: Pleasure Driving is the 24th discipline. Old contract: 23.
      expect(options.length).toBe(24);
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

      expect(screen.getByTestId('category-player-xp')).toBeDisabled();
      expect(screen.getByTestId('category-player-earnings')).toBeDisabled();
      expect(screen.getByTestId('category-horse-win-rate')).toBeDisabled();
      expect(screen.getByTestId('category-discipline')).toBeDisabled();
      expect(screen.getByTestId('category-horse-points')).toBeDisabled();
    });

    it('disables all period buttons when loading', () => {
      render(<LeaderboardCategorySelector {...defaultProps} isLoading={true} />);

      expect(screen.getByTestId('period-overall')).toBeDisabled();
      expect(screen.getByTestId('period-monthly')).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('category buttons expose tab selection state via aria-selected', () => {
      // Categories are tabs (role="tab"), so they use aria-selected, not aria-pressed
      render(<LeaderboardCategorySelector {...defaultProps} selectedCategory="player-xp" />);

      expect(screen.getByTestId('category-player-xp')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('category-player-earnings')).toHaveAttribute(
        'aria-selected',
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
