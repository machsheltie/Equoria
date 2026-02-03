/**
 * LeaderboardHorseDetailModal Component
 *
 * Full-screen modal overlay displaying detailed horse information from
 * leaderboard entries. Includes horse header, stats with color-coded
 * progress bars, competition history, achievements, owner info, and
 * action buttons.
 *
 * Features:
 * - Modal overlay with backdrop click to close
 * - Escape key to close
 * - Body scroll lock when open
 * - Loading state with skeleton placeholders
 * - Null horse data error state
 * - Accessible dialog role with aria-modal and aria-labelledby
 * - Focus trap via aria-modal
 * - Responsive design (desktop/tablet/mobile)
 *
 * Story 5-5: Leaderboards - Task 4
 */

import { useEffect, useCallback } from 'react';
import { X, Trophy, User, Award } from 'lucide-react';

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
  sex: 'Stallion' | 'Mare' | 'Gelding';
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
 * Returns a Tailwind background color class based on stat value.
 * Green for high (80+), yellow for medium (50-79), red for low (<50).
 */
function getStatColorClass(value: number): string {
  if (value >= 80) return 'bg-green-500';
  if (value >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}

/**
 * Formats a number as USD currency without decimal places.
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
}

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
      <div className="h-8 bg-gray-200 rounded w-3/4" />
      <div className="h-4 bg-gray-200 rounded w-1/2" />
    </div>
    {/* Stats skeleton */}
    <div data-testid="skeleton-block" className="space-y-2">
      <div className="h-4 bg-gray-200 rounded w-full" />
      <div className="h-4 bg-gray-200 rounded w-full" />
      <div className="h-4 bg-gray-200 rounded w-5/6" />
      <div className="h-4 bg-gray-200 rounded w-4/6" />
    </div>
    {/* History skeleton */}
    <div data-testid="skeleton-block" className="space-y-2">
      <div className="h-6 bg-gray-200 rounded w-1/3" />
      <div className="h-4 bg-gray-200 rounded w-full" />
      <div className="h-4 bg-gray-200 rounded w-full" />
    </div>
    {/* Achievements skeleton */}
    <div data-testid="skeleton-block" className="space-y-2">
      <div className="h-6 bg-gray-200 rounded w-1/4" />
      <div className="flex gap-2">
        <div className="h-8 bg-gray-200 rounded w-32" />
        <div className="h-8 bg-gray-200 rounded w-28" />
      </div>
    </div>
  </div>
);

/**
 * Empty state shown when horse data is null and not loading.
 */
const EmptyHorseState = () => (
  <div
    className="flex flex-col items-center justify-center py-16 text-gray-500"
    data-testid="empty-horse-state"
  >
    <p className="text-lg font-medium">Horse details not available</p>
    <p className="text-sm mt-1">The requested horse information could not be loaded.</p>
  </div>
);

/**
 * A single stat row with label, value, and color-coded progress bar.
 */
const StatBar = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-center gap-3">
    <span className="w-24 text-sm text-gray-600 capitalize">{label}</span>
    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${getStatColorClass(value)}`}
        style={{ width: `${Math.min(value, 100)}%` }}
        data-testid="stat-progress-bar"
      />
    </div>
    <span className="w-8 text-sm font-medium text-gray-700 text-right">{value}</span>
  </div>
);

/**
 * Competition summary stat card showing a single metric.
 */
const SummaryStatCard = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-gray-50 rounded-lg p-3 text-center">
    <div className="text-xl font-bold text-gray-900">{value}</div>
    <div className="text-xs text-gray-500 mt-1">{label}</div>
  </div>
);

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * LeaderboardHorseDetailModal displays a detailed horse profile in a
 * full-screen modal overlay, accessible from leaderboard entries.
 */
const LeaderboardHorseDetailModal = ({
  isOpen,
  onClose,
  horseData,
  isLoading = false,
  onViewFullProfile,
  className = '',
}: LeaderboardHorseDetailModalProps) => {
  // -------------------------------------------------------------------------
  // Escape key handler
  // -------------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  // -------------------------------------------------------------------------
  // Body scroll lock and keyboard listener
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  // Do not render anything when the modal is closed
  if (!isOpen) {
    return null;
  }

  // -------------------------------------------------------------------------
  // Backdrop click handler (only fires on the backdrop itself)
  // -------------------------------------------------------------------------
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // -------------------------------------------------------------------------
  // Stat definitions grouped by category
  // -------------------------------------------------------------------------
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
    <div data-testid="horse-detail-modal">
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        data-testid="modal-backdrop"
        onClick={handleBackdropClick}
      >
        {/* Dialog */}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="horse-detail-title"
          className={`relative bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto mx-4 ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            onClick={onClose}
            data-testid="modal-close-button"
            aria-label="Close horse details"
          >
            <X size={24} aria-hidden="true" />
          </button>

          {/* Modal Content */}
          <div className="p-6 md:p-8">
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
                    <h2
                      id="horse-detail-title"
                      className="text-3xl font-bold text-gray-800"
                    >
                      {horseData.horseName}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {horseData.breed} &middot; {horseData.age} years old &middot;{' '}
                      {horseData.sex}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800"
                        data-testid="level-badge"
                      >
                        Lvl {horseData.level}
                      </span>
                      {horseData.primaryDiscipline && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {horseData.primaryDiscipline}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Owner Info */}
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <User size={16} aria-hidden="true" />
                    <span>{horseData.owner.ownerName}</span>
                  </div>
                </div>

                {/* --------------------------------------------------------
                    Stats Section
                -------------------------------------------------------- */}
                <div data-testid="stats-section">
                  <h3 className="text-lg font-semibold text-gray-700 mb-3">Stats</h3>

                  {/* Physical Stats */}
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Physical</h4>
                  <div className="space-y-2 mb-4">
                    {physicalStats.map((stat) => (
                      <StatBar
                        key={stat}
                        label={stat}
                        value={horseData.stats[stat]}
                      />
                    ))}
                  </div>

                  {/* Mental Stats */}
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Mental</h4>
                  <div className="space-y-2">
                    {mentalStats.map((stat) => (
                      <StatBar
                        key={stat}
                        label={stat}
                        value={horseData.stats[stat]}
                      />
                    ))}
                  </div>
                </div>

                {/* --------------------------------------------------------
                    Competition History Section
                -------------------------------------------------------- */}
                <div data-testid="competition-history-section">
                  <h3 className="text-lg font-semibold text-gray-700 mb-3">
                    Competition History
                  </h3>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <SummaryStatCard
                      label="Total Competitions"
                      value={String(horseData.competitionHistory.total)}
                    />
                    <SummaryStatCard
                      label="Wins"
                      value={String(horseData.competitionHistory.wins)}
                    />
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
                  <p className="text-sm text-gray-600 mb-4">
                    Total Prize Money:{' '}
                    <span className="font-semibold text-gray-800">
                      {formatCurrency(horseData.competitionHistory.totalPrizeMoney)}
                    </span>
                  </p>

                  {/* Recent Competitions Table */}
                  {horseData.competitionHistory.recentCompetitions.length > 0 ? (
                    <div
                      className="overflow-x-auto"
                      data-testid="recent-competitions-table"
                    >
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-left text-gray-600">
                            <th className="px-3 py-2 font-medium">Date</th>
                            <th className="px-3 py-2 font-medium">Competition</th>
                            <th className="px-3 py-2 font-medium">Discipline</th>
                            <th className="px-3 py-2 font-medium text-right">Rank</th>
                            <th className="px-3 py-2 font-medium text-right">Prize</th>
                          </tr>
                        </thead>
                        <tbody>
                          {horseData.competitionHistory.recentCompetitions.map(
                            (comp, index) => (
                              <tr
                                key={comp.competitionId}
                                className={index % 2 === 1 ? 'bg-gray-50' : ''}
                              >
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {formatDate(comp.date)}
                                </td>
                                <td className="px-3 py-2">{comp.competitionName}</td>
                                <td className="px-3 py-2">{comp.discipline}</td>
                                <td className="px-3 py-2 text-right">
                                  {comp.rank}/{comp.totalParticipants}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {formatCurrency(comp.prizeWon)}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div
                      className="text-center text-gray-400 py-6"
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
                  <h3 className="text-lg font-semibold text-gray-700 mb-3">
                    Achievements
                  </h3>
                  {horseData.achievements.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {horseData.achievements.map((achievement) => (
                        <span
                          key={achievement}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200"
                        >
                          <Award size={14} aria-hidden="true" />
                          {achievement}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No achievements yet</p>
                  )}
                </div>

                {/* --------------------------------------------------------
                    Action Buttons
                -------------------------------------------------------- */}
                <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                  {onViewFullProfile && (
                    <button
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                      onClick={() => onViewFullProfile(horseData.horseId)}
                      data-testid="view-full-profile-button"
                    >
                      <Trophy size={16} aria-hidden="true" />
                      View Full Profile
                    </button>
                  )}
                  <button
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                    onClick={onClose}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardHorseDetailModal;
