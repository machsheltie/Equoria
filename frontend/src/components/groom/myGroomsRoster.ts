/**
 * My Grooms — the roster arithmetic behind the dashboard.
 *
 * Pure functions over the data MyGroomsDashboard already has: which horses a groom
 * is caring for, what that groom costs this week, and the order the cards appear in.
 * No React, no fetching, no UI decisions.
 *
 * Split out of MyGroomsDashboard.tsx under the file-size ratchet (Equoria-95yrv),
 * which is why it is a module of functions rather than a new component: the card
 * composition is unchanged and no new visual pattern is introduced here.
 */

import type { Groom, GroomAssignment, SalarySummary } from '@/lib/api-client';

/** Equoria-95yrv: the server publishes the cap; this is the pre-load fallback. */
export const DEFAULT_MAX_HORSES_PER_GROOM = 10;

/** The horses this groom is currently caring for. */
export function activeAssignmentsFor(
  assignments: GroomAssignment[],
  groomId: number
): GroomAssignment[] {
  return assignments.filter((a) => a.groomId === groomId && a.isActive);
}

/**
 * The weekly fee the server computed for this groom — Equoria-95yrv, 70 per horse
 * in their care. Read from the summary rather than recomputed, so the card and the
 * wallet can never disagree. `null` means the summary has not arrived: the surface
 * shows an em dash, never a reassuring zero.
 */
export function feeForGroom(salary: SalarySummary, groomId: number): number | null {
  return salary.breakdown.find((entry) => entry.groomId === groomId)?.weeklyFee ?? null;
}

/** Specialty display, null-safe (Equoria-j2a51). */
export function formatSpecialty(specialty: string | undefined): string {
  return (specialty ?? '').replace(/([A-Z])/g, ' $1').trim();
}

/**
 * The roster the player sees: filtered by skill and specialty, then ordered by
 * name, by what each groom costs this week, or by how much room they have left.
 */
export function filterAndSortGrooms(
  grooms: Groom[],
  {
    assignments,
    salary,
    skillLevelFilter,
    specialtyFilter,
    sortBy,
    maxHorses,
  }: {
    assignments: GroomAssignment[];
    salary: SalarySummary;
    skillLevelFilter: string;
    specialtyFilter: string;
    sortBy: string;
    maxHorses: number;
  }
): Groom[] {
  return grooms
    .filter((groom) => {
      if (skillLevelFilter !== 'all' && groom.skillLevel !== skillLevelFilter) return false;
      if (specialtyFilter !== 'all' && groom.specialty !== specialtyFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'salary') {
        return (feeForGroom(salary, b.id) ?? 0) - (feeForGroom(salary, a.id) ?? 0);
      }
      if (sortBy === 'slots') {
        const aSlots = maxHorses - activeAssignmentsFor(assignments, a.id).length;
        const bSlots = maxHorses - activeAssignmentsFor(assignments, b.id).length;
        return bSlots - aSlots;
      }
      return 0;
    });
}
