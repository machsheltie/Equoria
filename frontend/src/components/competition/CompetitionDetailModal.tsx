/**
 * CompetitionDetailModal Component
 *
 * A modal dialog for displaying detailed competition information:
 * - Competition name, discipline, and description
 * - Event date with calendar icon
 * - Prize pool with breakdown (1st: 50%, 2nd: 30%, 3rd: 20%)
 * - Entry fee display
 * - Entry requirements list
 *
 * Features:
 * - Migrated from BaseModal → GameDialog (Equoria-o5hub.13, DECISIONS.md §8)
 * - Focus trap, scroll lock, Escape close, and focus restoration from Radix Dialog
 * - Responsive design (mobile/tablet/desktop)
 * - WCAG 2.1 AA compliance
 *
 * Story 5-1: Competition Entry System - Task 4
 */

import React, { memo } from 'react';
import { Calendar, Coins, Trophy, Users, AlertCircle } from 'lucide-react';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
  GameDialogBody,
  GameDialogFooter,
} from '@/components/ui/game/GameDialog';
import { Button } from '@/components/ui/button';
import Currency from '@/components/ui/Currency';
import { CompetitionFieldPreview } from './CompetitionFieldPreview';
import type { ShowFieldResponse } from '@/lib/api-client';

/**
 * Competition data structure for the modal
 */
export interface Competition {
  id: number;
  name: string;
  discipline: string;
  date: string;
  prizePool: number;
  entryFee: number;
  description?: string;
  maxParticipants?: number;
  currentParticipants?: number;
  entryRequirements?: string[];
  location?: string;
}

/**
 * CompetitionDetailModal component props
 */
export interface CompetitionDetailModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Competition data to display (null hides modal) */
  competition: Competition | null;
  /** Called with competitionId when user clicks Enter Competition */
  onEnter?: (_competitionId: number) => void;
  /** User-owned horses eligible for entry selection */
  entryHorses?: Array<{ id: number; name: string }>;
  /** Selected horse id for the entry form */
  selectedHorseId?: number | '';
  /** Called when the selected horse changes */
  onSelectedHorseIdChange?: (_horseId: number) => void;
  /** Loading state for entry submission */
  isSubmitting?: boolean;
  /** Error message to display */
  error?: string;
  /**
   * Equoria-lfkw1: the real scouting field for this show, fetched by the
   * container (CompetitionBrowserPage) via useShowField. Kept as a prop so
   * this modal stays presentational (no QueryClient coupling).
   */
  fieldData?: ShowFieldResponse | null;
  /** Loading state of the scouting-field query. */
  fieldLoading?: boolean;
}

/**
 * Coin amount renderer — game currency uses the canonical Currency component
 * (DECISIONS.md §9; no USD formatting). Zero renders as "Free" via Currency's
 * zeroLabel prop (Equoria-o5hub ratchet — replaces the local ternary wrapper).
 */
const CoinAmount = ({ amount }: { amount: number }) => (
  <Currency amount={amount} zeroLabel="Free" />
);

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
 * Calculate prize distribution (50%/30%/20%)
 */
const calculatePrizeDistribution = (
  prizePool: number
): { first: number; second: number; third: number } => {
  return {
    first: Math.floor(prizePool * 0.5),
    second: Math.floor(prizePool * 0.3),
    third: Math.floor(prizePool * 0.2),
  };
};

/**
 * CompetitionDetailModal Component
 *
 * Displays detailed competition information and entry actions.
 * Portal, focus trap, scroll lock, and keyboard handling come from Radix Dialog.
 */
const CompetitionDetailModal = memo(function CompetitionDetailModal({
  isOpen,
  onClose,
  competition,
  onEnter,
  entryHorses = [],
  selectedHorseId = '',
  onSelectedHorseIdChange,
  isSubmitting = false,
  error,
  fieldData = null,
  fieldLoading = false,
}: CompetitionDetailModalProps) {
  // Equoria-lfkw1: scouting field is fetched by the container and passed in
  // as props; this modal stays presentational (no QueryClient coupling, so
  // existing render-only tests keep working).
  const fieldShowId = competition && isOpen ? competition.id : null;

  // Don't render if no competition
  if (!competition && isOpen) {
    return null;
  }

  const prizeDistribution = competition ? calculatePrizeDistribution(competition.prizePool) : null;

  // Map the real backend scouting response into CompetitionFieldPreview's
  // shape (topStats[] → stats record). No fabricated values.
  const fieldPreviewEntries =
    fieldData?.entries.map((e) => ({
      id: e.horseId,
      name: e.name,
      breed: e.breed ?? undefined,
      stats: Object.fromEntries(e.topStats.map((s) => [s.name, s.value])),
    })) ?? [];
  const hasRequirements =
    competition?.entryRequirements && competition.entryRequirements.length > 0;

  const canEnter = onEnter != null && competition != null;

  // Action hierarchy (DECISIONS.md §5): one gold primary per surface —
  // "Enter Competition" is primary; Close is a secondary tier.
  const footerContent = (
    <div className="flex items-center gap-3">
      <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
        Close
      </Button>
      {canEnter && (
        <Button
          type="button"
          data-testid="enter-competition-button"
          onClick={() => onEnter!(competition!.id)}
          disabled={isSubmitting || entryHorses.length === 0 || !selectedHorseId}
          pending={isSubmitting}
        >
          Enter Competition
        </Button>
      )}
    </div>
  );

  return (
    <GameDialog
      open={isOpen}
      onOpenChange={(open) => {
        // Block closing while an entry submission is pending (BaseModal parity)
        if (!open && !isSubmitting) {
          onClose();
        }
      }}
    >
      <GameDialogContent
        size="lg"
        data-testid="competition-detail-modal"
        aria-describedby={competition ? 'competition-modal-description' : undefined}
        onInteractOutside={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
      >
        <GameDialogHeader>
          <GameDialogTitle data-testid="competition-detail-modal-title">
            {competition?.name ?? ''}
          </GameDialogTitle>
        </GameDialogHeader>

        {competition && (
          <GameDialogBody>
            <div className="space-y-6">
              {/* Discipline badge */}
              <span
                className="inline-block px-3 py-1 bg-forest-green/10 text-blue-400 text-sm font-medium rounded-full border border-blue-500/30"
                data-testid="competition-discipline"
              >
                {competition.discipline}
              </span>

              {/* Equoria-lfkw1 — real scouting field (expanded variant in the
              show detail). Sourced from /competition/show/:id/entries. */}
              {fieldShowId !== null && (
                <CompetitionFieldPreview
                  show={{
                    id: competition.id,
                    name: competition.name,
                    discipline: competition.discipline,
                    entryFee: competition.entryFee,
                    maxEntries: fieldData?.maxEntries ?? competition.maxParticipants ?? null,
                    entryCount: fieldData?.entryCount ?? competition.currentParticipants ?? 0,
                    closeDate: fieldData?.show.closeDate ?? null,
                    status: fieldData?.show.status ?? 'open',
                  }}
                  entries={fieldPreviewEntries}
                />
              )}
              {fieldShowId !== null && fieldLoading && !fieldData && (
                <p className="text-xs text-mystic-silver" data-testid="competition-field-loading">
                  Loading the entered field…
                </p>
              )}

              {/* Description */}
              {competition.description && (
                <p
                  id="competition-modal-description"
                  className="text-mystic-silver"
                  data-testid="competition-description"
                >
                  {competition.description}
                </p>
              )}
              {!competition.description && (
                <p id="competition-modal-description" className="sr-only">
                  Competition details for {competition.name}
                </p>
              )}

              {/* Event Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Date */}
                <div
                  className="flex items-center space-x-3 p-3 bg-saddle-leather/50 rounded-lg"
                  data-testid="competition-date"
                >
                  <Calendar className="h-5 w-5 text-mystic-silver" aria-hidden="true" />
                  <div>
                    <p className="text-xs text-mystic-silver uppercase tracking-wider">
                      Event Date
                    </p>
                    <p className="text-midnight-ink font-medium">{formatDate(competition.date)}</p>
                  </div>
                </div>

                {/* Location */}
                {competition.location && (
                  <div className="flex items-center space-x-3 p-3 bg-saddle-leather/50 rounded-lg">
                    <Users className="h-5 w-5 text-mystic-silver" aria-hidden="true" />
                    <div>
                      <p className="text-xs text-mystic-silver uppercase tracking-wider">
                        Location
                      </p>
                      <p className="text-midnight-ink font-medium">{competition.location}</p>
                    </div>
                  </div>
                )}

                {/* Prize Pool */}
                <div
                  className="flex items-center space-x-3 p-3 bg-burnished-gold/10 rounded-lg"
                  data-testid="competition-prize-pool"
                >
                  <Trophy className="h-5 w-5 text-[var(--gold-light)]" aria-hidden="true" />
                  <div>
                    <p className="text-xs text-[var(--gold-light)] uppercase tracking-wider">
                      Total Prize Pool
                    </p>
                    <p className="text-midnight-ink font-bold text-lg">
                      <CoinAmount amount={competition.prizePool} />
                    </p>
                  </div>
                </div>

                {/* Entry Fee */}
                <div
                  className="flex items-center space-x-3 p-3 bg-emerald-500/10 rounded-lg"
                  data-testid="competition-entry-fee"
                >
                  <Coins className="h-5 w-5 text-[var(--gold-light)]" aria-hidden="true" />
                  <div>
                    <p className="text-xs text-[var(--status-success)] uppercase tracking-wider">
                      Entry Fee
                    </p>
                    <p className="text-midnight-ink font-bold text-lg">
                      <CoinAmount amount={competition.entryFee} />
                    </p>
                  </div>
                </div>
              </div>

              {/* Prize Distribution */}
              {prizeDistribution && (
                <div
                  className="bg-burnished-gold/10 border border-amber-500/30 rounded-lg p-4"
                  data-testid="prize-distribution"
                >
                  <h3 className="text-sm font-semibold text-midnight-ink mb-3 flex items-center">
                    <Trophy className="h-4 w-4 text-amber-500 mr-2" aria-hidden="true" />
                    Prize Distribution
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center" data-testid="prize-1st">
                      <div className="text-2xl mb-1">1st</div>
                      <div className="text-[var(--gold-light)] font-bold">
                        <CoinAmount amount={prizeDistribution.first} />
                      </div>
                      <div className="text-xs text-mystic-silver">50%</div>
                    </div>
                    <div className="text-center" data-testid="prize-2nd">
                      <div className="text-2xl mb-1">2nd</div>
                      <div className="text-mystic-silver font-bold">
                        <CoinAmount amount={prizeDistribution.second} />
                      </div>
                      <div className="text-xs text-mystic-silver">30%</div>
                    </div>
                    <div className="text-center" data-testid="prize-3rd">
                      <div className="text-2xl mb-1">3rd</div>
                      <div className="text-orange-600 font-bold">
                        <CoinAmount amount={prizeDistribution.third} />
                      </div>
                      <div className="text-xs text-mystic-silver">20%</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Entry Requirements */}
              <div data-testid="entry-requirements">
                <h3 className="text-sm font-semibold text-midnight-ink mb-2">Entry Requirements</h3>
                {hasRequirements ? (
                  <ul className="space-y-2">
                    {competition.entryRequirements!.map((requirement, index) => (
                      <li key={index} className="flex items-start text-sm text-mystic-silver">
                        <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 mr-2 flex-shrink-0" />
                        {requirement}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-mystic-silver">
                    No specific requirements for this competition.
                  </p>
                )}
              </div>

              {canEnter && (
                <div
                  className="bg-forest-green/10 border border-forest-green/30 rounded-lg p-4"
                  data-testid="competition-entry-form"
                >
                  <label
                    htmlFor="competition-entry-horse"
                    className="text-sm font-semibold text-midnight-ink mb-2 block"
                  >
                    Select horse to enter
                  </label>
                  {entryHorses.length > 0 ? (
                    <select
                      id="competition-entry-horse"
                      data-testid="competition-entry-horse-select"
                      value={selectedHorseId}
                      onChange={(event) =>
                        onSelectedHorseIdChange?.(Number.parseInt(event.target.value, 10))
                      }
                      disabled={isSubmitting}
                      className="w-full rounded-lg border border-forest-green/30 bg-white/80 px-3 py-2 text-sm text-midnight-ink"
                    >
                      <option value="">Choose a horse</option>
                      {entryHorses.map((horse) => (
                        <option key={horse.id} value={horse.id}>
                          {horse.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-mystic-silver">
                      Add a horse to your stable before entering competitions.
                    </p>
                  )}
                </div>
              )}

              {/* Participants Info */}
              {competition.maxParticipants !== undefined && (
                <div className="flex items-center justify-between p-3 bg-saddle-leather/50 rounded-lg">
                  <span className="text-sm text-mystic-silver">Current Participants</span>
                  <span className="font-medium text-midnight-ink">
                    {competition.currentParticipants ?? 0} / {competition.maxParticipants}
                  </span>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div
                  className="flex items-center space-x-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
                  data-testid="error-message"
                >
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" aria-hidden="true" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
            </div>
          </GameDialogBody>
        )}

        <GameDialogFooter>{footerContent}</GameDialogFooter>
      </GameDialogContent>
    </GameDialog>
  );
});

export default CompetitionDetailModal;
