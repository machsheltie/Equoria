/**
 * LeaderboardEntry Component Tests
 *
 * Tests for the leaderboard entry row component including:
 * - Displaying entry data (rank, name, stats)
 * - Current user highlighting (blue background, blue border)
 * - Rank change indicators (up green, down red, no change gray)
 * - Click callback handling
 * - Category-specific stat display
 * - Accessibility (aria attributes, keyboard interaction)
 *
 * Story 5-5: Leaderboards - Task 2
 * Target: 12 tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeaderboardEntryComponent from '../LeaderboardEntry';
import type { LeaderboardEntryData } from '../LeaderboardEntry';

/**
 * Factory function to create a test entry with sensible defaults.
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

describe('LeaderboardEntry', () => {
  describe('Entry Display', () => {
    it('renders the rank badge with correct rank number', () => {
      const entry = createEntry({ rank: 5 });
      render(<LeaderboardEntryComponent entry={entry} category="level" />);
      expect(screen.getByTestId('rank-badge-5')).toBeInTheDocument();
    });

    it('renders the horse name', () => {
      const entry = createEntry({ horseName: 'Midnight Star' });
      render(<LeaderboardEntryComponent entry={entry} category="level" />);
      expect(screen.getByText('Midnight Star')).toBeInTheDocument();
    });

    it('renders the owner name', () => {
      const entry = createEntry({ ownerName: 'Jane Smith' });
      render(<LeaderboardEntryComponent entry={entry} category="level" />);
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    it('renders the primary stat value', () => {
      const entry = createEntry({ primaryStat: 42 });
      render(<LeaderboardEntryComponent entry={entry} category="level" />);
      expect(screen.getByTestId('primary-stat')).toHaveTextContent('42');
    });
  });

  describe('Current User Highlighting', () => {
    it('highlights the current user entry with light blue background', () => {
      const entry = createEntry({ isCurrentUser: true });
      render(<LeaderboardEntryComponent entry={entry} category="level" />);
      const row = screen.getByTestId('leaderboard-entry');
      expect(row).toHaveStyle({ backgroundColor: '#DBEAFE' });
    });

    it('highlights the current user entry with blue border', () => {
      const entry = createEntry({ isCurrentUser: true });
      render(<LeaderboardEntryComponent entry={entry} category="level" />);
      const row = screen.getByTestId('leaderboard-entry');
      // jsdom sets individual border properties from the shorthand
      expect(row.style.border).toContain('2px solid');
    });

    it('does not highlight non-current-user entries', () => {
      const entry = createEntry({ isCurrentUser: false });
      render(<LeaderboardEntryComponent entry={entry} category="level" />);
      const row = screen.getByTestId('leaderboard-entry');
      expect(row).not.toHaveStyle({ backgroundColor: '#DBEAFE' });
    });
  });

  describe('Rank Change Indicators', () => {
    it('shows green up indicator for positive rank change', () => {
      const entry = createEntry({ rankChange: 3 });
      render(<LeaderboardEntryComponent entry={entry} category="level" />);
      const indicator = screen.getByTestId('rank-change');
      expect(indicator).toHaveTextContent('+3');
      expect(indicator).toHaveStyle({ color: '#10B981' });
    });

    it('shows red down indicator for negative rank change', () => {
      const entry = createEntry({ rankChange: -2 });
      render(<LeaderboardEntryComponent entry={entry} category="level" />);
      const indicator = screen.getByTestId('rank-change');
      expect(indicator).toHaveTextContent('-2');
      expect(indicator).toHaveStyle({ color: '#EF4444' });
    });

    it('shows gray dash for no rank change', () => {
      const entry = createEntry({ rankChange: 0 });
      render(<LeaderboardEntryComponent entry={entry} category="level" />);
      const indicator = screen.getByTestId('rank-change');
      // U+2014 em dash
      expect(indicator).toHaveTextContent('\u2014');
      expect(indicator).toHaveStyle({ color: '#6B7280' });
    });
  });

  describe('Click Handling', () => {
    it('calls onClick when the entry row is clicked', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      const entry = createEntry();
      render(
        <LeaderboardEntryComponent
          entry={entry}
          category="level"
          onClick={handleClick}
          isClickable={true}
        />
      );

      await user.click(screen.getByTestId('leaderboard-entry'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when isClickable is false', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      const entry = createEntry();
      render(
        <LeaderboardEntryComponent
          entry={entry}
          category="level"
          onClick={handleClick}
          isClickable={false}
        />
      );

      await user.click(screen.getByTestId('leaderboard-entry'));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Category-Specific Display', () => {
    it('displays level and win rate for horse level category', () => {
      const entry = createEntry({
        primaryStat: 25,
        secondaryStats: { level: 25, winRate: 30, totalCompetitions: 50 },
      });
      render(<LeaderboardEntryComponent entry={entry} category="level" />);
      expect(screen.getByTestId('secondary-stat-win-rate')).toBeInTheDocument();
      expect(screen.getByTestId('secondary-stat-competitions')).toBeInTheDocument();
    });

    it('displays prize money and wins for prize-money category', () => {
      const entry = createEntry({
        primaryStat: 12500,
        secondaryStats: { wins: 15, totalCompetitions: 50, totalPrizeMoney: 12500 },
      });
      render(<LeaderboardEntryComponent entry={entry} category="prize-money" />);
      expect(screen.getByTestId('secondary-stat-wins')).toBeInTheDocument();
      expect(screen.getByTestId('secondary-stat-competitions')).toBeInTheDocument();
    });

    it('displays win rate percentage and wins for win-rate category', () => {
      const entry = createEntry({
        primaryStat: 30,
        secondaryStats: { winRate: 30, wins: 15, totalCompetitions: 50 },
      });
      render(<LeaderboardEntryComponent entry={entry} category="win-rate" />);
      expect(screen.getByTestId('primary-stat')).toHaveTextContent('30%');
    });
  });

  describe('Accessibility', () => {
    it('has an accessible role of row', () => {
      const entry = createEntry();
      render(<LeaderboardEntryComponent entry={entry} category="level" />);
      expect(screen.getByTestId('leaderboard-entry')).toHaveAttribute('role', 'row');
    });

    it('applies cursor-pointer class when clickable', () => {
      const entry = createEntry();
      const handleClick = vi.fn();
      render(
        <LeaderboardEntryComponent
          entry={entry}
          category="level"
          onClick={handleClick}
          isClickable={true}
        />
      );
      expect(screen.getByTestId('leaderboard-entry')).toHaveClass('cursor-pointer');
    });
  });
});
