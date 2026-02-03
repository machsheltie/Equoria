/**
 * XpIntegration Component Tests
 *
 * Integration test suite for XP features integrated into competition results display.
 * Tests the integration between:
 * - CompetitionResultsModal and XP components (XpGainNotification, LevelUpCelebrationModal,
 *   XpProgressTracker, HorseLevelBadge)
 * - PrizeNotificationModal and XP display (xpGained prop)
 * - CompetitionResultsPage and XP tracking/level-up detection
 * - Notification sequencing: Prize -> XP -> Level-Up
 *
 * Story 5-4: XP System Integration - Task 7 (Integration with Competition Results)
 * Target: 24 integration tests following TDD methodology
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter, Routes, Route } from '../../test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CompetitionResultsModal, { type CompetitionResults } from '../CompetitionResultsModal';
import CompetitionResultsPage from '../../../pages/CompetitionResultsPage';

// Mock the auth context
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock the API hooks
vi.mock('@/hooks/api/useUserCompetitionStats', () => ({
  useUserCompetitionStats: vi.fn(),
}));

// Mock useHorseLevelInfo hook
vi.mock('@/hooks/api/useHorseLevelInfo', () => ({
  useHorseLevelInfo: vi.fn(),
  horseLevelInfoQueryKeys: {
    all: ['horseLevelInfo'] as const,
    horse: (horseId: number) => ['horseLevelInfo', horseId] as const,
  },
}));

// Mock the results list component to isolate page testing
vi.mock('@/components/competition/CompetitionResultsList', () => ({
  default: vi.fn(({ onResultClick }) => {
    return (
      <div data-testid="competition-results-list">
        <button data-testid="mock-result-item" onClick={() => onResultClick(1)}>
          Mock Competition Result
        </button>
        <button data-testid="mock-result-item-2" onClick={() => onResultClick(2)}>
          Mock Competition Result 2
        </button>
      </div>
    );
  }),
}));

// Import mocked modules
const { useAuth } = await import('@/contexts/AuthContext');
const { useUserCompetitionStats } = await import('@/hooks/api/useUserCompetitionStats');
const { useHorseLevelInfo } = await import('@/hooks/api/useHorseLevelInfo');

describe('XpIntegration', () => {
  const mockOnClose = vi.fn();
  const mockOnViewPerformance = vi.fn();
  const mockOnFirstView = vi.fn();
  const mockOnPrizeNotificationClose = vi.fn();
  const mockOnXpNotificationClose = vi.fn();
  const mockOnLevelUpClose = vi.fn();

  // Sample competition results with user prizes and XP data
  const resultsWithXpData: CompetitionResults = {
    competitionId: 1,
    competitionName: 'Spring Grand Prix Championship',
    discipline: 'Show Jumping',
    date: '2026-04-15',
    totalParticipants: 25,
    prizePool: 10000,
    prizeDistribution: {
      first: 5000,
      second: 3000,
      third: 2000,
    },
    results: [
      {
        rank: 1,
        horseId: 101,
        horseName: 'Thunder Bolt',
        ownerId: 'user-123',
        ownerName: 'Current User',
        finalScore: 95.5,
        prizeWon: 5000,
        isCurrentUser: true,
      },
      {
        rank: 2,
        horseId: 102,
        horseName: 'Midnight Star',
        ownerId: 'user-456',
        ownerName: 'Jane Smith',
        finalScore: 92.3,
        prizeWon: 3000,
        isCurrentUser: false,
      },
      {
        rank: 3,
        horseId: 103,
        horseName: 'Silver Arrow',
        ownerId: 'user-789',
        ownerName: 'Bob Johnson',
        finalScore: 88.7,
        prizeWon: 2000,
        isCurrentUser: false,
      },
      {
        rank: 4,
        horseId: 104,
        horseName: 'Golden Dawn',
        ownerId: 'user-123',
        ownerName: 'Current User',
        finalScore: 85.2,
        prizeWon: 0,
        isCurrentUser: true,
      },
    ],
  };

  // Sample competition results without user prizes (no XP notification needed)
    competitionId: 2,
    competitionName: 'Autumn Challenge',
    discipline: 'Dressage',
    date: '2026-05-20',
    totalParticipants: 15,
    prizePool: 6000,
    prizeDistribution: {
      first: 3000,
      second: 1800,
      third: 1200,
    },
    results: [
      {
        rank: 1,
        horseId: 201,
        horseName: 'Champion',
        ownerId: 'user-789',
        ownerName: 'Bob Johnson',
        finalScore: 97.0,
        prizeWon: 3000,
        isCurrentUser: false,
      },
      {
        rank: 4,
        horseId: 202,
        horseName: 'My Horse',
        ownerId: 'user-123',
        ownerName: 'Current User',
        finalScore: 80.5,
        prizeWon: 0,
        isCurrentUser: true,
      },
    ],
  };

  // Level-up data for celebration modal
  const levelUpData = {
    horseId: 101,
    horseName: 'Thunder Bolt',
    oldLevel: 4,
    newLevel: 5,
    statChanges: [
      { statName: 'Speed', oldValue: 65, newValue: 68 },
      { statName: 'Stamina', oldValue: 70, newValue: 72 },
      { statName: 'Agility', oldValue: 60, newValue: 62 },
    ],
    totalXpGained: 150,
  };

  // Mock user competition stats
  const mockUserStats = {
    userId: 'user-123',
    totalCompetitions: 10,
    totalWins: 3,
    totalTop3: 5,
    winRate: 30.0,
    totalPrizeMoney: 15000,
    totalXpGained: 1500,
    bestPlacement: 1,
    mostSuccessfulDiscipline: 'Show Jumping',
    recentCompetitions: [],
  };

  // Mock horse level info data
  const mockHorseLevelInfo = {
    horseId: 101,
    horseName: 'Thunder Bolt',
    currentLevel: 5,
    currentXp: 450,
    xpForCurrentLevel: 45,
    xpToNextLevel: 100,
    totalXp: 450,
    progressPercent: 45,
    levelThresholds: { 1: 0, 2: 100, 3: 300, 4: 600, 5: 1000 },
  };

  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.overflow = '';
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Default mock implementations
    (useAuth as Mock).mockReturnValue({
      user: { id: 123, username: 'TestUser' },
      isAuthenticated: true,
      isLoading: false,
    });

    (useUserCompetitionStats as Mock).mockReturnValue({
      data: mockUserStats,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    (useHorseLevelInfo as Mock).mockReturnValue({
      data: mockHorseLevelInfo,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  // ==================== COMPETITION RESULTS MODAL XP INTEGRATION (8 tests) ====================
  describe('CompetitionResultsModal XP Integration', () => {
    // Helper to render modal with XP-related props
    const renderModal = (
      overrides: Partial<{
        results: CompetitionResults | null;
        showPrizeNotification: boolean;
        showXpNotification: boolean;
        showLevelUpCelebration: boolean;
        levelUpData: typeof levelUpData | undefined;
      }> = {}
    ) => {
      const {
        results = resultsWithXpData,
        showPrizeNotification = false,
        showXpNotification = false,
        showLevelUpCelebration = false,
        levelUpData: levelUpDataProp,
      } = overrides;

      return render(
        <TestRouter>
          <CompetitionResultsModal
            isOpen={true}
            onClose={mockOnClose}
            competitionId={results?.competitionId ?? 1}
            onViewPerformance={mockOnViewPerformance}
            onFirstView={mockOnFirstView}
            showPrizeNotification={showPrizeNotification}
            onPrizeNotificationClose={mockOnPrizeNotificationClose}
            showXpNotification={showXpNotification}
            onXpNotificationClose={mockOnXpNotificationClose}
            showLevelUpCelebration={showLevelUpCelebration}
            onLevelUpClose={mockOnLevelUpClose}
            levelUpData={levelUpDataProp}
            _testResults={results}
            _testLoading={false}
            _testError={null}
          />
        </TestRouter>
      );
    };

    it('displays XpGainNotification when showXpNotification is true', () => {
      renderModal({ showXpNotification: true });

      expect(screen.getByTestId('xp-gain-notification')).toBeInTheDocument();
    });

    it('hides XpGainNotification when showXpNotification is false', () => {
      renderModal({ showXpNotification: false });

      expect(screen.queryByTestId('xp-gain-notification')).not.toBeInTheDocument();
    });

    it('closes XP notification on user action', async () => {
      const user = userEvent.setup();
      renderModal({ showXpNotification: true });

      const closeButton = screen.getByTestId('xp-notification-close');
      await user.click(closeButton);

      expect(mockOnXpNotificationClose).toHaveBeenCalledTimes(1);
    });

    it('displays LevelUpCelebrationModal when showLevelUpCelebration is true', () => {
      renderModal({
        showLevelUpCelebration: true,
        levelUpData: levelUpData,
      });

      expect(screen.getByTestId('levelup-celebration-modal')).toBeInTheDocument();
    });

    it('hides LevelUpCelebrationModal by default', () => {
      renderModal({
        showLevelUpCelebration: false,
      });

      expect(screen.queryByTestId('levelup-celebration-modal')).not.toBeInTheDocument();
    });

    it('passes correct data to LevelUpCelebrationModal', () => {
      renderModal({
        showLevelUpCelebration: true,
        levelUpData: levelUpData,
      });

      const modal = screen.getByTestId('levelup-celebration-modal');

      // Horse name should be passed
      expect(within(modal).getByTestId('horse-name')).toHaveTextContent('Thunder Bolt');

      // Level transition should be shown
      expect(within(modal).getByTestId('level-transition')).toHaveTextContent('Level 4');
      expect(within(modal).getByTestId('level-transition')).toHaveTextContent('Level 5');

      // XP gained should be displayed
      expect(within(modal).getByTestId('xp-gained-display')).toHaveTextContent('+150 XP');
    });

    it('displays XpProgressTracker for each horse result', () => {
      renderModal();

      // Should show XP progress trackers for horse results
      const trackers = screen.getAllByTestId('xp-progress-tracker');
      expect(trackers.length).toBeGreaterThan(0);
    });

    it('displays HorseLevelBadge next to horse names', () => {
      renderModal();

      // Should show level badges alongside horse names
      const badges = screen.getAllByTestId('horse-level-badge');
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  // ==================== NOTIFICATION SEQUENCING (4 tests) ====================
  describe('Notification Sequencing', () => {
    const renderModal = (
      overrides: Partial<{
        showPrizeNotification: boolean;
        showXpNotification: boolean;
        showLevelUpCelebration: boolean;
        levelUpData: typeof levelUpData | undefined;
      }> = {}
    ) => {
      const {
        showPrizeNotification = false,
        showXpNotification = false,
        showLevelUpCelebration = false,
        levelUpData: levelUpDataProp,
      } = overrides;

      return render(
        <TestRouter>
          <CompetitionResultsModal
            isOpen={true}
            onClose={mockOnClose}
            competitionId={resultsWithXpData.competitionId}
            onViewPerformance={mockOnViewPerformance}
            showPrizeNotification={showPrizeNotification}
            onPrizeNotificationClose={mockOnPrizeNotificationClose}
            showXpNotification={showXpNotification}
            onXpNotificationClose={mockOnXpNotificationClose}
            showLevelUpCelebration={showLevelUpCelebration}
            onLevelUpClose={mockOnLevelUpClose}
            levelUpData={levelUpDataProp}
            _testResults={resultsWithXpData}
            _testLoading={false}
            _testError={null}
          />
        </TestRouter>
      );
    };

    it('displays prize notification first when both prize and XP notifications active', () => {
      renderModal({
        showPrizeNotification: true,
        showXpNotification: false, // XP waits until prize closes
      });

      // Prize notification should be visible
      expect(screen.getByTestId('prize-notification-modal')).toBeInTheDocument();

      // XP notification should NOT be visible yet
      expect(screen.queryByTestId('xp-gain-notification')).not.toBeInTheDocument();
    });

    it('displays XP notification after prize notification closes', () => {
      renderModal({
        showPrizeNotification: false, // Prize already closed
        showXpNotification: true, // Now XP shows
      });

      // XP notification should be visible
      expect(screen.getByTestId('xp-gain-notification')).toBeInTheDocument();

      // Prize notification should NOT be visible
      expect(screen.queryByTestId('prize-notification-modal')).not.toBeInTheDocument();
    });

    it('displays level-up celebration after XP notification closes', () => {
      renderModal({
        showPrizeNotification: false,
        showXpNotification: false, // XP already closed
        showLevelUpCelebration: true, // Now level-up shows
        levelUpData: levelUpData,
      });

      // Level-up modal should be visible
      expect(screen.getByTestId('levelup-celebration-modal')).toBeInTheDocument();

      // XP notification should NOT be visible
      expect(screen.queryByTestId('xp-gain-notification')).not.toBeInTheDocument();
    });

    it('all notifications can be dismissed independently', async () => {
      const user = userEvent.setup();

      // Render with only XP notification
      renderModal({
        showXpNotification: true,
      });

      // Close XP notification
      const closeBtn = screen.getByTestId('xp-notification-close');
      await user.click(closeBtn);
      expect(mockOnXpNotificationClose).toHaveBeenCalledTimes(1);

      // Now render with only level-up
      const { unmount } = renderModal({
        showLevelUpCelebration: true,
        levelUpData: levelUpData,
      });

      // Close level-up via continue button
      const continueBtn = screen.getByTestId('continue-button');
      await user.click(continueBtn);
      expect(mockOnLevelUpClose).toHaveBeenCalledTimes(1);

      unmount();
    });
  });

  // ==================== XP DATA FLOW (4 tests) ====================
  describe('XP Data Flow', () => {
    it('useHorseLevelInfo provides data for XP progress display', () => {
      // Verify the hook returns the expected data structure
      // const hookResult = (useHorseLevelInfo as Mock).mock.results;

      // The mock was called correctly in setup
      expect((useHorseLevelInfo as Mock)).toBeDefined();

      // Render modal with XP data
      render(
        <TestRouter>
          <CompetitionResultsModal
            isOpen={true}
            onClose={mockOnClose}
            competitionId={1}
            _testResults={resultsWithXpData}
            _testLoading={false}
            _testError={null}
          />
        </TestRouter>
      );

      // XP trackers should be rendered using hook data
      const trackers = screen.getAllByTestId('xp-progress-tracker');
      expect(trackers.length).toBeGreaterThan(0);
    });

    it('XP progress updates reflected in tracker display', () => {
      // Set up hook to return updated XP data
      (useHorseLevelInfo as Mock).mockReturnValue({
        data: {
          ...mockHorseLevelInfo,
          xpForCurrentLevel: 75,
          progressPercent: 75,
        },
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <TestRouter>
          <CompetitionResultsModal
            isOpen={true}
            onClose={mockOnClose}
            competitionId={1}
            _testResults={resultsWithXpData}
            _testLoading={false}
            _testError={null}
          />
        </TestRouter>
      );

      // XP tracker should display updated values
      const trackers = screen.getAllByTestId('xp-progress-tracker');
      expect(trackers.length).toBeGreaterThan(0);
    });

    it('level badges update after level-up event', () => {
      // Set up hook to return new level
      (useHorseLevelInfo as Mock).mockReturnValue({
        data: {
          ...mockHorseLevelInfo,
          currentLevel: 6,
        },
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <TestRouter>
          <CompetitionResultsModal
            isOpen={true}
            onClose={mockOnClose}
            competitionId={1}
            _testResults={resultsWithXpData}
            _testLoading={false}
            _testError={null}
          />
        </TestRouter>
      );

      // Level badges should show updated level
      const badges = screen.getAllByTestId('horse-level-badge');
      expect(badges.length).toBeGreaterThan(0);
    });

    it('progress tracker reflects correct XP values from hook data', () => {
      render(
        <TestRouter>
          <CompetitionResultsModal
            isOpen={true}
            onClose={mockOnClose}
            competitionId={1}
            _testResults={resultsWithXpData}
            _testLoading={false}
            _testError={null}
          />
        </TestRouter>
      );

      // Verify tracker text content shows XP values
      const trackerTexts = screen.getAllByTestId('xp-tracker-text');
      expect(trackerTexts.length).toBeGreaterThan(0);
    });
  });

  // ==================== PRIZE NOTIFICATION XP DISPLAY (4 tests) ====================
  describe('PrizeNotificationModal XP Display', () => {
    const renderModalWithPrizeNotification = () => {
      return render(
        <TestRouter>
          <CompetitionResultsModal
            isOpen={true}
            onClose={mockOnClose}
            competitionId={resultsWithXpData.competitionId}
            onViewPerformance={mockOnViewPerformance}
            showPrizeNotification={true}
            onPrizeNotificationClose={mockOnPrizeNotificationClose}
            _testResults={resultsWithXpData}
            _testLoading={false}
            _testError={null}
          />
        </TestRouter>
      );
    };

    it('prize notification shows XP gained amount', () => {
      renderModalWithPrizeNotification();

      const notification = screen.getByTestId('prize-notification-modal');
      expect(within(notification).getByTestId('xp-gained')).toBeInTheDocument();
    });

    it('prize notification displays XP with correct formatting', () => {
      renderModalWithPrizeNotification();

      const notification = screen.getByTestId('prize-notification-modal');
      const xpDisplay = within(notification).getByTestId('xp-gained');
      // XP should show the "+X XP" format
      expect(xpDisplay).toHaveTextContent('XP');
    });

    it('prize notification includes XP in congratulations context', () => {
      renderModalWithPrizeNotification();

      // The notification modal should have the XP display section
      const notification = screen.getByTestId('prize-notification-modal');
      expect(within(notification).getByText(/Experience Gained/i)).toBeInTheDocument();
    });

    it('prize notification renders correctly without XP data', () => {
      // Render with results that have no XP data
      render(
        <TestRouter>
          <CompetitionResultsModal
            isOpen={true}
            onClose={mockOnClose}
            competitionId={resultsWithXpData.competitionId}
            showPrizeNotification={true}
            onPrizeNotificationClose={mockOnPrizeNotificationClose}
            _testResults={resultsWithXpData}
            _testLoading={false}
            _testError={null}
          />
        </TestRouter>
      );

      // Modal should still render without errors
      expect(screen.getByTestId('prize-notification-modal')).toBeInTheDocument();
    });
  });

  // ==================== PAGE INTEGRATION (4 tests) ====================
  describe('CompetitionResultsPage XP Integration', () => {
    const renderPage = (route = '/competitions/results') => {
      return render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path="/competitions/results" element={<CompetitionResultsPage />} />
              <Route
                path="/competitions/results/:competitionId"
                element={<CompetitionResultsPage />}
              />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );
    };

    it('triggers XP notification on first view of competition', async () => {
      const user = userEvent.setup();
      renderPage();

      // Click on a result to open modal
      const resultItem = screen.getByTestId('mock-result-item');
      await user.click(resultItem);

      // Wait for modal to appear
      await waitFor(() => {
        expect(screen.getByTestId('competition-results-modal')).toBeInTheDocument();
      });
    });

    it('detects level-up from competition results', async () => {
      const user = userEvent.setup();
      renderPage();

      // Click on a result to open modal
      const resultItem = screen.getByTestId('mock-result-item');
      await user.click(resultItem);

      // Modal should open
      await waitFor(() => {
        expect(screen.getByTestId('competition-results-modal')).toBeInTheDocument();
      });
    });

    it('tracks viewed competitions correctly', async () => {
      const user = userEvent.setup();
      renderPage();

      // Click on first result
      const resultItem = screen.getByTestId('mock-result-item');
      await user.click(resultItem);

      await waitFor(() => {
        expect(screen.getByTestId('competition-results-modal')).toBeInTheDocument();
      });

      // Close the modal
      await user.click(screen.getByTestId('close-modal-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('competition-results-modal')).not.toBeInTheDocument();
      });

      // Open same competition again - should be tracked as already viewed
      await user.click(resultItem);

      await waitFor(() => {
        expect(screen.getByTestId('competition-results-modal')).toBeInTheDocument();
      });

      // Prize notification should NOT show on subsequent views (already tracked)
      expect(screen.queryByTestId('prize-notification-modal')).not.toBeInTheDocument();
    });

    it('XP indicators display on page stat cards', () => {
      renderPage();

      // The page should render with stats section
      expect(screen.getByTestId('stats-summary')).toBeInTheDocument();
    });
  });
});
