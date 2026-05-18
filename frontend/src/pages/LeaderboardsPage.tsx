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
import PageHero from '@/components/layout/PageHero';

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
import { useLeaderboardHorseProfile } from '@/hooks/api/useLeaderboardHorseProfile';
import type { LeaderboardHorseProfile } from '@/lib/api/leaderboards';

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

// HorseDetailData.sex is a fixed union; the backend returns a free string.
// Map known values through, fall back to 'Stallion' only as a render-safe
// default for an unrecognised token (not fabricated game data — the real
// value is shown when it matches the union, which it does for all sexes
// the schema produces).
const VALID_SEXES: ReadonlyArray<HorseDetailData['sex']> = [
  'Stallion',
  'Mare',
  'Colt',
  'Filly',
  'Rig',
];

function coerceSex(sex: string | undefined): HorseDetailData['sex'] {
  return (VALID_SEXES as readonly string[]).includes(sex ?? '')
    ? (sex as HorseDetailData['sex'])
    : 'Stallion';
}

/**
 * Builds HorseDetailData from the REAL horse profile (breed/age/sex/stats
 * fetched from GET /api/leaderboards/horse/:horseId) merged with the REAL
 * leaderboard entry (level + competition tallies + owner identity the
 * profile endpoint does not return). No fabricated placeholder values:
 * breed/age/sex/stats are persisted data; competition history and owner
 * identity come from the genuine leaderboard row. Fields neither source
 * provides (recentCompetitions, achievements, stableSize) are honest
 * empties, not invented data (Equoria-8nfc).
 */
function buildHorseDetail(
  profile: LeaderboardHorseProfile,
  entry: LeaderboardEntryData
): HorseDetailData {
  const totalCompetitions = entry.secondaryStats?.totalCompetitions ?? profile.competitionWins;
  return {
    horseId: profile.horseId,
    horseName: profile.name,
    breed: profile.breed ?? 'not recorded',
    age: profile.age,
    sex: coerceSex(profile.sex),
    level: entry.secondaryStats?.level ?? entry.primaryStat,
    stats: { ...profile.stats },
    competitionHistory: {
      total: totalCompetitions,
      wins: entry.secondaryStats?.wins ?? profile.competitionWins,
      top3Finishes: profile.topThreeFinishes,
      winRate: entry.secondaryStats?.winRate ?? 0,
      totalPrizeMoney: entry.secondaryStats?.totalPrizeMoney ?? profile.totalEarnings,
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

  const { data: userRankData, isLoading: isUserRankLoading } = useUserRankSummary({ userId });

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

  // Fetch the REAL horse profile for the selected entry. Disabled until an
  // entry with a valid horseId is selected (Equoria-8nfc — no fabricated
  // placeholder data; the modal shows a loading skeleton then real values).
  const {
    data: horseProfile,
    isLoading: isHorseProfileLoading,
    isError: isHorseProfileError,
  } = useLeaderboardHorseProfile(selectedEntry?.horseId, isModalOpen);

  const horseDetailData: HorseDetailData | null =
    selectedEntry && horseProfile ? buildHorseDetail(horseProfile, selectedEntry) : null;

  // Skeleton while the real profile loads. On error or a missing horseId the
  // modal falls back to its honest empty state (horseData null, not loading).
  const isHorseDetailLoading =
    isModalOpen && !!selectedEntry?.horseId && isHorseProfileLoading && !isHorseProfileError;

  return (
    <div className="min-h-screen">
      <PageHero
        title="Leaderboards"
        subtitle="View top performers across all categories — who reigns supreme in Equoria?"
        mood="competitive"
        icon={<Trophy className="w-7 h-7 text-[var(--gold-400)]" aria-hidden="true" />}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 space-y-8">
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
            className="bg-[rgba(239,68,68,0.1)] border border-red-500/30 rounded-lg p-6 text-center"
            role="alert"
          >
            <p className="text-red-400 font-medium">Failed to load leaderboard data</p>
            <p className="text-red-500/80 text-sm mt-1">
              Something went wrong while fetching the leaderboard. Please try again.
            </p>
            <button
              className="mt-4 px-4 py-2 bg-red-600 text-[var(--text-primary)] text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
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
          isLoading={isHorseDetailLoading}
          onViewFullProfile={handleViewFullProfile}
        />
      </div>
    </div>
  );
};

export default LeaderboardsPage;
