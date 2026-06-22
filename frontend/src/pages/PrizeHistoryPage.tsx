/**
 * Prize History Page
 *
 * Story 5-3: Competition History Display - Task 6: Prize History Page
 *
 * Features:
 * - PageHeader with title, description, and breadcrumb navigation
 * - Summary statistics cards (total prize money, XP, competitions, win rate)
 * - PrizeTransactionHistory component integration
 * - URL parameter handling for filter persistence
 * - Deep linking support with filter state in URL
 * - Loading and error states with retry functionality
 * - WCAG 2.1 AA accessibility compliant
 *
 * Design-system migration (Equoria-o5hub, marketplace family): PageHeader
 * replaces PageHero; PageContainer(wide, as=main) replaces the page-local
 * max-w-7xl px-* wrapper; stat cards are Surface(panel) + IconBox semantic
 * tints; prize money renders through the canonical Currency component (game
 * coins — the previous USD Intl format was a doctrine violation); error state
 * via ErrorState with a real retry; skeletons via Skeleton primitives.
 */

import React, { type JSX, memo, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Coins, Star, Trophy, TrendingUp, ChevronRight, Home } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Surface } from '@/components/ui/Surface';
import { IconBox } from '@/components/ui/IconBox';
import Currency from '@/components/ui/Currency';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { useAuth } from '@/contexts/AuthContext';
import { usePrizeHistory } from '@/hooks/api/usePrizeHistory';
import { useClaimPrizes } from '@/hooks/api/useClaimPrizes';
import { type TransactionFilters } from '@/lib/api/prizes';
import PrizeTransactionHistory from '@/components/competition/PrizeTransactionHistory';

/**
 * User prize statistics calculated from transaction data
 */
interface UserPrizeStats {
  totalPrizeMoney: number;
  totalXpGained: number;
  totalCompetitions: number;
  winRate: number;
  firstPlaces: number;
  secondPlaces: number;
  thirdPlaces: number;
}

/**
 * Stat card skeleton component for loading state
 */
const StatCardSkeleton = memo(() => (
  <Surface variant="panel" className="p-4" data-testid="stat-card-skeleton">
    <div className="flex items-center justify-between">
      <div className="space-y-3 flex-1">
        <Skeleton.Line className="w-24 h-4" />
        <Skeleton.Line className="w-16 h-8" />
      </div>
      <Skeleton.Circle size={48} />
    </div>
  </Surface>
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
    iconVariant,
    testId,
  }: {
    title: string;
    value: React.ReactNode;
    icon: React.ElementType;
    iconVariant: 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
    testId: string;
  }) => (
    <Surface variant="panel" className="p-4" data-testid={testId}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--text-muted)]">{title}</p>
          <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{value}</p>
        </div>
        <IconBox variant={iconVariant} size="lg">
          <Icon aria-hidden="true" />
        </IconBox>
      </div>
    </Surface>
  )
);

StatCard.displayName = 'StatCard';

/**
 * Breadcrumb navigation component
 */
const Breadcrumbs = memo(() => (
  <nav className="flex items-center text-sm text-[var(--text-muted)]" aria-label="Breadcrumb">
    <Link to="/" className="flex items-center hover:text-[var(--text-primary)] transition-colors">
      <Home className="h-4 w-4 mr-1" aria-hidden="true" />
      Home
    </Link>
    <ChevronRight className="h-4 w-4 mx-2" aria-hidden="true" />
    <Link to="/profile" className="hover:text-[var(--text-primary)] transition-colors">
      Profile
    </Link>
    <ChevronRight className="h-4 w-4 mx-2" aria-hidden="true" />
    <span className="text-[var(--text-primary)] font-medium">Prize History</span>
  </nav>
));

Breadcrumbs.displayName = 'Breadcrumbs';

/**
 * Calculate prize statistics from transaction data
 */
const calculateStats = (
  transactions: Array<{
    prizeMoney: number;
    xpGained: number;
    placement: number;
  }>
): UserPrizeStats => {
  if (!transactions || transactions.length === 0) {
    return {
      totalPrizeMoney: 0,
      totalXpGained: 0,
      totalCompetitions: 0,
      winRate: 0,
      firstPlaces: 0,
      secondPlaces: 0,
      thirdPlaces: 0,
    };
  }

  const totalPrizeMoney = transactions.reduce((sum, t) => sum + t.prizeMoney, 0);
  const totalXpGained = transactions.reduce((sum, t) => sum + t.xpGained, 0);
  const totalCompetitions = transactions.length;
  const firstPlaces = transactions.filter((t) => t.placement === 1).length;
  const secondPlaces = transactions.filter((t) => t.placement === 2).length;
  const thirdPlaces = transactions.filter((t) => t.placement === 3).length;
  const winRate = totalCompetitions > 0 ? (firstPlaces / totalCompetitions) * 100 : 0;

  return {
    totalPrizeMoney,
    totalXpGained,
    totalCompetitions,
    winRate,
    firstPlaces,
    secondPlaces,
    thirdPlaces,
  };
};

/**
 * Parse filters from URL search params
 */
const parseFiltersFromParams = (searchParams: URLSearchParams): TransactionFilters => {
  return {
    dateRange: (searchParams.get('dateRange') as TransactionFilters['dateRange']) || 'all',
    horseId: searchParams.get('horseId') ? Number(searchParams.get('horseId')) : undefined,
    discipline: searchParams.get('discipline') || undefined,
  };
};

/**
 * Prize History Page Component
 *
 * Main page for viewing prize transaction history and user statistics.
 * Integrates summary stats, transaction history, and filter management.
 */
const PrizeHistoryPage = (): JSX.Element => {
  // Get authenticated user
  const { user } = useAuth();
  const userId = user?.id?.toString() ?? '';

  // URL params for filter state persistence
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse filters from URL params
  const filters = useMemo(() => parseFiltersFromParams(searchParams), [searchParams]);

  // Fetch prize history with filters
  const {
    data: transactions,
    isLoading,
    isError,
    error,
    refetch,
  } = usePrizeHistory(userId, filters);

  // Calculate stats from transaction data
  const stats = useMemo(() => calculateStats(transactions ?? []), [transactions]);

  // Handle filter changes - update URL params
  const handleFilterChange = useCallback(
    (newFilters: TransactionFilters) => {
      const params = new URLSearchParams();

      if (newFilters.dateRange && newFilters.dateRange !== 'all') {
        params.set('dateRange', newFilters.dateRange);
      }
      if (newFilters.horseId !== undefined) {
        params.set('horseId', newFilters.horseId.toString());
      }
      if (newFilters.discipline) {
        params.set('discipline', newFilters.discipline);
      }

      setSearchParams(params);
    },
    [setSearchParams]
  );

  // Handle retry on error
  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  // Equoria-bx52 — wire the per-row Claim button to useClaimPrizes.
  // The hook handles cache invalidation (prize history, horse summaries,
  // profile/balance, notifications) on success. See useClaimPrizes.ts.
  const claimMutation = useClaimPrizes();
  const handleClaim = useCallback(
    (competitionId: number) => {
      claimMutation.mutate({ competitionId });
    },
    [claimMutation]
  );

  return (
    <PageContainer variant="wide" as="main" data-testid="prize-history-page">
      <PageHeader
        title="Prize History"
        subtitle="View your competition earnings and prize transaction history"
        icon={<Coins className="w-6 h-6 text-[var(--gold-400)]" aria-hidden="true" />}
        breadcrumbs={<Breadcrumbs />}
      />

      <div className="mt-6 pb-8">
        {/* Error State — real retry via refetch */}
        {isError && error && (
          <div data-testid="stats-error" className="mb-8">
            <ErrorState
              title="Could not load prize history"
              message={error.message || 'Failed to load prize history'}
              retry={{ label: 'Try Again', onClick: handleRetry }}
            />
          </div>
        )}

        {/* Summary Statistics */}
        <section className="mb-8" data-testid="stats-summary" aria-label="Prize statistics summary">
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="stats-grid">
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="stats-grid">
              <StatCard
                title="Total Prize Money"
                value={<Currency amount={stats.totalPrizeMoney} />}
                icon={Coins}
                iconVariant="success"
                testId="stat-total-prize-money"
              />
              <StatCard
                title="Total XP Gained"
                value={stats.totalXpGained}
                icon={Star}
                iconVariant="info"
                testId="stat-total-xp"
              />
              <StatCard
                title="Total Competitions"
                value={stats.totalCompetitions}
                icon={Trophy}
                iconVariant="accent"
                testId="stat-total-competitions"
              />
              <StatCard
                title="Win Rate"
                value={`${stats.winRate.toFixed(1)}%`}
                icon={TrendingUp}
                iconVariant="warning"
                testId="stat-win-rate"
              />
            </div>
          )}
        </section>

        {/* Transaction History */}
        <section>
          <PrizeTransactionHistory
            transactions={transactions ?? []}
            filters={filters}
            onFilterChange={handleFilterChange}
            onClaim={handleClaim}
            isClaiming={claimMutation.isPending}
            isLoading={isLoading}
          />
        </section>
      </div>
    </PageContainer>
  );
};

export default memo(PrizeHistoryPage);
