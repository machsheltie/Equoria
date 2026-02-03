/**
 * LeaderboardHorseDetailModal Component Tests
 *
 * Tests for the horse detail modal displayed from leaderboard entries.
 * Covers modal open/close mechanics, content sections (header, stats,
 * competition history, achievements, owner info), loading/error states,
 * and accessibility requirements.
 *
 * Story 5-5: Leaderboards - Task 4
 * Target: 20 tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeaderboardHorseDetailModal from '../LeaderboardHorseDetailModal';
import type { HorseDetailData } from '../LeaderboardHorseDetailModal';

/**
 * Mock horse detail data for testing all content sections.
 */
const mockHorseData: HorseDetailData = {
  horseId: 123,
  horseName: 'Thunder Strike',
  breed: 'Thoroughbred',
  age: 5,
  sex: 'Stallion',
  level: 12,
  stats: {
    speed: 85,
    stamina: 72,
    agility: 68,
    balance: 75,
    precision: 80,
    intelligence: 65,
    boldness: 90,
    flexibility: 70,
    obedience: 55,
    focus: 78,
  },
  competitionHistory: {
    total: 48,
    wins: 12,
    top3Finishes: 24,
    winRate: 25,
    totalPrizeMoney: 145680,
    recentCompetitions: [
      {
        competitionId: 1,
        competitionName: 'Grand Prix Championship',
        discipline: 'Show Jumping',
        date: '2026-02-01',
        rank: 1,
        totalParticipants: 25,
        prizeWon: 5000,
      },
      {
        competitionId: 2,
        competitionName: 'Spring Dressage Open',
        discipline: 'Dressage',
        date: '2026-01-28',
        rank: 3,
        totalParticipants: 18,
        prizeWon: 2000,
      },
      {
        competitionId: 3,
        competitionName: 'Winter Cross Country',
        discipline: 'Cross Country',
        date: '2026-01-20',
        rank: 5,
        totalParticipants: 30,
        prizeWon: 500,
      },
    ],
  },
  owner: {
    ownerId: 'user-456',
    ownerName: 'Jane Smith',
    stableSize: 8,
  },
  achievements: ['Top 10 in Show Jumping', 'Won 10+ Competitions', 'Level 10 Master'],
  primaryDiscipline: 'Show Jumping',
};

/**
 * Default props used across tests.
 */
const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  horseData: mockHorseData,
};

describe('LeaderboardHorseDetailModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Ensure body overflow is restored after each test
    document.body.style.overflow = '';
  });

  // =========================================================================
  // Modal Open/Close States (7 tests)
  // =========================================================================
  describe('Modal Open/Close States', () => {
    it('renders the modal when isOpen is true', () => {
      render(<LeaderboardHorseDetailModal {...defaultProps} />);
      expect(screen.getByTestId('horse-detail-modal')).toBeInTheDocument();
    });

    it('does not render the modal when isOpen is false', () => {
      render(<LeaderboardHorseDetailModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByTestId('horse-detail-modal')).not.toBeInTheDocument();
    });

    it('fires onClose when the close button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<LeaderboardHorseDetailModal {...defaultProps} onClose={onClose} />);

      await user.click(screen.getByTestId('modal-close-button'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('fires onClose when the Escape key is pressed', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<LeaderboardHorseDetailModal {...defaultProps} onClose={onClose} />);

      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('fires onClose when the backdrop is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<LeaderboardHorseDetailModal {...defaultProps} onClose={onClose} />);

      await user.click(screen.getByTestId('modal-backdrop'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('applies body scroll lock when modal is open', () => {
      render(<LeaderboardHorseDetailModal {...defaultProps} />);
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('has aria-modal attribute set to true', () => {
      render(<LeaderboardHorseDetailModal {...defaultProps} />);
      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
    });
  });

  // =========================================================================
  // Content Display (8 tests)
  // =========================================================================
  describe('Content Display', () => {
    it('displays horse name, breed, age, and sex in the header', () => {
      render(<LeaderboardHorseDetailModal {...defaultProps} />);
      expect(screen.getByText('Thunder Strike')).toBeInTheDocument();
      expect(screen.getByText(/Thoroughbred/)).toBeInTheDocument();
      expect(screen.getByText(/5 years old/)).toBeInTheDocument();
      expect(screen.getByText(/Stallion/)).toBeInTheDocument();
    });

    it('displays all 10 stats with progress bars', () => {
      render(<LeaderboardHorseDetailModal {...defaultProps} />);
      const statsSection = screen.getByTestId('stats-section');

      expect(within(statsSection).getByText(/speed/i)).toBeInTheDocument();
      expect(within(statsSection).getByText(/stamina/i)).toBeInTheDocument();
      expect(within(statsSection).getByText(/agility/i)).toBeInTheDocument();
      expect(within(statsSection).getByText(/balance/i)).toBeInTheDocument();
      expect(within(statsSection).getByText(/precision/i)).toBeInTheDocument();
      expect(within(statsSection).getByText(/intelligence/i)).toBeInTheDocument();
      expect(within(statsSection).getByText(/boldness/i)).toBeInTheDocument();
      expect(within(statsSection).getByText(/flexibility/i)).toBeInTheDocument();
      expect(within(statsSection).getByText(/obedience/i)).toBeInTheDocument();
      expect(within(statsSection).getByText(/focus/i)).toBeInTheDocument();

      // Verify progress bars exist for each stat
      const progressBars = within(statsSection).getAllByTestId('stat-progress-bar');
      expect(progressBars).toHaveLength(10);
    });

    it('displays competition history summary with total, wins, top 3, and win rate', () => {
      render(<LeaderboardHorseDetailModal {...defaultProps} />);
      const historySection = screen.getByTestId('competition-history-section');

      expect(within(historySection).getByText('48')).toBeInTheDocument();
      expect(within(historySection).getByText('12')).toBeInTheDocument();
      expect(within(historySection).getByText('24')).toBeInTheDocument();
      expect(within(historySection).getByText('25%')).toBeInTheDocument();
    });

    it('displays recent competitions table with correct columns', () => {
      render(<LeaderboardHorseDetailModal {...defaultProps} />);
      const table = screen.getByTestId('recent-competitions-table');

      // Verify column headers exist
      expect(within(table).getByText('Date')).toBeInTheDocument();
      expect(within(table).getByText('Competition')).toBeInTheDocument();
      expect(within(table).getByText('Discipline')).toBeInTheDocument();
      expect(within(table).getByText('Rank')).toBeInTheDocument();
      expect(within(table).getByText('Prize')).toBeInTheDocument();

      // Verify rows rendered
      expect(within(table).getByText('Grand Prix Championship')).toBeInTheDocument();
      expect(within(table).getByText('Spring Dressage Open')).toBeInTheDocument();
    });

    it('displays achievements list or shows empty state', () => {
      render(<LeaderboardHorseDetailModal {...defaultProps} />);
      const achievementsSection = screen.getByTestId('achievements-section');

      expect(within(achievementsSection).getByText('Top 10 in Show Jumping')).toBeInTheDocument();
      expect(within(achievementsSection).getByText('Won 10+ Competitions')).toBeInTheDocument();
      expect(within(achievementsSection).getByText('Level 10 Master')).toBeInTheDocument();
    });

    it('displays owner name', () => {
      render(<LeaderboardHorseDetailModal {...defaultProps} />);
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    it('fires onViewFullProfile callback when "View Full Profile" button is clicked', async () => {
      const user = userEvent.setup();
      const onViewFullProfile = vi.fn();
      render(
        <LeaderboardHorseDetailModal
          {...defaultProps}
          onViewFullProfile={onViewFullProfile}
        />
      );

      await user.click(screen.getByTestId('view-full-profile-button'));
      expect(onViewFullProfile).toHaveBeenCalledWith(123);
    });

    it('displays the level badge', () => {
      render(<LeaderboardHorseDetailModal {...defaultProps} />);
      expect(screen.getByTestId('level-badge')).toBeInTheDocument();
      expect(screen.getByTestId('level-badge')).toHaveTextContent('12');
    });
  });

  // =========================================================================
  // Loading and Error States (3 tests)
  // =========================================================================
  describe('Loading and Error States', () => {
    it('shows skeleton placeholders when isLoading is true', () => {
      render(
        <LeaderboardHorseDetailModal
          isOpen={true}
          onClose={vi.fn()}
          horseData={null}
          isLoading={true}
        />
      );
      const skeletons = screen.getAllByTestId('skeleton-block');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows error message when horseData is null and not loading', () => {
      render(
        <LeaderboardHorseDetailModal
          isOpen={true}
          onClose={vi.fn()}
          horseData={null}
          isLoading={false}
        />
      );
      expect(screen.getByTestId('empty-horse-state')).toBeInTheDocument();
      expect(screen.getByText(/horse details not available/i)).toBeInTheDocument();
    });

    it('shows placeholder when recent competitions list is empty', () => {
      const horseWithNoComps: HorseDetailData = {
        ...mockHorseData,
        competitionHistory: {
          ...mockHorseData.competitionHistory,
          recentCompetitions: [],
        },
      };
      render(
        <LeaderboardHorseDetailModal
          {...defaultProps}
          horseData={horseWithNoComps}
        />
      );
      expect(screen.getByTestId('no-recent-competitions')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Accessibility (2 tests)
  // =========================================================================
  describe('Accessibility', () => {
    it('modal has dialog role and aria-modal attribute', () => {
      render(<LeaderboardHorseDetailModal {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'horse-detail-title');
    });

    it('close button has accessible aria-label', () => {
      render(<LeaderboardHorseDetailModal {...defaultProps} />);
      const closeButton = screen.getByTestId('modal-close-button');
      expect(closeButton).toHaveAttribute('aria-label', 'Close horse details');
    });
  });
});
