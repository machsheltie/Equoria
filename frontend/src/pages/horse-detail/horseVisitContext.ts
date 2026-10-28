/**
 * The horse page's visitor mode (owner ruling q205, 2026-10-28; coordinator
 * directive 2026-10-28): another player's horse opens the SAME horse page,
 * every section and tab, read-only. HorseDetailPage provides the visitor read
 * (GET /horses/:id/visit) here; each section that reads the owner's own
 * endpoints reads it from this instead, and drops the owner's controls.
 *
 * null on the owner's page.
 */

import { createContext, useContext } from 'react';
import type { HorseVisit } from '@/lib/api/studs';

export const HorseVisitContext = createContext<HorseVisit | null>(null);

/** The visitor read, or null when the player is on her own horse's page. */
export function useHorseVisitData(): HorseVisit | null {
  return useContext(HorseVisitContext);
}
