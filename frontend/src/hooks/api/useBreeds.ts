/**
 * useBreeds hook (Epic 25-3)
 *
 * Fetches all horse breeds from GET /api/v1/breeds and adds a short lore blurb
 * (client-side content) to each.
 *
 * Owner ruling 2026-10-29 (q292, Equoria-9kakx): the new-player breed picker
 * shows no breed stat bars. The stat tendencies it used to derive from the
 * breed's rating profiles (or hand-authored presets) are gone, and the server
 * no longer sends any part of the breed's genetic profile.
 *
 * staleTime: 10 minutes (breed list rarely changes)
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Breed {
  id: number;
  name: string;
  description: string | null;
  /** Short atmospheric lore blurb — injected client-side */
  loreBlurb: string;
}

interface BreedsServerResponse {
  data: Array<{
    id: number;
    name: string;
    description?: string | null;
  }>;
  count: number;
}

// ── Lore (keyed by lowercase breed name) ───────────────────────────────────────

// Honest neutral descriptor (NOT fabricated breed-specific lore). Used when a
// breed has no hand-authored lore below. Per Equoria-x83v4 AC2, we do NOT
// invent 300 breed-specific blurbs — authoring real per-breed lore is a
// product/content decision.
const DEFAULT_LORE =
  'A versatile horse with balanced traits, ready to excel in any discipline you choose.';

const BREED_LORE: Record<string, string> = {
  thoroughbred:
    'Born to race, bred for glory. The Thoroughbred is the pinnacle of speed and fire, carrying centuries of champion bloodlines.',
  arabian:
    'Sculpted by desert winds and ancient stars, the Arabian possesses unmatched endurance and an almost mystical bond with its rider.',
  'quarter horse':
    'Explosive and powerful over short distances, the Quarter Horse dominates cutting, reining, and barrel racing with natural athleticism.',
  warmblood:
    'The artist of the equine world. Warmbloods excel in dressage and show jumping, combining power with extraordinary grace and trainability.',
  appaloosa:
    'Marked by the stars themselves, the Appaloosa carries wild spirit and bold heart — a versatile companion for trail and arena alike.',
  mustang:
    'Free as the western wind, the Mustang is forged by survival. Tough, brave, and tireless — wild blood runs deep in every stride.',
  friesian:
    'Dark as a moonless night, the Friesian moves with regal elegance. Its flowing mane and tail mark it as a horse of legend and ceremony.',
  'paint horse':
    'Painted by fortune, the Paint Horse carries the heritage of the Great Plains — bold in color and spirit, beloved by riders of every discipline.',
  andalusian:
    'The pride of Iberia. The Andalusian is grace incarnate — collected, powerful, and steeped in the classical traditions of haute école.',
};

function lookupLore(name: string): string | null {
  const key = name.toLowerCase();
  if (BREED_LORE[key]) return BREED_LORE[key];
  // Partial match — e.g. "American Quarter Horse" → quarter horse
  const partialKey = Object.keys(BREED_LORE).find((k) => key.includes(k) || k.includes(key));
  return partialKey ? BREED_LORE[partialKey] : null;
}

// ── Query ──────────────────────────────────────────────────────────────────────

export const breedKeys = {
  all: ['breeds'] as const,
};

async function fetchBreeds(): Promise<Breed[]> {
  const response = await apiClient.get<BreedsServerResponse>('/api/v1/breeds');
  const raw = Array.isArray(response) ? response : ((response as BreedsServerResponse)?.data ?? []);
  return raw.map((b) => ({
    id: b.id,
    name: b.name,
    description: b.description ?? null,
    loreBlurb: lookupLore(b.name) ?? DEFAULT_LORE,
  }));
}

export function useBreeds() {
  return useQuery<Breed[]>({
    queryKey: breedKeys.all,
    queryFn: fetchBreeds,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
