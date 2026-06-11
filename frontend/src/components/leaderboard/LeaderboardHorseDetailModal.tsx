/**
 * LeaderboardHorseDetailModal Component
 *
 * Full-screen modal overlay displaying detailed horse information from
 * leaderboard entries. Includes horse header, stats with color-coded
 * progress bars, competition history, achievements, owner info, and
 * action buttons.
 *
 * Features:
 * - Built on GameDialog (Equoria-o5hub.13, DECISIONS.md §8): Radix Dialog
 *   provides portal rendering, scroll lock, Escape close, focus trap, and
 *   focus restoration — not re-implemented here
 * - Loading state with skeleton placeholders
 * - Null horse data error state
 * - Accessible dialog role with Radix-wired aria-labelledby
 * - Responsive design (desktop/tablet/mobile)
 *
 * Story 5-5: Leaderboards - Task 4
 */

import { Trophy, User, Award } from 'lucide-react';
import Currency from '@/components/ui/Currency';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
  GameDialogBody,
  GameDialogFooter,
} from '@/components/ui/game/GameDialog';
import { Button } from '@/components/ui/button';
import { StatBar } from '@/components/ui/game/StatBar';

// ---------------------------------------------------------------------------
// TypeScript Interfaces
// ---------------------------------------------------------------------------

/**
 * A single competition result entry for recent competitions display.
 */
export interface CompetitionEntry {
  competitionId: number;
  competitionName: string;
  discipline: string;
  date: string;
  rank: number;
  totalParticipants: number;
  prizeWon: number;
}

/**
 * Full data shape for horse detail display inside the modal.
 */
export interface HorseDetailData {
  horseId: number;
  horseName: string;
  breed: string;
  age: number;
  sex: 'Stallion' | 'Mare' | 'Colt' | 'Filly' | 'Rig';
  level: number;
  stats: {
    speed: number;
    stamina: number;
    agility: number;
    balance: number;
    precision: number;
    intelligence: number;
    boldness: number;
    flexibility: number;
    obedience: number;
    focus: number;
  };
  competitionHistory: {
    total: number;
    wins: number;
    top3Finishes: number;
    winRate: number;
    totalPrizeMoney: number;
    recentCompetitions: CompetitionEntry[];
  };
  owner: {
    ownerId: string;
    ownerName: string;
    stableSize: number;
  };
  achievements: string[];
  primaryDiscipline?: string;
}

/**
 * Props for the LeaderboardHorseDetailModal component.
 */
export interface LeaderboardHorseDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  horseData: HorseDetailData | null;
  isLoading?: boolean;
  onViewFullProfile?: (_horseId: number) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Formats an ISO date string into a readable short format.
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Skeleton placeholder blocks displayed while loading.
 */
const LoadingSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    {/* Header skeleton */}
    <div data-testid="skeleton-block" className="space-y-2">
      <div className="h-8 bg-[var(--bg-twilight)] rounded w-3/4" />
      <div className="h-4 bg-[var(--bg-twilight)] rounded w-1/2" />
    </div>
    {/* Stats skeleton */}
    <div data-testid="skeleton-block" className="space-y-2">
      <div className="h-4 bg-[var(--bg-twilight)] rounded w-full" />
      <div className="h-4 bg-[var(--bg-twilight)] rounded w-full" />
      <div className="h-4 bg-[var(--bg-twilight)] rounded w-5/6" />
      <div className="h-4 bg-[var(--bg-twilight)] rounded w-4/6" />
    </div>
    {/* History skeleton */}
    <div data-testid="skeleton-block" className="space-y-2">
      <div className="h-6 bg-[var(--bg-twilight)] rounded w-1/3" />
      <div className="h-4 bg-[var(--bg-twilight)] rounded w-full" />
      <div className="h-4 bg-[var(--bg-twilight)] rounded w-full" />
    </div>
    {/* Achievements skeleton */}
    <div data-testid="skeleton-block" className="space-y-2">
      <div className="h-6 bg-[var(--bg-twilight)] rounded w-1/4" />
      <div className="flex gap-2">
        <div className="h-8 bg-[var(--bg-twilight)] rounded w-32" />
        <div className="h-8 bg-[var(--bg-twilight)] rounded w-28" />
      </div>
    </div>
  </div>
);

/**
 * Empty state shown when horse data is null and not loading.
 */
const EmptyHorseState = () => (
  <div
    className="flex flex-col items-center justify-center py-16 text-[var(--text-secondary)]"
    data-testid="empty-horse-state"
  >
    <p className="text-lg font-medium">Horse details not available</p>
    <p className="text-sm mt-1">The requested horse information could not be loaded.</p>
  </div>
);

/**
 * Competition summary stat card showing a single metric.
 */
const SummaryStatCard = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-[var(--bg-midnight)] rounded-lg p-3 text-center">
    <div className="text-xl font-bold text-[var(--text-primary)]">{value}</div>
    <div className="text-xs text-[var(--text-secondary)] mt-1">{label}</div>
  </div>
);

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * LeaderboardHorseDetailModal displays a detailed horse profile in a
 * full-screen modal overlay, accessible from leaderboard entries.
 * Radix Dialog (via GameDialog) provides portal rendering, scroll lock,
 * Escape close, and focus management.
 */
const LeaderboardHorseDetailModal = ({
  isOpen,
  onClose,
  horseData,
  isLoading = false,
  onViewFullProfile,
  className = '',
}: LeaderboardHorseDetailModalProps) => {
  // Stat definitions grouped by category
  const physicalStats = ['speed', 'stamina', 'agility', 'balance'] as const;
  const mentalStats = [
    'precision',
    'intelligence',
    'boldness',
    'flexibility',
    'obedience',
    'focus',
  ] as const;

  return (
    <GameDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      {/* No GameDialogDescription: the dialog body is the descriptive content;
          aria-describedby={undefined} suppresses the Radix warning without
          fabricating a summary line. */}
      <GameDialogContent
        size="lg"
        className={className}
        data-testid="horse-detail-modal"
        aria-describedby={undefined}
      >
        <GameDialogHeader>
          <GameDialogTitle>{horseData?.horseName ?? 'Horse Details'}</GameDialogTitle>
        </GameDialogHeader>

        <GameDialogBody>
          {/* Loading State */}
          {isLoading && <LoadingSkeleton />}

          {/* Empty State */}
          {!isLoading && !horseData && <EmptyHorseState />}

          {/* Horse Details */}
          {!isLoading && horseData && (
            <div className="space-y-6">
              {/* --------------------------------------------------------
                Horse Header
            -------------------------------------------------------- */}
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    {horseData.breed} &middot; {horseData.age} years old &middot; {horseData.sex}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--bg-twilight)] text-blue-300"
                      data-testid="level-badge"
                    >
                      Lvl {horseData.level}
                    </span>
                    {horseData.primaryDiscipline && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--bg-midnight)] text-purple-300">
                        {horseData.primaryDiscipline}
                      </span>
                    )}
                  </div>
                </div>
                {/* Owner Info */}
                <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                  <User size={16} aria-hidden="true" />
                  <span>{horseData.owner.ownerName}</span>
                </div>
              </div>

              {/* --------------------------------------------------------
                Stats Section
            -------------------------------------------------------- */}
              <div data-testid="stats-section">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Stats</h3>

                {/* Physical Stats */}
                <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-2">Physical</h4>
                <div className="space-y-2 mb-4">
                  {physicalStats.map((stat) => (
                    <StatBar key={stat} label={stat} value={horseData.stats[stat]} />
                  ))}
                </div>

                {/* Mental Stats */}
                <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-2">Mental</h4>
                <div className="space-y-2">
                  {mentalStats.map((stat) => (
                    <StatBar key={stat} label={stat} value={horseData.stats[stat]} />
                  ))}
                </div>
              </div>

              {/* --------------------------------------------------------
                Competition History Section
            -------------------------------------------------------- */}
              <div data-testid="competition-history-section">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
                  Competition History
                </h3>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <SummaryStatCard
                    label="Total Competitions"
                    value={String(horseData.competitionHistory.total)}
                  />
                  <SummaryStatCard label="Wins" value={String(horseData.competitionHistory.wins)} />
                  <SummaryStatCard
                    label="Top 3 Finishes"
                    value={String(horseData.competitionHistory.top3Finishes)}
                  />
                  <SummaryStatCard
                    label="Win Rate"
                    value={`${horseData.competitionHistory.winRate}%`}
                  />
                </div>

                {/* Total Prize Money */}
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  Total Prize Money:{' '}
                  <span className="font-semibold text-[var(--text-primary)]">
                    <Currency amount={horseData.competitionHistory.totalPrizeMoney} />
                  </span>
                </p>

                {/* Recent Competitions Table */}
                {horseData.competitionHistory.recentCompetitions.length > 0 ? (
                  <div className="overflow-x-auto" data-testid="recent-competitions-table">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[var(--bg-midnight)] text-left text-[var(--text-secondary)]">
                          <th className="px-3 py-2 font-medium">Date</th>
                          <th className="px-3 py-2 font-medium">Competition</th>
                          <th className="px-3 py-2 font-medium">Discipline</th>
                          <th className="px-3 py-2 font-medium text-right">Rank</th>
                          <th className="px-3 py-2 font-medium text-right">Prize</th>
                        </tr>
                      </thead>
                      <tbody>
                        {horseData.competitionHistory.recentCompetitions.map((comp, index) => (
                          <tr
                            key={comp.competitionId}
                            className={index % 2 === 1 ? 'bg-[var(--bg-midnight)]/50' : ''}
                          >
                            <td className="px-3 py-2 whitespace-nowrap text-[var(--text-primary)]">
                              {formatDate(comp.date)}
                            </td>
                            <td className="px-3 py-2 text-[var(--text-primary)]">
                              {comp.competitionName}
                            </td>
                            <td className="px-3 py-2 text-[var(--text-primary)]">
                              {comp.discipline}
                            </td>
                            <td className="px-3 py-2 text-right text-[var(--text-primary)]">
                              {comp.rank}/{comp.totalParticipants}
                            </td>
                            <td className="px-3 py-2 text-right text-[var(--text-primary)]">
                              <Currency amount={comp.prizeWon} showIcon={false} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div
                    className="text-center text-[var(--text-secondary)] py-6"
                    data-testid="no-recent-competitions"
                  >
                    <p>No recent competitions</p>
                  </div>
                )}
              </div>

              {/* --------------------------------------------------------
                Achievements Section
            -------------------------------------------------------- */}
              <div data-testid="achievements-section">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
                  Achievements
                </h3>
                {horseData.achievements.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {horseData.achievements.map((achievement) => (
                      <span
                        key={achievement}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--badge-gold-bg)] text-amber-300 border border-amber-500/30"
                      >
                        <Award size={14} aria-hidden="true" />
                        {achievement}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-secondary)]">No achievements yet</p>
                )}
              </div>
            </div>
          )}
        </GameDialogBody>

        <GameDialogFooter>
          {/* Action hierarchy (DECISIONS.md §5): one gold primary (View Full
              Profile, rightmost), Close = secondary */}
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          {onViewFullProfile && horseData && (
            <Button
              type="button"
              onClick={() => onViewFullProfile(horseData.horseId)}
              data-testid="view-full-profile-button"
            >
              <Trophy size={16} aria-hidden="true" />
              View Full Profile
            </Button>
          )}
        </GameDialogFooter>
      </GameDialogContent>
    </GameDialog>
  );
};

export default LeaderboardHorseDetailModal;
