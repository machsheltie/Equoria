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
import { useSearchParams, useNavigate } from 'react-router';
import { Trophy } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorState } from '@/components/ui/state';
import { userMessageFor } from '@/lib/http/userMessage';
import { DISCIPLINES, formatDisciplineName } from '@/lib/utils/training-utils';

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

  const category = (searchParams.get('category') as LeaderboardCategory) || 'player-xp';
  const period = (searchParams.get('period') as TimePeriod) || 'overall';
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

// Boards whose rows are players, not horses: there is no horse to open.
const playerBoards: ReadonlySet<LeaderboardCategory> = new Set([
  'player-xp',
  'player-earnings',
  'player-wins',
  'player-win-rate',
]);

// ---------------------------------------------------------------------------
// Empty-state copy: a board can be genuinely empty (a new month, the 100-show
// minimum), and says why (Equoria-y3nia).
// ---------------------------------------------------------------------------

const winRateEmpty = (who: string) => ({
  title: `No ${who} has entered 100 shows yet`,
  description: `A ${who} joins the win-percentage board once ${who === 'horse' ? 'she' : 'they'} have entered 100 shows in the period.`,
});

const emptyBoardCopy: Partial<Record<LeaderboardCategory, { title: string; description: string }>> =
  {
    'player-win-rate': winRateEmpty('player'),
    'horse-win-rate': winRateEmpty('horse'),
    'player-wins': {
      title: 'No player has won a show yet',
      description: 'Every player whose horse wins a show joins this board.',
    },
    'horse-wins': {
      title: 'No horse has won a show yet',
      description: 'Every horse that wins a show joins this board.',
    },
    discipline: {
      title: 'No horse has won in this discipline yet',
      description: 'Every horse that wins a show in the discipline joins this board.',
    },
  };

// ---------------------------------------------------------------------------
// Helper: Build minimal HorseDetailData from a LeaderboardEntryData
// ---------------------------------------------------------------------------

// HorseDetailData.sex is a fixed union; the backend returns a free string.
// Known values pass through; anything else is UNKNOWN (null -> "—"), never a
// plausible real value such as 'Stallion' (Equoria-b9yi1, doctrine §4).
const VALID_SEXES: ReadonlyArray<HorseDetailData['sex']> = ['Stallion', 'Mare', 'Colt', 'Filly'];

function coerceSex(sex: string | undefined): HorseDetailData['sex'] {
  return (VALID_SEXES as readonly string[]).includes(sex ?? '')
    ? (sex as HorseDetailData['sex'])
    : null;
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
  return {
    horseId: profile.horseId,
    horseName: profile.name,
    breed: profile.breed ?? 'not recorded',
    age: profile.age,
    sex: coerceSex(profile.sex),
    level: entry.secondaryStats?.level,
    stats: { ...profile.stats },
    competitionHistory: {
      // Unknown stays unknown (shown as "—"), never the win count; a real 0 survives `??`
      // (Equoria-alnmo).
      total: entry.secondaryStats?.totalCompetitions ?? null,
      wins: entry.secondaryStats?.wins ?? profile.competitionWins,
      top3Finishes: profile.topThreeFinishes,
      // Unknown stays unknown (shown as "—"); a real 0 survives `??` (Equoria-k7plw).
      winRate: entry.secondaryStats?.winRate ?? null,
      totalPrizeMoney: entry.secondaryStats?.totalPrizeMoney ?? profile.totalEarnings,
      recentCompetitions: [],
    },
    owner: {
      ownerId: entry.ownerId,
      ownerName: entry.ownerName,
      // stableSize is omitted: neither the row nor the profile carries it.
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
// The rank summary's categories that are leaderboards.
const summaryCategoryBoards: Record<string, LeaderboardCategory | undefined> = {
  xp: 'player-xp',
  'horse-earnings': 'player-earnings',
};

const LeaderboardsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id ?? '';

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

  // The discipline select shows its first option until a player picks one, so
  // that discipline is the one the board must show (Equoria-pthuj). The select
  // holds discipline ids; the backend ranks by the discipline's name.
  const selectedDisciplineId =
    category === 'discipline' ? (discipline ?? DISCIPLINES[0]?.id) : discipline;
  const disciplineName = selectedDisciplineId
    ? formatDisciplineName(selectedDisciplineId)
    : undefined;

  // Data fetching
  const {
    data: leaderboardData,
    isLoading: isLeaderboardLoading,
    isError: isLeaderboardError,
    refetch: refetchLeaderboard,
  } = useLeaderboard({ category, period, discipline: disciplineName, page });

  const {
    data: userRankData,
    isLoading: isUserRankLoading,
    isError: isUserRankError,
    error: userRankError,
    refetch: refetchUserRank,
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
      // The rank summary names its own categories; only the ones that are boards open one.
      const board = summaryCategoryBoards[cat];
      if (board) {
        updateCategory(board);
      }
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
    error: horseProfileError,
    refetch: refetchHorseProfile,
  } = useLeaderboardHorseProfile(selectedEntry?.horseId, isModalOpen);

  const horseDetailData: HorseDetailData | null =
    selectedEntry && horseProfile ? buildHorseDetail(horseProfile, selectedEntry) : null;

  // Skeleton while the real profile loads. On error or a missing horseId the
  // modal falls back to its honest empty state (horseData null, not loading).
  const isHorseDetailLoading =
    isModalOpen && !!selectedEntry?.horseId && isHorseProfileLoading && !isHorseProfileError;

  return (
    <PageContainer variant="wide" padded={false} className="pb-12" data-testid="leaderboards-page">
      <PageHeader
        title="Leaderboards"
        subtitle="Players and horses, over the whole game and over this month."
        icon={<Trophy className="w-6 h-6 text-[var(--gold-400)]" aria-hidden="true" />}
      />

      <div className="mt-6 space-y-8">
        {/* ---------------------------------------------------------------
            User Rankings Section
        --------------------------------------------------------------- */}
        <section aria-label="Your rankings">
          <UserRankDashboard
            userName={userRankData?.userName ?? user?.username ?? 'Player'}
            rankings={userRankData?.rankings ?? []}
            bestRankings={userRankData?.bestRankings ?? []}
            isLoading={isUserRankLoading}
            isError={isUserRankError}
            errorMessage={isUserRankError ? userMessageFor(userRankError).message : undefined}
            onRetry={() => void refetchUserRank()}
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
            selectedDiscipline={selectedDisciplineId}
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
          <ErrorState
            title="Failed to load leaderboard data"
            message="Something went wrong while fetching the leaderboard. Please try again."
            retry={{ label: 'Retry', onClick: () => refetchLeaderboard() }}
          />
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
              onEntryClick={playerBoards.has(category) ? undefined : handleEntryClick}
              emptyTitle={emptyBoardCopy[category]?.title}
              emptyDescription={emptyBoardCopy[category]?.description}
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
          loadError={
            isHorseProfileError
              ? {
                  message: userMessageFor(horseProfileError).message,
                  onRetry: () => void refetchHorseProfile(),
                }
              : null
          }
          onViewFullProfile={handleViewFullProfile}
        />
      </div>
    </PageContainer>
  );
};

export default LeaderboardsPage;
