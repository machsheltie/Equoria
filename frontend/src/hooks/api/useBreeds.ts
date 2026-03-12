/**
 * useBreeds hook (Epic 25-3)
 *
 * Fetches all horse breeds from GET /api/v1/breeds.
 * Merges server breed data with client-side stat tendency presets
 * (breed model has no stat fields — tendencies are UI enrichment only).
 *
 * staleTime: 10 minutes (breed list rarely changes)
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface StatTendency {
  /** 0–100: approximate low end for this breed */
  min: number;
  /** 0–100: approximate high end for this breed */
  max: number;
  /** 0–100: average expected value */
  avg: number;
}

export interface BreedStatTendencies {
  speed: StatTendency;
  stamina: StatTendency;
  agility: StatTendency;
  balance: StatTendency;
  precision: StatTendency;
  boldness: StatTendency;
}

export interface Breed {
  id: number;
  name: string;
  description: string | null;
  /** Injected client-side — not from server */
  statTendencies: BreedStatTendencies;
  /** Short atmospheric lore blurb — injected client-side */
  loreBlurb: string;
}

interface BreedsServerResponse {
  data: Array<{ id: number; name: string; description?: string | null }>;
  count: number;
}

// ── Static stat tendency presets (keyed by lowercase breed name) ───────────────

const DEFAULT_TENDENCIES: BreedStatTendencies = {
  speed: { min: 40, max: 70, avg: 55 },
  stamina: { min: 40, max: 70, avg: 55 },
  agility: { min: 40, max: 70, avg: 55 },
  balance: { min: 40, max: 70, avg: 55 },
  precision: { min: 40, max: 70, avg: 55 },
  boldness: { min: 40, max: 70, avg: 55 },
};

const DEFAULT_LORE =
  'A versatile horse with balanced traits, ready to excel in any discipline you choose.';

const BREED_PRESETS: Record<string, { tendencies: BreedStatTendencies; lore: string }> = {
  thoroughbred: {
    tendencies: {
      speed: { min: 75, max: 100, avg: 88 },
      stamina: { min: 60, max: 85, avg: 73 },
      agility: { min: 55, max: 80, avg: 68 },
      balance: { min: 50, max: 75, avg: 63 },
      precision: { min: 45, max: 70, avg: 58 },
      boldness: { min: 70, max: 95, avg: 83 },
    },
    lore: 'Born to race, bred for glory. The Thoroughbred is the pinnacle of speed and fire, carrying centuries of champion bloodlines.',
  },
  arabian: {
    tendencies: {
      speed: { min: 65, max: 90, avg: 78 },
      stamina: { min: 70, max: 95, avg: 83 },
      agility: { min: 65, max: 90, avg: 78 },
      balance: { min: 60, max: 85, avg: 73 },
      precision: { min: 60, max: 85, avg: 73 },
      boldness: { min: 55, max: 80, avg: 68 },
    },
    lore: 'Sculpted by desert winds and ancient stars, the Arabian possesses unmatched endurance and an almost mystical bond with its rider.',
  },
  'quarter horse': {
    tendencies: {
      speed: { min: 70, max: 95, avg: 83 },
      stamina: { min: 55, max: 80, avg: 68 },
      agility: { min: 70, max: 90, avg: 80 },
      balance: { min: 65, max: 85, avg: 75 },
      precision: { min: 60, max: 82, avg: 71 },
      boldness: { min: 60, max: 80, avg: 70 },
    },
    lore: 'Explosive and powerful over short distances, the Quarter Horse dominates cutting, reining, and barrel racing with natural athleticism.',
  },
  warmblood: {
    tendencies: {
      speed: { min: 55, max: 80, avg: 68 },
      stamina: { min: 60, max: 82, avg: 71 },
      agility: { min: 65, max: 88, avg: 77 },
      balance: { min: 70, max: 92, avg: 81 },
      precision: { min: 70, max: 93, avg: 82 },
      boldness: { min: 55, max: 78, avg: 67 },
    },
    lore: 'The artist of the equine world. Warmbloods excel in dressage and show jumping, combining power with extraordinary grace and trainability.',
  },
  appaloosa: {
    tendencies: {
      speed: { min: 55, max: 78, avg: 67 },
      stamina: { min: 65, max: 88, avg: 77 },
      agility: { min: 60, max: 82, avg: 71 },
      balance: { min: 58, max: 80, avg: 69 },
      precision: { min: 55, max: 78, avg: 67 },
      boldness: { min: 65, max: 88, avg: 77 },
    },
    lore: 'Marked by the stars themselves, the Appaloosa carries wild spirit and bold heart — a versatile companion for trail and arena alike.',
  },
  mustang: {
    tendencies: {
      speed: { min: 60, max: 85, avg: 73 },
      stamina: { min: 75, max: 98, avg: 87 },
      agility: { min: 65, max: 88, avg: 77 },
      balance: { min: 55, max: 78, avg: 67 },
      precision: { min: 45, max: 70, avg: 58 },
      boldness: { min: 78, max: 100, avg: 89 },
    },
    lore: 'Free as the western wind, the Mustang is forged by survival. Tough, brave, and tireless — wild blood runs deep in every stride.',
  },
  friesian: {
    tendencies: {
      speed: { min: 50, max: 72, avg: 61 },
      stamina: { min: 58, max: 80, avg: 69 },
      agility: { min: 60, max: 82, avg: 71 },
      balance: { min: 68, max: 90, avg: 79 },
      precision: { min: 65, max: 88, avg: 77 },
      boldness: { min: 50, max: 72, avg: 61 },
    },
    lore: 'Dark as a moonless night, the Friesian moves with regal elegance. Its flowing mane and tail mark it as a horse of legend and ceremony.',
  },
  'paint horse': {
    tendencies: {
      speed: { min: 62, max: 85, avg: 74 },
      stamina: { min: 58, max: 80, avg: 69 },
      agility: { min: 66, max: 88, avg: 77 },
      balance: { min: 60, max: 82, avg: 71 },
      precision: { min: 58, max: 80, avg: 69 },
      boldness: { min: 62, max: 84, avg: 73 },
    },
    lore: 'Painted by fortune, the Paint Horse carries the heritage of the Great Plains — bold in colour and spirit, beloved by riders of every discipline.',
  },
  andalusian: {
    tendencies: {
      speed: { min: 55, max: 78, avg: 67 },
      stamina: { min: 60, max: 82, avg: 71 },
      agility: { min: 68, max: 90, avg: 79 },
      balance: { min: 72, max: 94, avg: 83 },
      precision: { min: 70, max: 93, avg: 82 },
      boldness: { min: 55, max: 78, avg: 67 },
    },
    lore: 'The pride of Iberia. The Andalusian is grace incarnate — collected, powerful, and steeped in the classical traditions of haute école.',
  },
};

function lookupPreset(name: string): { tendencies: BreedStatTendencies; lore: string } {
  const key = name.toLowerCase();
  if (BREED_PRESETS[key]) return BREED_PRESETS[key];
  // Partial match — e.g. "American Quarter Horse" → quarter horse
  const partialKey = Object.keys(BREED_PRESETS).find((k) => key.includes(k) || k.includes(key));
  if (partialKey) return BREED_PRESETS[partialKey];
  return { tendencies: DEFAULT_TENDENCIES, lore: DEFAULT_LORE };
}

// ── Query ──────────────────────────────────────────────────────────────────────

export const breedKeys = {
  all: ['breeds'] as const,
};

async function fetchBreeds(): Promise<Breed[]> {
  const response = await apiClient.get<BreedsServerResponse>('/api/v1/breeds');
  const raw = Array.isArray(response) ? response : ((response as BreedsServerResponse)?.data ?? []);
  return raw.map((b) => {
    const preset = lookupPreset(b.name);
    return {
      id: b.id,
      name: b.name,
      description: b.description ?? null,
      statTendencies: preset.tendencies,
      loreBlurb: preset.lore,
    };
  });
}

export function useBreeds() {
  return useQuery<Breed[]>({
    queryKey: breedKeys.all,
    queryFn: fetchBreeds,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
