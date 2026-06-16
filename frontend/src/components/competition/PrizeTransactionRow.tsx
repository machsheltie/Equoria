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
import { Trophy, Medal, Star, Calendar, Zap, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Currency from '@/components/ui/Currency';
import { Surface } from '@/components/ui/Surface';

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
  onViewCompetition?: (_competitionId: number) => void;
  onViewHorse?: (_horseId: number) => void;
  /**
   * Equoria-bx52 — claim handler for the unclaimed-prize button.
   * When provided AND the transaction.claimed === false, the row
   * renders a "Claim" button that invokes this callback with the
   * transaction's competitionId. Callers wire this to useClaimPrizes.
   */
  onClaim?: (_competitionId: number) => void;
  /** Disables the Claim button while a claim mutation is in flight. */
  isClaiming?: boolean;
  layout?: 'table' | 'card';
}

// Equoria-2dnd2: date formatting + honest invalid-date fallback now live in the
// shared util (was a duplicated, unguarded component-local formatDate).
import { formatDate } from '@/lib/formatDate';

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
 * Get placement badge styling based on rank.
 *
 * Gold/silver/bronze medal colors are data-categorical (placement medals),
 * not semantic status — kept as explicit values per the DECISIONS.md §7
 * data-visualization exception; non-medal rows use neutral surface tokens.
 */
const getPlacementBadgeClasses = (rank: number): string => {
  switch (rank) {
    case 1:
      return 'bg-[var(--gold-400)] text-[var(--bg-deep-space)]'; // gold medal
    case 2:
      return 'bg-[#c0c4cc] text-[#2a2e36]'; // silver medal (categorical)
    case 3:
      return 'bg-[#cd7f32] text-[#3a2410]'; // bronze medal (categorical)
    default:
      return 'bg-[var(--glass-surface-subtle-bg)] text-[var(--text-secondary)]';
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
 * Claim button (Equoria-bx52)
 *
 * Renders for unclaimed prizes only. Wires its onClick to the parent's
 * onClaim(competitionId) handler — the parent should pass through to
 * useClaimPrizes from @/hooks/api/useClaimPrizes.
 */
const ClaimButton = memo(
  ({
    competitionId,
    onClaim,
    isClaiming,
  }: {
    competitionId: number;
    onClaim: (_competitionId: number) => void;
    isClaiming?: boolean;
  }) => {
    const handleClick = useCallback(() => {
      onClaim(competitionId);
    }, [competitionId, onClaim]);

    return (
      <Button
        type="button"
        size="sm"
        onClick={handleClick}
        disabled={isClaiming}
        data-testid="claim-prize-button"
        aria-label="Claim prize"
      >
        <Gift className="h-3.5 w-3.5" aria-hidden="true" />
        {isClaiming ? 'Claiming…' : 'Claim'}
      </Button>
    );
  }
);

ClaimButton.displayName = 'ClaimButton';

/**
 * Table row layout for desktop
 */
const TableRowLayout = memo(
  ({
    transaction,
    onViewCompetition,
    onViewHorse,
    onClaim,
    isClaiming,
  }: Omit<PrizeTransactionRowProps, 'layout'>) => {
    const handleCompetitionClick = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        onViewCompetition?.(transaction.competitionId);
      },
      [onViewCompetition, transaction.competitionId]
    );

    const handleHorseClick = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        onViewHorse?.(transaction.horseId);
      },
      [onViewHorse, transaction.horseId]
    );

    const handleCompetitionKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onViewCompetition?.(transaction.competitionId);
        }
      },
      [onViewCompetition, transaction.competitionId]
    );

    const handleHorseKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onViewHorse?.(transaction.horseId);
        }
      },
      [onViewHorse, transaction.horseId]
    );

    return (
      <tr
        className="border-b border-[var(--glass-border)] hover:bg-[var(--glass-surface-subtle-bg)] transition-colors"
        data-testid="prize-transaction-row"
        data-layout="table"
      >
        {/* Date */}
        <td className="px-4 py-3 whitespace-nowrap">
          <span
            className="text-sm text-role-muted flex items-center gap-1"
            data-testid="transaction-date"
          >
            <Calendar className="h-4 w-4" aria-hidden="true" />
            {formatDate(transaction.date)}
          </span>
        </td>

        {/* Competition */}
        <td className="px-4 py-3">
          <button
            onClick={handleCompetitionClick}
            onKeyDown={handleCompetitionKeyDown}
            className="text-sm font-medium text-role-link hover:text-[var(--gold-bright)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--gold-bright)] focus:ring-offset-2 rounded"
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
            className="text-sm font-medium text-role-link hover:text-[var(--gold-bright)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--gold-bright)] focus:ring-offset-2 rounded"
            data-testid="horse-link"
            aria-label={`View horse: ${transaction.horseName}`}
          >
            {transaction.horseName}
          </button>
        </td>

        {/* Discipline */}
        <td className="px-4 py-3">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-sm)] text-xs font-medium bg-[var(--badge-info-bg)] text-[var(--status-info)]"
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
            className="text-sm font-medium text-[var(--role-success-text)] flex items-center justify-end gap-1"
            data-testid="prize-money"
          >
            <Currency amount={transaction.prizeMoney} />
          </span>
        </td>

        {/* XP */}
        <td className="px-4 py-3 text-right">
          <span
            className="text-sm font-medium text-[var(--status-rare)] flex items-center justify-end gap-1"
            data-testid="xp-gained"
          >
            <Zap className="h-4 w-4" aria-hidden="true" />
            {formatNumber(transaction.xpGained)}
            <span className="text-role-muted font-normal">XP</span>
          </span>
        </td>

        {/* Claim — Equoria-bx52. Renders only when onClaim is provided
            AND the prize is unclaimed. */}
        {onClaim && !transaction.claimed && (
          <td className="px-4 py-3 text-right">
            <ClaimButton
              competitionId={transaction.competitionId}
              onClaim={onClaim}
              isClaiming={isClaiming}
            />
          </td>
        )}
      </tr>
    );
  }
);

TableRowLayout.displayName = 'TableRowLayout';

/**
 * Card layout for mobile
 */
const CardLayout = memo(
  ({
    transaction,
    onViewCompetition,
    onViewHorse,
    onClaim,
    isClaiming,
  }: Omit<PrizeTransactionRowProps, 'layout'>) => {
    const handleCompetitionClick = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        onViewCompetition?.(transaction.competitionId);
      },
      [onViewCompetition, transaction.competitionId]
    );

    const handleHorseClick = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        onViewHorse?.(transaction.horseId);
      },
      [onViewHorse, transaction.horseId]
    );

    const handleCompetitionKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onViewCompetition?.(transaction.competitionId);
        }
      },
      [onViewCompetition, transaction.competitionId]
    );

    const handleHorseKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onViewHorse?.(transaction.horseId);
        }
      },
      [onViewHorse, transaction.horseId]
    );

    return (
      <Surface
        variant="subtle"
        className="p-4 mb-3"
        data-testid="prize-transaction-row"
        data-layout="card"
      >
        {/* Header Row */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <button
              onClick={handleCompetitionClick}
              onKeyDown={handleCompetitionKeyDown}
              className="text-base font-semibold text-role-link hover:text-[var(--gold-bright)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--gold-bright)] rounded"
              data-testid="competition-link"
              aria-label={`View competition: ${transaction.competitionName}`}
            >
              {transaction.competitionName}
            </button>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="text-xs text-role-muted flex items-center gap-1"
                data-testid="transaction-date"
              >
                <Calendar className="h-3 w-3" aria-hidden="true" />
                {formatDate(transaction.date)}
              </span>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-sm)] text-xs font-medium bg-[var(--badge-info-bg)] text-[var(--status-info)]"
                data-testid="discipline-badge"
              >
                {transaction.discipline}
              </span>
            </div>
          </div>
          <PlacementBadge rank={transaction.placement} />
        </div>

        {/* Horse and Details Row */}
        <div className="flex items-center justify-between border-t border-[var(--glass-border)] pt-3">
          <div>
            <span className="text-xs text-role-muted">Horse: </span>
            <button
              onClick={handleHorseClick}
              onKeyDown={handleHorseKeyDown}
              className="text-sm font-medium text-role-link hover:text-[var(--gold-bright)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--gold-bright)] rounded"
              data-testid="horse-link"
              aria-label={`View horse: ${transaction.horseName}`}
            >
              {transaction.horseName}
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* Prize Money */}
            <span
              className="text-sm font-medium text-[var(--role-success-text)] flex items-center gap-1"
              data-testid="prize-money"
            >
              <Currency amount={transaction.prizeMoney} />
            </span>

            {/* XP */}
            <span
              className="text-sm font-medium text-[var(--status-rare)] flex items-center gap-1"
              data-testid="xp-gained"
            >
              <Zap className="h-4 w-4" aria-hidden="true" />
              {formatNumber(transaction.xpGained)}
              <span className="text-role-muted font-normal">XP</span>
            </span>
          </div>
        </div>

        {/* Claim — Equoria-bx52. Renders only when onClaim is provided
            AND the prize is unclaimed. */}
        {onClaim && !transaction.claimed && (
          <div className="mt-3 flex justify-end">
            <ClaimButton
              competitionId={transaction.competitionId}
              onClaim={onClaim}
              isClaiming={isClaiming}
            />
          </div>
        )}
      </Surface>
    );
  }
);

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
  onClaim,
  isClaiming,
  layout = 'table',
}) => {
  if (layout === 'card') {
    return (
      <CardLayout
        transaction={transaction}
        onViewCompetition={onViewCompetition}
        onViewHorse={onViewHorse}
        onClaim={onClaim}
        isClaiming={isClaiming}
      />
    );
  }

  return (
    <TableRowLayout
      transaction={transaction}
      onViewCompetition={onViewCompetition}
      onViewHorse={onViewHorse}
      onClaim={onClaim}
      isClaiming={isClaiming}
    />
  );
};

export default memo(PrizeTransactionRow);
