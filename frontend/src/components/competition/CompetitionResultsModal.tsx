/**
 * CompetitionResultsModal Component
 *
 * A modal dialog for displaying full competition results with rankings table:
 * - Competition name, discipline, date, and participant count
 * - Prize pool and distribution breakdown (50%/30%/20%)
 * - Full rankings table with all participants
 * - User's horse(s) highlighted with different background
 * - Top 3 rows with gold/silver/bronze placement badges
 * - Sortable columns (rank, score, horse name, owner name)
 * - Your own horses' rows highlighted (no score breakdown: owner ruling R5, Equoria-q4uem.10)
 * - PrizeSummaryCard showing user's prizes when applicable (Story 5-3)
 * - PrizeNotificationModal for first-time prize notifications (Story 5-3)
 * - Link to prize history page in footer (Story 5-3)
 *
 * Owner ruling R7 (2026-10-15, Equoria-q4uem.10) removed the invented Story 5-4
 * parts: the XP Progress column, horse level badges, the prize-derived "XP",
 * the XP gain notification and the level-up celebration.
 *
 * Structure (Equoria-a1thh): this file is the container. The fetch, sort and prize
 * state live in results/useCompetitionResultsModal; the markup lives in
 * results/ResultsSummary and results/ResultsRankings.
 *
 * Features:
 * - Migrated from BaseModal → GameDialog (Equoria-o5hub.13, DECISIONS.md §8)
 * - Focus trap, scroll lock, Escape close, and focus restoration from Radix Dialog
 * - Responsive design (table collapses to cards on mobile)
 * - WCAG 2.1 AA compliance
 * - Virtual scrolling ready for large datasets
 *
 * Story 5-2: Competition Results Display
 * Story 5-3: Competition History - Task 7 (Integration with Results Display)
 */

import React, { memo, useCallback } from 'react';
import { Link } from 'react-router';
import { History } from 'lucide-react';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
  GameDialogBody,
  GameDialogFooter,
} from '@/components/ui/game/GameDialog';
import { Button } from '@/components/ui/button';
import PrizeSummaryCard from './PrizeSummaryCard';
import PrizeNotificationModal from './PrizeNotificationModal';
import ResultsRankings from './results/ResultsRankings';
import ResultsSummary from './results/ResultsSummary';
import { useCompetitionResultsModal } from './results/useCompetitionResultsModal';

/**
 * CompetitionResultsModal component props
 */
export interface CompetitionResultsModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Competition ID to fetch results for */
  competitionId: number | null;
  /** Callback for retrying data fetch on error */
  onRetry?: () => void;
  /** Callback when modal first opened with prizes (Story 5-3) */
  onFirstView?: () => void;
  /** Control prize notification display (Story 5-3) */
  showPrizeNotification?: boolean;
  /** Callback when prize notification is closed (Story 5-3) */
  onPrizeNotificationClose?: () => void;
}

/**
 * CompetitionResultsModal Component
 *
 * Displays full competition results with a sortable rankings table.
 * Portal, focus trap, scroll lock, and keyboard handling come from Radix Dialog.
 */
const CompetitionResultsModal = memo(function CompetitionResultsModal({
  isOpen,
  onClose,
  competitionId,
  onRetry,
  onFirstView,
  showPrizeNotification = false,
  onPrizeNotificationClose,
}: CompetitionResultsModalProps) {
  const {
    results,
    isLoading,
    error,
    rows,
    sortField,
    sortDirection,
    handleSort,
    userPrizes,
    hasUserPrizes,
    bestPrize,
    isPrizeExpanded,
    togglePrizeSummary,
  } = useCompetitionResultsModal({ isOpen, competitionId, onFirstView });

  // Handle prize notification close
  const handlePrizeNotificationClose = useCallback(() => {
    onPrizeNotificationClose?.();
  }, [onPrizeNotificationClose]);

  const footerContent = (
    <div className="flex justify-between items-center w-full">
      {/* Prize History Link - Story 5-3 */}
      <Link
        to="/prizes"
        className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
      >
        <History className="h-4 w-4" aria-hidden="true" />
        Prize History
      </Link>
      <Button type="button" variant="secondary" onClick={onClose}>
        Close
      </Button>
    </div>
  );

  return (
    <>
      <GameDialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            onClose();
          }
        }}
      >
        <GameDialogContent
          size="xl"
          data-testid="competition-results-modal"
          aria-describedby={undefined}
        >
          <GameDialogHeader>
            <GameDialogTitle variant="ceremonial">
              {results?.competitionName ?? 'Competition Results'}
            </GameDialogTitle>
          </GameDialogHeader>

          <GameDialogBody>
            <div className="space-y-6">
              <ResultsSummary results={results} />

              {/* Results table / loading / error / empty */}
              <ResultsRankings
                isLoading={isLoading}
                error={error}
                onRetry={onRetry}
                rows={rows}
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
              />

              {/* Prize Summary Card - Story 5-3: Show when user has prizes */}
              {hasUserPrizes && results?.competitionName && results.date && (
                <div className="mt-2">
                  <PrizeSummaryCard
                    competitionId={results.competitionId}
                    competitionName={results.competitionName}
                    date={results.date}
                    prizes={userPrizes}
                    isExpanded={isPrizeExpanded}
                    onToggleExpand={togglePrizeSummary}
                  />
                </div>
              )}
            </div>
          </GameDialogBody>

          <GameDialogFooter>{footerContent}</GameDialogFooter>
        </GameDialogContent>
      </GameDialog>

      {/* Prize Notification Modal - Story 5-3 */}
      {showPrizeNotification && bestPrize && (
        <PrizeNotificationModal
          isOpen={showPrizeNotification}
          onClose={handlePrizeNotificationClose}
          prizeData={bestPrize}
          autoDismiss={false}
        />
      )}
    </>
  );
});

export default CompetitionResultsModal;
