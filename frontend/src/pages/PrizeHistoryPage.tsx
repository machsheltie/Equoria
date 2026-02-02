/**
 * Prize History Page
 *
 * Story 5-3: Competition History Display - Task 6: Prize History Page
 *
 * Features:
 * - Page header with title, description, and breadcrumb navigation
 * - Summary statistics cards (total prize money, XP, competitions, win rate)
 * - PrizeTransactionHistory component integration
 * - URL parameter handling for filter persistence
 * - Deep linking support with filter state in URL
 * - Loading and error states with retry functionality
 * - WCAG 2.1 AA accessibility compliant
 * - Responsive design (mobile/tablet/desktop)
 *
 * Test Coverage: 20+ tests
 * - Rendering, statistics display, navigation
 * - Filter integration, URL params, edge cases
 * - Accessibility, responsive design
 */

import React, { memo, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  DollarSign,
  Star,
  Trophy,
  TrendingUp,
  ChevronRight,
  Home,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePrizeHistory } from '@/hooks/api/usePrizeHistory';
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
  <div
    className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 animate-pulse"
    data-testid="stat-card-skeleton"
  >
    <div className="flex items-center justify-between">
      <div className="space-y-3 flex-1">
        <div className="h-4 bg-slate-200 rounded w-24" />
        <div className="h-8 bg-slate-200 rounded w-16" />
      </div>
      <div className="h-12 w-12 bg-slate-200 rounded-full" />
    </div>
  </div>
));

StatCardSkeleton.displayName = 'StatCardSkeleton';

/**
 * Individual stat card component
 */
const StatCard = memo(({
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
  <div
    className="bg-white rounded-lg shadow-sm border border-slate-200 p-4"
    data-testid={testId}
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-600">{title}</p>
        <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      </div>
      <div className={`p-3 rounded-full ${iconBgColor}`}>
        <Icon className={`h-6 w-6 ${iconColor}`} aria-hidden="true" />
      </div>
    </div>
  </div>
));

StatCard.displayName = 'StatCard';

/**
 * Stats error component with retry button
 */
const StatsError = memo(({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div
    className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8"
    data-testid="stats-error"
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <Trophy className="h-5 w-5 text-red-400 mr-2" aria-hidden="true" />
        <p className="text-red-700">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="inline-flex items-center px-3 py-1 bg-red-100 text-red-700 text-sm font-medium rounded hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
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
    className="flex items-center text-sm text-slate-500 mb-4"
    aria-label="Breadcrumb"
  >
    <Link
      to="/"
      className="flex items-center hover:text-slate-700 transition-colors"
    >
      <Home className="h-4 w-4 mr-1" aria-hidden="true" />
      Home
    </Link>
    <ChevronRight className="h-4 w-4 mx-2" aria-hidden="true" />
    <Link
      to="/profile"
      className="hover:text-slate-700 transition-colors"
    >
      Profile
    </Link>
    <ChevronRight className="h-4 w-4 mx-2" aria-hidden="true" />
    <span className="text-slate-900 font-medium">Prize History</span>
  </nav>
));

Breadcrumbs.displayName = 'Breadcrumbs';

/**
 * Calculate prize statistics from transaction data
 */
const calculateStats = (transactions: Array<{
  prizeMoney: number;
  xpGained: number;
  placement: number;
}>): UserPrizeStats => {
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
  const handleFilterChange = useCallback((newFilters: TransactionFilters) => {
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
  }, [setSearchParams]);

  // Handle retry on error
  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <div className="min-h-screen bg-slate-50" data-testid="prize-history-page">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb Navigation */}
        <Breadcrumbs />

        {/* Page Header */}
        <header className="mb-6 border-b pb-4" data-testid="page-header">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Prize History</h1>
          <p className="text-slate-600">
            View your competition earnings and prize transaction history
          </p>
        </header>

        {/* Error State */}
        {isError && error && (
          <StatsError
            message={error.message || 'Failed to load prize history'}
            onRetry={handleRetry}
          />
        )}

        {/* Summary Statistics */}
        <section
          className="mb-8"
          data-testid="stats-summary"
          aria-label="Prize statistics summary"
        >
          {isLoading ? (
            <div
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
              data-testid="stats-grid"
            >
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </div>
          ) : (
            <div
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
              data-testid="stats-grid"
            >
              <StatCard
                title="Total Prize Money"
                value={formatCurrency(stats.totalPrizeMoney)}
                icon={DollarSign}
                iconBgColor="bg-green-100"
                iconColor="text-green-600"
                testId="stat-total-prize-money"
              />
              <StatCard
                title="Total XP Gained"
                value={stats.totalXpGained}
                icon={Star}
                iconBgColor="bg-blue-100"
                iconColor="text-blue-600"
                testId="stat-total-xp"
              />
              <StatCard
                title="Total Competitions"
                value={stats.totalCompetitions}
                icon={Trophy}
                iconBgColor="bg-purple-100"
                iconColor="text-purple-600"
                testId="stat-total-competitions"
              />
              <StatCard
                title="Win Rate"
                value={`${stats.winRate.toFixed(1)}%`}
                icon={TrendingUp}
                iconBgColor="bg-orange-100"
                iconColor="text-orange-600"
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
            isLoading={isLoading}
          />
        </section>
      </main>
    </div>
  );
};

export default memo(PrizeHistoryPage);
