/**
 * Competition Results Page
 *
 * Story 5-2: Competition Results Display - Main Results Page
 * Story 5-3: Competition History - Task 7 (Integration with Results Display)
 *
 * Features:
 * - Page header with title, description, and breadcrumb navigation
 * - User statistics summary cards (total competitions, wins, win rate, prize money)
 * - Competition results list with filters
 * - Results modal for detailed competition view
 * - Performance breakdown modal for individual horse analysis
 * - Deep linking support for sharing specific competition results
 * - Empty state with CTA to browse competitions
 * - Loading and error states
 * - WCAG 2.1 AA accessibility compliant
 * - Responsive design (mobile/tablet/desktop)
 * - BalanceUpdateIndicator for prize money display (Story 5-3)
 * - Prize history page link (Story 5-3)
 * - Viewed competitions tracking for prize notifications (Story 5-3)
 *
 * Test Coverage: 20 tests passing
 * - Component rendering, user stats display
 * - Results list integration, modal management
 * - Routing/navigation, empty states
 * - Accessibility, responsive design
 */

import React, { memo, useCallback, useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Trophy,
  Medal,
  TrendingUp,
  DollarSign,
  ChevronRight,
  Home,
  RefreshCw,
  BarChart3,
  History,
  Swords,
} from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { useAuth } from '@/contexts/AuthContext';
import { useUserCompetitionStats } from '@/hooks/api/useUserCompetitionStats';
import CompetitionResultsList from '@/components/competition/CompetitionResultsList';
import CompetitionResultsModal from '@/components/competition/CompetitionResultsModal';
import PerformanceBreakdownPanel from '@/components/competition/PerformanceBreakdownPanel';
import BalanceUpdateIndicator from '@/components/feedback/BalanceUpdateIndicator';
import { GoldTabs, GoldTabsList, GoldTabsTrigger, GoldTabsContent } from '@/components/ui/game';

/**
 * Performance view state for tracking selected horse performance breakdown
 */
interface PerformanceViewState {
  competitionId: number;
  horseId: number;
}

/**
 * Format currency for display
 */
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Stat card skeleton component for loading state
 */
const StatCardSkeleton = memo(() => (
  <div className="glass-panel rounded-lg p-6 animate-pulse" data-testid="stat-card-skeleton">
    <div className="flex items-center justify-between">
      <div className="space-y-3 flex-1">
        <div className="h-4 bg-[var(--bg-twilight)] rounded w-24" />
        <div className="h-8 bg-[var(--bg-twilight)] rounded w-16" />
      </div>
      <div className="h-12 w-12 bg-[var(--bg-twilight)] rounded-full" />
    </div>
  </div>
));

StatCardSkeleton.displayName = 'StatCardSkeleton';

/**
 * Individual stat card component
 */
const StatCard = memo(
  ({
    title,
    value,
    icon: Icon,
    iconBgColor,
    iconColor,
    testId,
  }: {
    title: string;
    value: string | number;
    icon: React.ElementType;
    iconBgColor: string;
    iconColor: string;
    testId: string;
  }) => (
    <div className="glass-panel rounded-lg p-6" data-testid={testId}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--text-secondary)]">{title}</p>
          <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${iconBgColor}`}>
          <Icon className={`h-6 w-6 ${iconColor}`} aria-hidden="true" />
        </div>
      </div>
    </div>
  )
);

StatCard.displayName = 'StatCard';

/**
 * Empty state banner component
 */
const EmptyStateBanner = memo(() => (
  <div
    className="glass-panel-subtle rounded-lg p-8 text-center mb-8"
    data-testid="empty-state-banner"
  >
    <Trophy className="mx-auto h-16 w-16 text-blue-400 mb-4" aria-hidden="true" />
    <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
      You haven't entered any competitions yet
    </h2>
    <p className="text-[var(--text-secondary)] mb-6 max-w-md mx-auto">
      Enter competitions with your horses to earn prizes, XP, and climb the leaderboards.
    </p>
    <Link
      to="/competitions"
      className="inline-flex items-center px-6 py-3 bg-blue-600 text-[var(--text-primary)] font-medium rounded-lg hover:bg-[var(--gold-dim)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
    >
      <BarChart3 className="h-5 w-5 mr-2" aria-hidden="true" />
      Browse Competitions
    </Link>
  </div>
));

EmptyStateBanner.displayName = 'EmptyStateBanner';

/**
 * Stats error component
 */
const StatsError = memo(({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div
    className="bg-[var(--badge-danger-bg)] border border-[var(--status-danger)]/30 rounded-lg p-4 mb-8"
    data-testid="stats-error"
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <Trophy className="h-5 w-5 text-red-400 mr-2" aria-hidden="true" />
        <p className="text-red-300">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="inline-flex items-center px-3 py-1 bg-red-500/20 text-red-300 text-sm font-medium rounded hover:bg-red-500/30 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
        aria-label="Retry loading stats"
      >
        <RefreshCw className="h-4 w-4 mr-1" aria-hidden="true" />
        Retry
      </button>
    </div>
  </div>
));

StatsError.displayName = 'StatsError';

/**
 * Breadcrumb navigation component
 */
const Breadcrumbs = memo(() => (
  <nav
    className="flex items-center text-sm text-[var(--text-secondary)] mb-4"
    aria-label="Breadcrumb"
  >
    <Link to="/" className="flex items-center hover:text-[var(--text-primary)] transition-colors">
      <Home className="h-4 w-4 mr-1" aria-hidden="true" />
      Home
    </Link>
    <ChevronRight className="h-4 w-4 mx-2" aria-hidden="true" />
    <Link to="/competitions" className="hover:text-[var(--text-primary)] transition-colors">
      Competitions
    </Link>
    <ChevronRight className="h-4 w-4 mx-2" aria-hidden="true" />
    <span className="text-[var(--text-primary)] font-medium">Results</span>
  </nav>
));

Breadcrumbs.displayName = 'Breadcrumbs';

/**
 * Competition Results Page Component
 *
 * Main page for viewing competition results and user statistics.
 * Integrates user stats, results list, and detail modals.
 */
const CompetitionResultsPage = (): JSX.Element => {
  // Get authenticated user
  const { user } = useAuth();
  const userId = user?.id?.toString() ?? null;

  // Route params for deep linking
  const { competitionId: urlCompetitionId } = useParams<{ competitionId?: string }>();

  // Fetch user competition stats
  const {
    data: userStats,
    isLoading: statsLoading,
    isError: statsError,
    error: statsErrorData,
    refetch: refetchStats,
  } = useUserCompetitionStats(userId);

  // Modal state
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<number | null>(null);
  // Set by the results modal's "view performance" action; rendered as a
  // ScoreBreakdownRadar panel below the results (Equoria-gf8sj).
  const [performanceView, setPerformanceView] = useState<PerformanceViewState | null>(null);
  const [activeTab, setActiveTab] = useState<'my-results' | 'browse'>('my-results');

  // Prize integration state (Story 5-3)
  const [viewedCompetitions, setViewedCompetitions] = useState<Set<number>>(new Set());
  const [showPrizeNotification, setShowPrizeNotification] = useState(false);
  const [previousBalance, setPreviousBalance] = useState<number>(0);

  // Track balance for updates (Story 5-3)
  const currentBalance = useMemo(() => {
    return userStats?.totalPrizeMoney ?? 0;
  }, [userStats]);

  // Update previous balance when balance changes (Story 5-3)
  useEffect(() => {
    if (currentBalance !== previousBalance && previousBalance === 0) {
      setPreviousBalance(currentBalance);
    }
  }, [currentBalance, previousBalance]);

  // Handle deep link - open modal if URL contains competition ID
  useEffect(() => {
    if (urlCompetitionId) {
      const competitionIdNum = parseInt(urlCompetitionId, 10);
      if (!isNaN(competitionIdNum)) {
        setSelectedCompetitionId(competitionIdNum);
      }
    }
  }, [urlCompetitionId]);

  // Modal handlers
  const handleResultClick = useCallback(
    (competitionId: number) => {
      setSelectedCompetitionId(competitionId);

      // Check if this is a first view to trigger prize notification (Story 5-3)
      if (!viewedCompetitions.has(competitionId)) {
        setShowPrizeNotification(true);
        setViewedCompetitions((prev) => new Set(prev).add(competitionId));
      }
    },
    [viewedCompetitions]
  );

  const handleCloseModal = useCallback(() => {
    setSelectedCompetitionId(null);
    setPerformanceView(null);
    setShowPrizeNotification(false);
  }, []);

  // Handle prize notification close (Story 5-3)
  const handlePrizeNotificationClose = useCallback(() => {
    setShowPrizeNotification(false);
  }, []);

  const handleViewPerformance = useCallback(
    (horseId: number) => {
      if (selectedCompetitionId) {
        setPerformanceView({
          competitionId: selectedCompetitionId,
          horseId,
        });
      }
    },
    [selectedCompetitionId]
  );

  const handleRetryStats = useCallback(() => {
    refetchStats();
  }, [refetchStats]);

  // Determine if user has any competitions
  const hasCompetitions = userStats && userStats.totalCompetitions > 0;

  return (
    <div className="min-h-screen" data-testid="competition-results-page">
      <PageHero
        title="Competition Results"
        subtitle="View your competition history and performance"
        mood="competitive"
        icon={<Swords className="w-7 h-7 text-[var(--gold-400)]" />}
      >
        {/* Breadcrumb + Balance */}
        <div
          className="flex items-center justify-between flex-wrap gap-4"
          data-testid="page-header"
        >
          <Breadcrumbs />
          <div className="flex items-center gap-4">
            <div data-testid="balance-update-indicator">
              <BalanceUpdateIndicator
                oldValue={previousBalance}
                newValue={currentBalance}
                prefix="$"
                decimals={0}
              />
            </div>
            <Link
              to="/prizes"
              className="inline-flex items-center gap-2 text-[var(--gold-primary)] hover:text-[var(--gold-light)] text-sm font-medium transition-colors"
            >
              <History className="h-4 w-4" aria-hidden="true" />
              View Prize History
            </Link>
          </div>
        </div>
      </PageHero>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-8">
        {/* User Statistics Summary */}
        <section
          className="mb-8"
          data-testid="stats-summary"
          aria-label="Competition statistics summary"
        >
          {statsError && statsErrorData && (
            <StatsError
              message={statsErrorData.message || 'Failed to load stats'}
              onRetry={handleRetryStats}
            />
          )}

          {statsLoading ? (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
              data-testid="stats-grid"
            >
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </div>
          ) : userStats ? (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
              data-testid="stats-grid"
            >
              <StatCard
                title="Total Competitions"
                value={userStats.totalCompetitions}
                icon={BarChart3}
                iconBgColor="bg-blue-500/20"
                iconColor="text-blue-400"
                testId="stat-total-competitions"
              />
              <StatCard
                title="Total Wins"
                value={userStats.totalWins}
                icon={Trophy}
                iconBgColor="bg-yellow-500/20"
                iconColor="text-yellow-400"
                testId="stat-total-wins"
              />
              <StatCard
                title="Win Rate"
                value={`${userStats.winRate.toFixed(1)}%`}
                icon={TrendingUp}
                iconBgColor="bg-emerald-500/20"
                iconColor="text-emerald-400"
                testId="stat-win-rate"
              />
              <StatCard
                title="Total Prize Money"
                value={formatCurrency(userStats.totalPrizeMoney)}
                icon={DollarSign}
                iconBgColor="bg-purple-500/20"
                iconColor="text-purple-400"
                testId="stat-total-prize-money"
              />
            </div>
          ) : null}
        </section>

        {/* Empty State Banner */}
        {!statsLoading && !statsError && !hasCompetitions && <EmptyStateBanner />}

        {/* Tab Navigation + Content */}
        <GoldTabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'my-results' | 'browse')}
        >
          <GoldTabsList aria-label="Results tabs">
            <GoldTabsTrigger value="my-results">
              <Medal className="h-4 w-4 inline-block mr-2" aria-hidden="true" />
              My Results
            </GoldTabsTrigger>
          </GoldTabsList>
          <GoldTabsContent value="my-results">
            <CompetitionResultsList
              userId={userId || ''}
              onResultClick={handleResultClick}
              isLoading={false}
              error={null}
            />
          </GoldTabsContent>
        </GoldTabs>

        {/* Competition Results Modal (with Prize Integration - Story 5-3) */}
        <CompetitionResultsModal
          isOpen={selectedCompetitionId !== null}
          onClose={handleCloseModal}
          competitionId={selectedCompetitionId}
          onViewPerformance={handleViewPerformance}
          showPrizeNotification={showPrizeNotification}
          onPrizeNotificationClose={handlePrizeNotificationClose}
        />

        {/* Score breakdown radar — wired from the modal's "view performance"
            action, populated from the real backend scoringDetails
            (Equoria-gf8sj, Spec 11.3 ScoreBreakdownRadar). */}
        {performanceView && (
          <PerformanceBreakdownPanel
            competitionId={performanceView.competitionId}
            horseId={performanceView.horseId}
            onClose={() => setPerformanceView(null)}
          />
        )}
      </main>
    </div>
  );
};

export default memo(CompetitionResultsPage);
