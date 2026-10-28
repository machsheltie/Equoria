/**
 * Competition browser filters (Equoria-oey96.12).
 *
 * The Arena's discipline, date and entry-fee controls narrow the list of open
 * shows. This is the one place that decides what each choice means; the page
 * applies it and CompetitionList stays presentational.
 *
 * Dates use the game clock (US Eastern, owner ruling 2026-10-09), never the
 * player's own zone. A show is dated by when it stops taking entries
 * (`closeDate`, falling back to the entry deadline, run date, then `date`). A
 * show that has already closed matches no date window.
 *
 * Entry fees are in coins and the three paid buckets do not overlap:
 * free = 0, under100 = 1 to 99, range = 100 to 500, over500 = more than 500.
 */

import { gameDayIndex } from '@/lib/gameTime';

export type DisciplineFilter = 'all' | string;
export type DateRangeFilter = 'all' | 'closing' | 'today' | 'week' | 'month';
export type EntryFeeFilter = 'all' | 'free' | 'under100' | 'range' | 'over500';
/**
 * A show level, 1 to 20 (Equoria-i33ow). The server applies it (GET
 * /api/v1/competition?level=N lists the shows whose bracket holds that level).
 */
export type LevelFilter = 'all' | number;

export interface CompetitionFilterState {
  discipline: DisciplineFilter;
  dateRange: DateRangeFilter;
  entryFee: EntryFeeFilter;
}

/** The fields of a listed show the filters read. */
export interface FilterableCompetition {
  discipline: string;
  entryFee: number;
  closeDate?: string | null;
  entryDeadline?: string | null;
  runDate?: string | null;
  date?: string | null;
}

const msPerHour = 3_600_000;
const weekDays = 7;
const monthDays = 30;

/** 'Show Jumping' and 'show-jumping' name the same discipline. */
function disciplineToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}

/** When the show stops taking entries, or null when the payload carries no usable date. */
export function competitionClosesAt(competition: FilterableCompetition): Date | null {
  const raw =
    competition.closeDate ?? competition.entryDeadline ?? competition.runDate ?? competition.date;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function matchesDateRange(
  competition: FilterableCompetition,
  range: DateRangeFilter,
  now: Date
): boolean {
  if (range === 'all') return true;
  const closesAt = competitionClosesAt(competition);
  if (!closesAt || closesAt.getTime() <= now.getTime()) return false;

  if (range === 'closing') return closesAt.getTime() - now.getTime() <= 24 * msPerHour;

  const daysAway = gameDayIndex(closesAt) - gameDayIndex(now);
  if (range === 'today') return daysAway === 0;
  if (range === 'week') return daysAway < weekDays;
  return daysAway < monthDays;
}

function matchesEntryFee(fee: number, bucket: EntryFeeFilter): boolean {
  switch (bucket) {
    case 'free':
      return fee === 0;
    case 'under100':
      return fee > 0 && fee < 100;
    case 'range':
      return fee >= 100 && fee <= 500;
    case 'over500':
      return fee > 500;
    default:
      return true;
  }
}

export function applyCompetitionFilters<T extends FilterableCompetition>(
  competitions: readonly T[],
  filters: CompetitionFilterState,
  now: Date = new Date()
): T[] {
  const wanted = filters.discipline === 'all' ? null : disciplineToken(filters.discipline);
  return competitions.filter(
    (competition) =>
      (wanted === null || disciplineToken(competition.discipline) === wanted) &&
      matchesDateRange(competition, filters.dateRange, now) &&
      matchesEntryFee(competition.entryFee, filters.entryFee)
  );
}
