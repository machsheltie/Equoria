/**
 * PrizeTransactionRow Component
 *
 * Displays a single prize transaction in either table row or card format.
 * Features:
 * - Table row layout for desktop views
 * - Card layout for mobile views
 * - Color-coded placement badges (gold/silver/bronze)
 * - Clickable competition and horse names
 * - Currency and date formatting
 * - WCAG 2.1 AA accessibility compliant
 *
 * Story 5-3: Competition History Display - Task 3
 */

import React, { memo, useCallback } from 'react';
import {
  Trophy,
  Medal,
  Star,
  Calendar,
  DollarSign,
  Zap,
} from 'lucide-react';

/**
 * Prize transaction data structure
 */
export interface PrizeTransaction {
  transactionId: string;
  date: string;
  competitionId: number;
  competitionName: string;
  horseId: number;
  horseName: string;
  discipline: string;
  placement: number;
  prizeMoney: number;
  xpGained: number;
  claimed: boolean;
  claimedAt?: string;
}

/**
 * PrizeTransactionRow component props
 */
export interface PrizeTransactionRowProps {
  transaction: PrizeTransaction;
  onViewCompetition?: (competitionId: number) => void;
  onViewHorse?: (horseId: number) => void;
  layout?: 'table' | 'card';
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
 * Format date for display
 */
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Format number with thousands separator
 */
const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-US').format(num);
};

/**
 * Get ordinal suffix for a number
 */
const getOrdinalSuffix = (n: number): string => {
  if (n === 0) return '-';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/**
 * Get placement badge styling based on rank
 */
const getPlacementBadgeClasses = (rank: number): string => {
  switch (rank) {
    case 1:
      return 'bg-yellow-400 text-yellow-900';
    case 2:
      return 'bg-gray-300 text-gray-900';
    case 3:
      return 'bg-orange-400 text-orange-900';
    default:
      return 'bg-slate-200 text-slate-700';
  }
};

/**
 * Placement icon component based on rank
 */
const PlacementIcon = memo(({ rank }: { rank: number }) => {
  if (rank === 1) {
    return <Trophy className="h-3 w-3" aria-hidden="true" />;
  }
  if (rank === 2 || rank === 3) {
    return <Medal className="h-3 w-3" aria-hidden="true" />;
  }
  return <Star className="h-3 w-3" aria-hidden="true" />;
});

PlacementIcon.displayName = 'PlacementIcon';

/**
 * Placement badge component
 */
const PlacementBadge = memo(({ rank }: { rank: number }) => {
  const badgeClasses = getPlacementBadgeClasses(rank);

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${badgeClasses}`}
      data-testid="placement-badge"
    >
      <PlacementIcon rank={rank} />
      {getOrdinalSuffix(rank)}
    </span>
  );
});

PlacementBadge.displayName = 'PlacementBadge';

/**
 * Table row layout for desktop
 */
const TableRowLayout = memo(({
  transaction,
  onViewCompetition,
  onViewHorse,
}: Omit<PrizeTransactionRowProps, 'layout'>) => {
  const handleCompetitionClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onViewCompetition?.(transaction.competitionId);
  }, [onViewCompetition, transaction.competitionId]);

  const handleHorseClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onViewHorse?.(transaction.horseId);
  }, [onViewHorse, transaction.horseId]);

  const handleCompetitionKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onViewCompetition?.(transaction.competitionId);
    }
  }, [onViewCompetition, transaction.competitionId]);

  const handleHorseKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onViewHorse?.(transaction.horseId);
    }
  }, [onViewHorse, transaction.horseId]);

  return (
    <tr
      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
      data-testid="prize-transaction-row"
      data-layout="table"
    >
      {/* Date */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span
          className="text-sm text-slate-600 flex items-center gap-1"
          data-testid="transaction-date"
        >
          <Calendar className="h-4 w-4 text-slate-400" aria-hidden="true" />
          {formatDate(transaction.date)}
        </span>
      </td>

      {/* Competition */}
      <td className="px-4 py-3">
        <button
          onClick={handleCompetitionClick}
          onKeyDown={handleCompetitionKeyDown}
          className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
          data-testid="competition-link"
          aria-label={`View competition: ${transaction.competitionName}`}
        >
          {transaction.competitionName}
        </button>
      </td>

      {/* Horse */}
      <td className="px-4 py-3">
        <button
          onClick={handleHorseClick}
          onKeyDown={handleHorseKeyDown}
          className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
          data-testid="horse-link"
          aria-label={`View horse: ${transaction.horseName}`}
        >
          {transaction.horseName}
        </button>
      </td>

      {/* Discipline */}
      <td className="px-4 py-3">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
          data-testid="discipline-badge"
        >
          {transaction.discipline}
        </span>
      </td>

      {/* Placement */}
      <td className="px-4 py-3 text-center">
        <PlacementBadge rank={transaction.placement} />
      </td>

      {/* Prize Money */}
      <td className="px-4 py-3 text-right">
        <span
          className="text-sm font-medium text-green-600 flex items-center justify-end gap-1"
          data-testid="prize-money"
        >
          <DollarSign className="h-4 w-4" aria-hidden="true" />
          {formatCurrency(transaction.prizeMoney).replace('$', '')}
        </span>
      </td>

      {/* XP */}
      <td className="px-4 py-3 text-right">
        <span
          className="text-sm font-medium text-purple-600 flex items-center justify-end gap-1"
          data-testid="xp-gained"
        >
          <Zap className="h-4 w-4" aria-hidden="true" />
          {formatNumber(transaction.xpGained)}
          <span className="text-slate-500 font-normal">XP</span>
        </span>
      </td>
    </tr>
  );
});

TableRowLayout.displayName = 'TableRowLayout';

/**
 * Card layout for mobile
 */
const CardLayout = memo(({
  transaction,
  onViewCompetition,
  onViewHorse,
}: Omit<PrizeTransactionRowProps, 'layout'>) => {
  const handleCompetitionClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onViewCompetition?.(transaction.competitionId);
  }, [onViewCompetition, transaction.competitionId]);

  const handleHorseClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onViewHorse?.(transaction.horseId);
  }, [onViewHorse, transaction.horseId]);

  const handleCompetitionKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onViewCompetition?.(transaction.competitionId);
    }
  }, [onViewCompetition, transaction.competitionId]);

  const handleHorseKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onViewHorse?.(transaction.horseId);
    }
  }, [onViewHorse, transaction.horseId]);

  return (
    <div
      className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-3"
      data-testid="prize-transaction-row"
      data-layout="card"
    >
      {/* Header Row */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <button
            onClick={handleCompetitionClick}
            onKeyDown={handleCompetitionKeyDown}
            className="text-base font-semibold text-blue-600 hover:text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            data-testid="competition-link"
            aria-label={`View competition: ${transaction.competitionName}`}
          >
            {transaction.competitionName}
          </button>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-xs text-slate-500 flex items-center gap-1"
              data-testid="transaction-date"
            >
              <Calendar className="h-3 w-3" aria-hidden="true" />
              {formatDate(transaction.date)}
            </span>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
              data-testid="discipline-badge"
            >
              {transaction.discipline}
            </span>
          </div>
        </div>
        <PlacementBadge rank={transaction.placement} />
      </div>

      {/* Horse and Details Row */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
        <div>
          <span className="text-xs text-slate-500">Horse: </span>
          <button
            onClick={handleHorseClick}
            onKeyDown={handleHorseKeyDown}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            data-testid="horse-link"
            aria-label={`View horse: ${transaction.horseName}`}
          >
            {transaction.horseName}
          </button>
        </div>

        <div className="flex items-center gap-4">
          {/* Prize Money */}
          <span
            className="text-sm font-medium text-green-600 flex items-center gap-1"
            data-testid="prize-money"
          >
            <DollarSign className="h-4 w-4" aria-hidden="true" />
            {formatCurrency(transaction.prizeMoney).replace('$', '')}
          </span>

          {/* XP */}
          <span
            className="text-sm font-medium text-purple-600 flex items-center gap-1"
            data-testid="xp-gained"
          >
            <Zap className="h-4 w-4" aria-hidden="true" />
            {formatNumber(transaction.xpGained)}
            <span className="text-slate-500 font-normal">XP</span>
          </span>
        </div>
      </div>
    </div>
  );
});

CardLayout.displayName = 'CardLayout';

/**
 * PrizeTransactionRow Component
 *
 * Renders a single prize transaction in either table row or card format.
 * Supports responsive layouts and clickable links for navigation.
 */
const PrizeTransactionRow: React.FC<PrizeTransactionRowProps> = ({
  transaction,
  onViewCompetition,
  onViewHorse,
  layout = 'table',
}) => {
  if (layout === 'card') {
    return (
      <CardLayout
        transaction={transaction}
        onViewCompetition={onViewCompetition}
        onViewHorse={onViewHorse}
      />
    );
  }

  return (
    <TableRowLayout
      transaction={transaction}
      onViewCompetition={onViewCompetition}
      onViewHorse={onViewHorse}
    />
  );
};

export default memo(PrizeTransactionRow);
