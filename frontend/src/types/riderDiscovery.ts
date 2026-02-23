/**
 * Rider Discovery System Types (Epic 9C — Story 9C-3)
 *
 * Riders have 3 categories of hidden traits revealed through competition:
 *  1. Discipline Affinities — excels at specific disciplines
 *  2. Temperament Compatibility — reads specific horse temperaments well
 *  3. Gait Affinity — natural feel for specific gaits
 *
 * Traits are revealed progressively as the rider participates in competitions.
 * Revealed traits appear on rider cards and horse profile pages.
 * Undiscovered slots show "?" placeholders.
 */

export type DiscoveryCategory =
  | 'discipline_affinity'
  | 'temperament_compatibility'
  | 'gait_affinity';

export type DiscoveryStrength = 'strength' | 'weakness' | 'neutral';

export interface DiscoveredTrait {
  id: string;
  category: DiscoveryCategory;
  label: string; // e.g. "Excels at Dressage"
  value: string; // e.g. "Dressage"
  strength: DiscoveryStrength;
  discoveredAt?: string; // ISO timestamp
  icon: string;
  description: string;
}

export interface DiscoverySlot {
  slotIndex: number;
  category: DiscoveryCategory;
  discovered: boolean;
  trait?: DiscoveredTrait;
}

export interface RiderDiscoveryProfile {
  riderId: number;
  totalSlots: number; // Always 6 (2 per category)
  discoveredCount: number;
  slots: DiscoverySlot[];
  nextDiscoveryAt?: number; // competitions until next reveal
}

/** The 23 competition disciplines used in discovery */
export const COMPETITION_DISCIPLINES = [
  'Dressage',
  'Show Jumping',
  'Cross Country',
  'Eventing',
  'Western Pleasure',
  'Reining',
  'Cutting',
  'Barrel Racing',
  'Pole Bending',
  'Roping',
  'Trail Riding',
  'Endurance',
  'Racing',
  'Steeplechase',
  'Hunter Under Saddle',
  'Halter',
  'In-Hand Trail',
  'Liberty',
  'Vaulting',
  'Polo',
  'Polocrosse',
  'Team Penning',
  'Natural Horsemanship',
] as const;

export type CompetitionDiscipline = (typeof COMPETITION_DISCIPLINES)[number];

/** The horse temperaments used in temperament compatibility discovery */
export const HORSE_TEMPERAMENTS = [
  'Bold/Confident',
  'Nervous/Shy',
  'Calm/Docile',
  'Energetic/Spirited',
  'Stubborn/Willful',
  'Gentle/Sweet',
  'Complex/Difficult',
] as const;

export type HorseTemperament = (typeof HORSE_TEMPERAMENTS)[number];

/** The gaits used in gait affinity discovery */
export const HORSE_GAITS = ['Walk', 'Trot', 'Canter', 'Gallop', 'Paso Fino', 'Tölt'] as const;

export type HorseGait = (typeof HORSE_GAITS)[number];

/** Category metadata for display */
export const DISCOVERY_CATEGORY_META: Record<
  DiscoveryCategory,
  { label: string; icon: string; description: string }
> = {
  discipline_affinity: {
    label: 'Discipline Affinity',
    icon: '🏇',
    description: 'Disciplines where this rider naturally excels or struggles',
  },
  temperament_compatibility: {
    label: 'Temperament Compatibility',
    icon: '🤝',
    description: 'Horse temperaments this rider works well or poorly with',
  },
  gait_affinity: {
    label: 'Gait Affinity',
    icon: '👟',
    description: 'Gaits this rider has a natural feel for',
  },
};

/** Strength display helpers */
export const DISCOVERY_STRENGTH_META: Record<
  DiscoveryStrength,
  { label: string; colorClass: string; icon: string }
> = {
  strength: {
    label: 'Strength',
    colorClass: 'text-emerald-400',
    icon: '↑',
  },
  weakness: {
    label: 'Weakness',
    colorClass: 'text-red-400',
    icon: '↓',
  },
  neutral: {
    label: 'Neutral',
    colorClass: 'text-white/50',
    icon: '–',
  },
};

/**
 * Build a placeholder discovery profile for a rider with no discovered traits.
 */
export function buildEmptyDiscoveryProfile(riderId: number): RiderDiscoveryProfile {
  const categories: DiscoveryCategory[] = [
    'discipline_affinity',
    'discipline_affinity',
    'temperament_compatibility',
    'temperament_compatibility',
    'gait_affinity',
    'gait_affinity',
  ];

  return {
    riderId,
    totalSlots: 6,
    discoveredCount: 0,
    slots: categories.map((category, index) => ({
      slotIndex: index,
      category,
      discovered: false,
    })),
    nextDiscoveryAt: 3,
  };
}
