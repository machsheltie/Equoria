/**
 * useUltraRareTraits — Equoria-gt6j
 *
 * Fetches a horse's ultra-rare / exotic traits + recent UltraRareTraitEvent
 * rows so the frontend can surface a reveal notification. The backend half
 * (Equoria-d4tl) auto-populates UltraRareTraitEvent rows on milestone
 * boundaries; this hook is the read side that lets the UI render them.
 */

import { useQuery } from '@tanstack/react-query';
import { ultraRareTraitsApi, HorseUltraRareTraitsResponse } from '@/lib/api-client';

export const ultraRareTraitKeys = {
  all: ['ultra-rare-traits'] as const,
  horse: (horseId: number) => [...ultraRareTraitKeys.all, 'horse', horseId] as const,
};

/**
 * Query a single horse's ultra-rare trait state. Returns undefined data while
 * loading. Disabled when horseId is not a positive integer.
 */
export function useHorseUltraRareTraits(horseId: number | undefined) {
  return useQuery<HorseUltraRareTraitsResponse>({
    queryKey: ultraRareTraitKeys.horse(horseId ?? -1),
    queryFn: () => ultraRareTraitsApi.getForHorse(horseId as number),
    enabled: typeof horseId === 'number' && horseId > 0,
    // Trait reveals are rare and don't change between renders — 2 min stale
    // matches the Horse Details cache strategy in PATTERN_LIBRARY.md.
    staleTime: 2 * 60 * 1000,
  });
}
