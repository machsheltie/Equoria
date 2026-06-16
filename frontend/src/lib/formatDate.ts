/**
 * Shared date-formatting utilities with an honest invalid-date fallback
 * (Equoria-2dnd2 — consolidation of the 7+ duplicated component-local
 * `formatDate` helpers).
 *
 * THE DEFECT CLASS THIS CLOSES (Equoria-2bpd9 / krjw5 / f19cz):
 *   `new Date(x).toLocaleDateString()` where `x` is null / undefined / '' or a
 *   non-parseable string yields an Invalid Date whose toLocale* output is the
 *   literal string "Invalid Date" — a lie rendered into the UI. Every caller
 *   was open-coding the same null + isNaN guard (or, in the unguarded sites,
 *   shipping the "Invalid Date" leak). Routing all callers through these
 *   helpers means the guard exists in exactly ONE place.
 *
 * Pass an explicit `options` to match a component's prior format; the defaults
 * cover the two dominant shapes (date-only "Jan 5, 2026" and date+time).
 */

/** The honest fallback rendered when a date is absent or unparseable. */
export const DATE_UNAVAILABLE = 'Date unavailable';

export type DateInput = string | number | Date | null | undefined;

/** Default date-only format: "Jan 5, 2026" (the dominant pre-consolidation shape). */
export const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

/** Default date+time format: "Jan 5, 2026, 3:04 PM". */
export const DEFAULT_DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
};

/** Default time-only format: "3:04 PM". */
export const DEFAULT_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
};

/**
 * Parse a date input into a valid Date, or null if it is absent / unparseable.
 * The single chokepoint the whole module's invalid-date safety flows through.
 */
export function toValidDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

/**
 * Format a date value as a date-only string, returning `fallback` for an
 * absent / invalid date instead of the literal "Invalid Date".
 */
export function formatDate(
  value: DateInput,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS,
  fallback: string = DATE_UNAVAILABLE,
  locale: string = 'en-US'
): string {
  const date = toValidDate(value);
  return date ? date.toLocaleDateString(locale, options) : fallback;
}

/**
 * Format a date value as a date+time string, returning `fallback` for an
 * absent / invalid date instead of the literal "Invalid Date".
 */
export function formatDateTime(
  value: DateInput,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATETIME_OPTIONS,
  fallback: string = DATE_UNAVAILABLE,
  locale: string = 'en-US'
): string {
  const date = toValidDate(value);
  return date ? date.toLocaleString(locale, options) : fallback;
}

/**
 * Format a date value as a time-only string, returning `fallback` for an
 * absent / invalid date instead of the literal "Invalid Date".
 */
export function formatTime(
  value: DateInput,
  options: Intl.DateTimeFormatOptions = DEFAULT_TIME_OPTIONS,
  fallback: string = DATE_UNAVAILABLE,
  locale: string = 'en-US'
): string {
  const date = toValidDate(value);
  return date ? date.toLocaleTimeString(locale, options) : fallback;
}

/**
 * NaN-safe sort key for a date value. Returns the epoch-ms timestamp for a
 * valid date, else `fallback` (default 0 — sorts invalid dates to the epoch).
 * Use instead of `new Date(x).getTime()` in comparators, where an Invalid Date
 * yields NaN and corrupts the sort order (every NaN comparison is false).
 */
export function dateSortKey(value: DateInput, fallback: number = 0): number {
  const date = toValidDate(value);
  return date ? date.getTime() : fallback;
}
