/**
 * Competition Components Index
 *
 * Exports all competition-related components for easy importing.
 *
 * Story 5-1: Competition Entry System - Task 3
 */

export { default as CompetitionCard } from './CompetitionCard';
export type { Competition, CompetitionCardProps } from './CompetitionCard';

export { default as CompetitionList } from './CompetitionList';
export type { CompetitionListProps } from './CompetitionList';

export { default as CompetitionDetailModal } from './CompetitionDetailModal';
export type {
  CompetitionDetailModalProps,
  Competition as CompetitionDetail,
} from './CompetitionDetailModal';

export { default as HorseSelectionCard } from './HorseSelectionCard';
export type {
  HorseSelectionCardProps,
  Horse,
  EligibilityStatus,
  RelevantStat,
} from './HorseSelectionCard';

export { default as HorseSelector } from './HorseSelector';
export type { HorseSelectorProps } from './HorseSelector';

export { default as EntryConfirmationModal } from './EntryConfirmationModal';
export type {
  EntryConfirmationModalProps,
  Competition as EntryCompetition,
  SelectedHorse,
} from './EntryConfirmationModal';

export { default as CompetitionResultsList } from './CompetitionResultsList';
export type {
  CompetitionResultsListProps,
  CompetitionResultSummary,
  CompetitionResultsFilters,
  UserResult,
  SortOption,
} from './CompetitionResultsList';

export { default as CompetitionResultsModal } from './CompetitionResultsModal';
export type {
  CompetitionResultsModalProps,
  CompetitionResults,
  ParticipantResult,
} from './CompetitionResultsModal';

export { default as ScoreBreakdownChart } from './ScoreBreakdownChart';
export type {
  ScoreBreakdownChartProps,
  ScoreBreakdown,
  TraitBonus,
} from './ScoreBreakdownChart';

export { default as PerformanceBreakdown } from './PerformanceBreakdown';
export type {
  PerformanceBreakdownProps,
  ScoreBreakdown as PerformanceScoreBreakdown,
  ComparisonData,
} from './PerformanceBreakdown';

export { default as CompetitionHistory } from './CompetitionHistory';
export type {
  CompetitionHistoryProps,
  CompetitionHistoryData,
  CompetitionEntry,
  CompetitionStatistics,
  DateRangeFilter,
  PlacementFilter,
} from './CompetitionHistory';
