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
