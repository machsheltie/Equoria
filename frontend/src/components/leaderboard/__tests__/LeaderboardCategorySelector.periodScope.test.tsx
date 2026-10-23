/**
 * The Daily / Weekly / Monthly buttons appear only on boards that can honour
 * them (Equoria-5uptv).
 *
 * The page sent a period to every board and most handlers ignored it, so
 * pressing Weekly on the level board changed nothing: a false control. Only the
 * boards built from dated results (discipline wins, recent winners) filter by
 * period; level, prize money, owner totals, win percentage and wins are
 * lifetime counters with no time dimension.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import LeaderboardCategorySelector, {
  type LeaderboardCategory,
} from '../LeaderboardCategorySelector';

const renderSelector = (selectedCategory: LeaderboardCategory) =>
  render(
    <LeaderboardCategorySelector
      selectedCategory={selectedCategory}
      selectedPeriod="all-time"
      onCategoryChange={vi.fn()}
      onPeriodChange={vi.fn()}
      onDisciplineChange={vi.fn()}
    />
  );

describe('LeaderboardCategorySelector period scope (Equoria-5uptv)', () => {
  it.each(['level', 'prize-money', 'owner', 'win-rate', 'wins'] as const)(
    'offers no time period filter on the %s board',
    (category) => {
      renderSelector(category);

      expect(screen.queryByRole('group', { name: /time period filter/i })).not.toBeInTheDocument();
      expect(screen.queryByTestId('period-weekly')).not.toBeInTheDocument();
    }
  );

  it.each(['discipline', 'recent-winners'] as const)(
    'offers the time period filter on the %s board, whose rows are dated results',
    (category) => {
      renderSelector(category);

      expect(screen.getByRole('group', { name: /time period filter/i })).toBeInTheDocument();
      expect(screen.getByTestId('period-weekly')).toBeInTheDocument();
    }
  );
});
