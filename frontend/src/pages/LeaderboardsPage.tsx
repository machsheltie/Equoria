/**
 * LeaderboardsPage Component
 *
 * Full-page integration of all leaderboard sub-components (Tasks 1-5).
 * Manages URL state for category, period, discipline, and pagination so
 * that browser back/forward and bookmarking work correctly.
 *
 * Layout:
 * 1. Page header with title and subtitle
 * 2. UserRankDashboard showing the current user's rankings
 * 3. LeaderboardCategorySelector for category / period / discipline
 * 4. LeaderboardTable with paginated entries
 * 5. LeaderboardHorseDetailModal (opens on entry click)
 *
 * Story 5-5: Leaderboards - Task 6
 */

import { useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Trophy } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useLeaderboard } from '@/hooks/api/useLeaderboard';
import { useUserRankSummary } from '@/hooks/api/useUserRankSummary';

import LeaderboardCategorySelector from '@/components/leaderboard/LeaderboardCategorySelector';
import LeaderboardTable from '@/components/leaderboard/LeaderboardTable';
import UserRankDashboard from '@/components/leaderboard/UserRankDashboard';
import LeaderboardHorseDetailModal from '@/components/leaderboard/LeaderboardHorseDetailModal';

import type {
  LeaderboardCategory,
  TimePeriod,
} from '@/components/leaderboard/LeaderboardCategorySelector';
import type { LeaderboardEntryData } from '@/components/leaderboard/LeaderboardEntry';
import type { HorseDetailData } from '@/components/leaderboard/LeaderboardHorseDetailModal';

// ---------------------------------------------------------------------------
// URL State Management Hook
// ---------------------------------------------------------------------------

/**
 * Reads and writes leaderboard filter state to URL search params.
 * Provides updater helpers that reset page to 1 on filter changes and
 * remove the discipline param when switching away from the discipline
 * category.
 */
function useLeaderboardUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const category = (searchParams.get('category') as LeaderboardCategory) || 'level';
  const period = (searchParams.get('period') as TimePeriod) || 'all-time';
  const discipline = searchParams.get('discipline') || undefined;
  const page = parseInt(searchParams.get('page') || '1', 10);

  const updateCategory = useCallback(
    (newCategory: LeaderboardCategory) => {
      const params = new URLSearchParams(searchParams);
      params.set('category', newCategory);
      params.set('page', '1');
      if (newCategory !== 'discipline') {
        params.delete('discipline');
      }
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const updatePeriod = useCallback(
    (newPeriod: TimePeriod) => {
      const params = new URLSearchParams(searchParams);
      params.set('period', newPeriod);
      params.set('page', '1');
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const updateDiscipline = useCallback(
    (newDiscipline: string) => {
      const params = new URLSearchParams(searchParams);
      params.set('discipline', newDiscipline);
      params.set('page', '1');
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const updatePage = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams);
      params.set('page', newPage.toString());
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  return {
    category,
    period,
    discipline,
    page,
    updateCategory,
    updatePeriod,
    updateDiscipline,
    updatePage,
  };
}

// ---------------------------------------------------------------------------
// Helper: Build minimal HorseDetailData from a LeaderboardEntryData
// ---------------------------------------------------------------------------

/**
 * Creates a lightweight HorseDetailData object from a leaderboard entry.
 * Real API data would populate all fields; here we fill in sensible defaults
 * so the modal can render immediately while a full fetch could run in the
 * background (future enhancement).
 */
function entryToHorseDetail(entry: LeaderboardEntryData): HorseDetailData {
  return {
    horseId: entry.horseId ?? 0,
    horseName: entry.horseName ?? entry.ownerName,
    breed: 'Unknown',
    age: 0,
    sex: 'Stallion',
    level: entry.secondaryStats?.level ?? entry.primaryStat,
    stats: {
      speed: 0,
      stamina: 0,
      agility: 0,
      balance: 0,
      precision: 0,
      intelligence: 0,
      boldness: 0,
      flexibility: 0,
      obedience: 0,
      focus: 0,
    },
    competitionHistory: {
      total: entry.secondaryStats?.totalCompetitions ?? 0,
      wins: entry.secondaryStats?.wins ?? 0,
      top3Finishes: 0,
      winRate: entry.secondaryStats?.winRate ?? 0,
      totalPrizeMoney: entry.secondaryStats?.totalPrizeMoney ?? 0,
      recentCompetitions: [],
    },
    owner: {
      ownerId: entry.ownerId,
      ownerName: entry.ownerName,
      stableSize: 0,
    },
    achievements: [],
  };
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * LeaderboardsPage integrates all leaderboard sub-components into a single
 * page with URL-driven state, data fetching, and a horse detail modal.
 */
const LeaderboardsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : '';

  // URL state
  const {
    category,
    period,
    discipline,
    page,
    updateCategory,
    updatePeriod,
    updateDiscipline,
    updatePage,
  } = useLeaderboardUrlState();

  // Data fetching
  const {
    data: leaderboardData,
    isLoading: isLeaderboardLoading,
    isError: isLeaderboardError,
    refetch: refetchLeaderboard,
  } = useLeaderboard({ category, period, discipline, page });

  const {
    data: userRankData,
    isLoading: isUserRankLoading,
  } = useUserRankSummary({ userId });

  // Modal state
  const [selectedEntry, setSelectedEntry] = useState<LeaderboardEntryData | null>(null);
  const isModalOpen = selectedEntry !== null;

  // Handlers
  const handleEntryClick = useCallback((entry: LeaderboardEntryData) => {
    setSelectedEntry(entry);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedEntry(null);
  }, []);

  const handleViewFullProfile = useCallback(
    (horseId: number) => {
      navigate(`/horses/${horseId}`);
    },
    [navigate]
  );

  const handleCategoryClickFromDashboard = useCallback(
    (cat: string) => {
      updateCategory(cat as LeaderboardCategory);
    },
    [updateCategory]
  );

  // Derived values
  const entries = leaderboardData?.entries ?? [];
  const currentPage = leaderboardData?.currentPage ?? page;
  const totalPages = leaderboardData?.totalPages ?? 1;

  const horseDetailData: HorseDetailData | null = selectedEntry
    ? entryToHorseDetail(selectedEntry)
    : null;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ---------------------------------------------------------------
            Page Header
        --------------------------------------------------------------- */}
        <div className="flex items-center gap-3">
          <Trophy size={32} className="text-yellow-500" aria-hidden="true" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Leaderboards</h1>
            <p className="text-gray-500 mt-1">
              View top performers across all categories
            </p>
          </div>
        </div>

        {/* ---------------------------------------------------------------
            User Rankings Section
        --------------------------------------------------------------- */}
        <section aria-label="Your rankings">
          <UserRankDashboard
            userId={userId}
            userName={userRankData?.userName ?? user?.username ?? 'Player'}
            rankings={userRankData?.rankings ?? []}
            bestRankings={userRankData?.bestRankings ?? []}
            isLoading={isUserRankLoading}
            onCategoryClick={handleCategoryClickFromDashboard}
          />
        </section>

        {/* ---------------------------------------------------------------
            Category / Period / Discipline Selector
        --------------------------------------------------------------- */}
        <section aria-label="Leaderboard filters">
          <LeaderboardCategorySelector
            selectedCategory={category}
            selectedPeriod={period}
            selectedDiscipline={discipline}
            onCategoryChange={updateCategory}
            onPeriodChange={updatePeriod}
            onDisciplineChange={updateDiscipline}
            isLoading={isLeaderboardLoading}
          />
        </section>

        {/* ---------------------------------------------------------------
            Error State
        --------------------------------------------------------------- */}
        {isLeaderboardError && (
          <div
            className="bg-red-50 border border-red-200 rounded-lg p-6 text-center"
            role="alert"
          >
            <p className="text-red-700 font-medium">Failed to load leaderboard data</p>
            <p className="text-red-500 text-sm mt-1">
              Something went wrong while fetching the leaderboard. Please try again.
            </p>
            <button
              className="mt-4 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
              onClick={() => refetchLeaderboard()}
              aria-label="Retry loading leaderboard"
            >
              Retry
            </button>
          </div>
        )}

        {/* ---------------------------------------------------------------
            Leaderboard Table
        --------------------------------------------------------------- */}
        {!isLeaderboardError && (
          <section aria-label="Leaderboard table">
            <LeaderboardTable
              entries={entries}
              category={category}
              isLoading={isLeaderboardLoading}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={updatePage}
              onEntryClick={handleEntryClick}
            />
          </section>
        )}

        {/* ---------------------------------------------------------------
            Horse Detail Modal
        --------------------------------------------------------------- */}
        <LeaderboardHorseDetailModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          horseData={horseDetailData}
          isLoading={false}
          onViewFullProfile={handleViewFullProfile}
        />
      </div>
    </main>
  );
};

export default LeaderboardsPage;
