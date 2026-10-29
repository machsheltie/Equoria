/**
 * Pregnancy countdown for an in-foal mare (feed-system redesign 2026-04-29,
 * Equoria-ta4s).
 *
 * Owner ruling 2026-10-29 (q293, Equoria-9kakx): the in-foal panel shows no
 * trait-chance numbers. The client-side copy of the pregnancy trait-chance
 * formula (backend/utils/pregnancyBonus.mjs) was removed with them, so the
 * odds do not ship in the browser bundle either.
 */

import { gameDayIndex } from '@/lib/gameTime';

/** Length of an Equoria gestation, in days. */
export const GESTATION_DAYS = 7;

export interface PregnancyProgress {
  /** Whole Eastern game days elapsed since inFoalSinceDate (>= 0). */
  elapsedDays: number;
  /** 1-based gestation day, capped at GESTATION_DAYS. */
  gestationDay: number;
  /** Days remaining until foaling (>= 0). 0 once overdue. */
  daysRemaining: number;
  /** True once the full gestation window has elapsed. */
  isOverdue: boolean;
}

/**
 * Compute the gestation-day countdown for an in-foal mare from her
 * `inFoalSinceDate`, counted in Eastern calendar days like the nightly foaling
 * run (owner ruling 2026-10-12: bred on day D, foals on day D+7). Shared by the
 * HorseCard badge and PregnancyFeedingPanel so they never disagree.
 *
 * Returns null when there is no usable start date (not pregnant, or an
 * unparseable date string) so callers can simply skip rendering the badge.
 */
export function getPregnancyProgress(
  inFoalSinceDate?: string | null,
  now: number = Date.now()
): PregnancyProgress | null {
  if (!inFoalSinceDate) return null;

  const startMs = new Date(inFoalSinceDate).getTime();
  if (Number.isNaN(startMs)) return null;

  const elapsedDays = Math.max(0, gameDayIndex(now) - gameDayIndex(startMs));
  const gestationDay = Math.min(elapsedDays + 1, GESTATION_DAYS);
  const daysRemaining = Math.max(0, GESTATION_DAYS - elapsedDays);
  const isOverdue = elapsedDays >= GESTATION_DAYS;

  return { elapsedDays, gestationDay, daysRemaining, isOverdue };
}
