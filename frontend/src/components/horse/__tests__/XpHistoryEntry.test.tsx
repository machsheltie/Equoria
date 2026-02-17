/**
 * XpHistoryEntry Component Tests
 *
 * Comprehensive tests for the individual XP history timeline entry component.
 * Tests cover:
 * - Rendering with XP gain data
 * - Date and time display formatting
 * - Source type badge (competition, training, achievement, bonus)
 * - Source name display
 * - XP amount with "+" prefix
 * - Level achieved display
 * - Level-up highlighting (gold background, trophy icon)
 * - Level transition display (oldLevel -> newLevel)
 * - Timeline connector rendering
 * - First/last entry markers
 * - Accessibility compliance
 *
 * Story 5-4: XP History Timeline - Task 5
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import XpHistoryEntry from '../XpHistoryEntry';
import type { XpGain } from '../XpHistoryEntry';

describe('XpHistoryEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Sample XP gain entry for standard (non-level-up) test cases
  const standardEntry: XpGain = {
    xpGainId: 'xp-001',
    horseId: 101,
    horseName: 'Thunder Bolt',
    source: 'competition',
    sourceId: 1,
    sourceName: 'Spring Derby Championship',
    xpAmount: 150,
    timestamp: '2026-01-25T15:30:00Z',
    oldLevel: 4,
    newLevel: 4,
    oldXp: 350,
    newXp: 500,
    leveledUp: false,
  };

  // Sample XP gain entry for level-up test cases
  const levelUpEntry: XpGain = {
    xpGainId: 'xp-002',
    horseId: 101,
    horseName: 'Thunder Bolt',
    source: 'training',
    sourceId: 2,
    sourceName: 'Advanced Dressage Training',
    xpAmount: 200,
    timestamp: '2026-01-20T10:00:00Z',
    oldLevel: 4,
    newLevel: 5,
    oldXp: 900,
    newXp: 100,
    leveledUp: true,
  };

  // Sample entries for each source type
  const achievementEntry: XpGain = {
    xpGainId: 'xp-003',
    horseId: 102,
    horseName: 'Lightning Flash',
    source: 'achievement',
    sourceId: 3,
    sourceName: 'First Place Streak',
    xpAmount: 300,
    timestamp: '2026-01-18T08:00:00Z',
    oldLevel: 7,
    newLevel: 7,
    oldXp: 200,
    newXp: 500,
    leveledUp: false,
  };

  const bonusEntry: XpGain = {
    xpGainId: 'xp-004',
    horseId: 103,
    horseName: 'Storm Chaser',
    source: 'bonus',
    sourceId: 4,
    sourceName: 'Weekly Login Bonus',
    xpAmount: 50,
    timestamp: '2026-01-15T12:00:00Z',
    oldLevel: 2,
    newLevel: 2,
    oldXp: 100,
    newXp: 150,
    leveledUp: false,
  };

  // =========================================================================
  // 1. Basic Rendering Tests
  // =========================================================================
  describe('Basic Rendering', () => {
    it('should render the entry container with correct test id', () => {
      render(<XpHistoryEntry entry={standardEntry} isLevelUp={false} />);

      const entryElement = screen.getByTestId('xp-history-entry');
      expect(entryElement).toBeInTheDocument();
    });

    it('should display the source name', () => {
      render(<XpHistoryEntry entry={standardEntry} isLevelUp={false} />);

      expect(screen.getByText('Spring Derby Championship')).toBeInTheDocument();
    });

    it('should display the XP amount with "+" prefix', () => {
      render(<XpHistoryEntry entry={standardEntry} isLevelUp={false} />);

      expect(screen.getByTestId('xp-amount')).toHaveTextContent('+150');
    });
  });

  // =========================================================================
  // 2. Date and Time Display Tests
  // =========================================================================
  describe('Date and Time Display', () => {
    it('should display formatted date and time', () => {
      render(<XpHistoryEntry entry={standardEntry} isLevelUp={false} />);

      const dateElement = screen.getByTestId('entry-date');
      expect(dateElement).toBeInTheDocument();
      // The date should contain at least some parts of the formatted date
      // Jan 25, 2026 at some time representation
      expect(dateElement.textContent).toMatch(/Jan/);
      expect(dateElement.textContent).toMatch(/25/);
      expect(dateElement.textContent).toMatch(/2026/);
    });
  });

  // =========================================================================
  // 3. Source Type Badge Tests
  // =========================================================================
  describe('Source Type Badge', () => {
    it('should display competition badge with blue styling', () => {
      render(<XpHistoryEntry entry={standardEntry} isLevelUp={false} />);

      const badge = screen.getByTestId('source-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(/competition/i);
      expect(badge).toHaveClass('bg-blue-100');
      expect(badge).toHaveClass('text-blue-700');
    });

    it('should display training badge with green styling', () => {
      render(<XpHistoryEntry entry={levelUpEntry} isLevelUp={true} />);

      const badge = screen.getByTestId('source-badge');
      expect(badge).toHaveTextContent(/training/i);
      expect(badge).toHaveClass('bg-green-100');
      expect(badge).toHaveClass('text-green-700');
    });

    it('should display achievement badge with purple styling', () => {
      render(<XpHistoryEntry entry={achievementEntry} isLevelUp={false} />);

      const badge = screen.getByTestId('source-badge');
      expect(badge).toHaveTextContent(/achievement/i);
      expect(badge).toHaveClass('bg-purple-100');
      expect(badge).toHaveClass('text-purple-700');
    });

    it('should display bonus badge with orange styling', () => {
      render(<XpHistoryEntry entry={bonusEntry} isLevelUp={false} />);

      const badge = screen.getByTestId('source-badge');
      expect(badge).toHaveTextContent(/bonus/i);
      expect(badge).toHaveClass('bg-orange-100');
      expect(badge).toHaveClass('text-orange-700');
    });
  });

  // =========================================================================
  // 4. Level Display Tests
  // =========================================================================
  describe('Level Display', () => {
    it('should display the current level for non-level-up entries', () => {
      render(<XpHistoryEntry entry={standardEntry} isLevelUp={false} />);

      const levelDisplay = screen.getByTestId('level-display');
      expect(levelDisplay).toBeInTheDocument();
      expect(levelDisplay).toHaveTextContent('Level 4');
    });

    it('should display level transition for level-up entries', () => {
      render(<XpHistoryEntry entry={levelUpEntry} isLevelUp={true} />);

      const levelTransition = screen.getByTestId('level-transition');
      expect(levelTransition).toBeInTheDocument();
      // Should show "Level 4 -> 5" or similar transition format
      expect(levelTransition.textContent).toMatch(/4/);
      expect(levelTransition.textContent).toMatch(/5/);
    });
  });

  // =========================================================================
  // 5. Level-Up Highlighting Tests
  // =========================================================================
  describe('Level-Up Highlighting', () => {
    it('should apply gold/yellow background for level-up entries', () => {
      render(<XpHistoryEntry entry={levelUpEntry} isLevelUp={true} />);

      const entryCard = screen.getByTestId('entry-card');
      expect(entryCard).toHaveClass('bg-yellow-50');
      expect(entryCard).toHaveClass('border-yellow-300');
    });

    it('should display trophy icon for level-up entries', () => {
      render(<XpHistoryEntry entry={levelUpEntry} isLevelUp={true} />);

      const trophyIcon = screen.getByTestId('level-up-icon');
      expect(trophyIcon).toBeInTheDocument();
    });

    it('should NOT apply gold background for non-level-up entries', () => {
      render(<XpHistoryEntry entry={standardEntry} isLevelUp={false} />);

      const entryCard = screen.getByTestId('entry-card');
      expect(entryCard).not.toHaveClass('bg-yellow-50');
      expect(entryCard).not.toHaveClass('border-yellow-300');
    });
  });

  // =========================================================================
  // 6. Timeline Connector Tests
  // =========================================================================
  describe('Timeline Connector', () => {
    it('should render timeline connector line by default', () => {
      render(<XpHistoryEntry entry={standardEntry} isLevelUp={false} />);

      const connector = screen.getByTestId('timeline-connector');
      expect(connector).toBeInTheDocument();
    });

    it('should render timeline dot marker', () => {
      render(<XpHistoryEntry entry={standardEntry} isLevelUp={false} />);

      const dot = screen.getByTestId('timeline-dot');
      expect(dot).toBeInTheDocument();
    });

    it('should hide connector line for first entry when isFirst is true', () => {
      render(<XpHistoryEntry entry={standardEntry} isLevelUp={false} isFirst={true} />);

      expect(screen.queryByTestId('timeline-connector-top')).not.toBeInTheDocument();
    });

    it('should hide bottom connector for last entry when isLast is true', () => {
      render(<XpHistoryEntry entry={standardEntry} isLevelUp={false} isLast={true} />);

      expect(screen.queryByTestId('timeline-connector-bottom')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // 7. Accessibility Tests
  // =========================================================================
  describe('Accessibility', () => {
    it('should have accessible article role for each entry', () => {
      render(<XpHistoryEntry entry={standardEntry} isLevelUp={false} />);

      const article = screen.getByRole('article');
      expect(article).toBeInTheDocument();
    });

    it('should have aria-label describing the XP gain', () => {
      render(<XpHistoryEntry entry={standardEntry} isLevelUp={false} />);

      const article = screen.getByRole('article');
      expect(article).toHaveAttribute('aria-label');
      const ariaLabel = article.getAttribute('aria-label') || '';
      expect(ariaLabel).toContain('150');
      expect(ariaLabel).toContain('competition');
    });
  });
});
