/**
 * Rider Personality Type System
 *
 * Defines personality types for riders and their effects on horse performance.
 * Each personality influences different competition outcomes and has compatibility
 * ratings with different horse temperaments.
 *
 * Mirrors groomPersonality.ts pattern for the Rider System (Epic 9C).
 */

export type RiderPersonality = 'daring' | 'methodical' | 'intuitive' | 'competitive';

export interface DisciplineAffinity {
  discipline: string;
  magnitude: 'high' | 'medium' | 'low';
}

export interface TemperamentCompatibility {
  horseTemperament: string;
  rating: 'high' | 'medium' | 'low';
}

export interface RiderPersonalityInfo {
  label: string;
  icon: string;
  description: string;
  disciplineAffinities: DisciplineAffinity[];
  temperamentCompatibility: TemperamentCompatibility[];
  effectivenessRating: 'high' | 'medium' | 'low';
  riderNote: string;
  colorClass: string;
  badgeClass: string;
}

export const RIDER_PERSONALITY_DATA: Record<RiderPersonality, RiderPersonalityInfo> = {
  daring: {
    label: 'Daring',
    icon: '🔥',
    description:
      'Pushes horses to their limits in high-stakes moments. Excels in speed disciplines and jumping events.',
    disciplineAffinities: [
      { discipline: 'Racing', magnitude: 'high' },
      { discipline: 'Show Jumping', magnitude: 'high' },
      { discipline: 'Cross Country', magnitude: 'medium' },
    ],
    temperamentCompatibility: [
      { horseTemperament: 'Bold/Confident', rating: 'high' },
      { horseTemperament: 'Athletic Breeds', rating: 'high' },
      { horseTemperament: 'Nervous/Shy', rating: 'low' },
    ],
    effectivenessRating: 'high',
    riderNote:
      'Daring riders thrive in pressure situations, extracting peak performance from willing horses.',
    colorClass: 'bg-orange-50 text-orange-700',
    badgeClass: 'bg-orange-50 text-orange-700 border border-orange-200',
  },
  methodical: {
    label: 'Methodical',
    icon: '📐',
    description:
      'Precise, structured riding style. Maximises scores in precision and technical disciplines.',
    disciplineAffinities: [
      { discipline: 'Dressage', magnitude: 'high' },
      { discipline: 'Western Pleasure', magnitude: 'high' },
      { discipline: 'Reining', magnitude: 'medium' },
    ],
    temperamentCompatibility: [
      { horseTemperament: 'Any Temperament', rating: 'high' },
      { horseTemperament: 'Complex/Difficult', rating: 'high' },
      { horseTemperament: 'Young/Inexperienced', rating: 'medium' },
    ],
    effectivenessRating: 'high',
    riderNote:
      'Methodical riders build consistency and reliability, excelling in judged disciplines.',
    colorClass: 'bg-[rgba(37,99,235,0.15)] text-[var(--gold-primary)]',
    badgeClass:
      'bg-[rgba(37,99,235,0.15)] text-[var(--gold-primary)] border border-[rgba(37,99,235,0.3)]',
  },
  intuitive: {
    label: 'Intuitive',
    icon: '✨',
    description:
      'Reads horses naturally and adapts in real-time. Versatile across disciplines and temperaments.',
    disciplineAffinities: [
      { discipline: 'Trail Riding', magnitude: 'high' },
      { discipline: 'Endurance', magnitude: 'high' },
      { discipline: 'Natural Horsemanship', magnitude: 'high' },
    ],
    temperamentCompatibility: [
      { horseTemperament: 'Nervous/Shy', rating: 'high' },
      { horseTemperament: 'Any Temperament', rating: 'high' },
      { horseTemperament: 'Bold/Confident', rating: 'medium' },
    ],
    effectivenessRating: 'high',
    riderNote:
      'Intuitive riders are natural communicators — they get the best from horses other riders struggle with.',
    colorClass: 'bg-purple-50 text-purple-700',
    badgeClass: 'bg-purple-50 text-purple-700 border border-purple-200',
  },
  competitive: {
    label: 'Competitive',
    icon: '🏆',
    description:
      'Laser-focused on results. Thrives in high-profile events and against strong competition.',
    disciplineAffinities: [
      { discipline: 'Stadium Jumping', magnitude: 'high' },
      { discipline: 'Barrel Racing', magnitude: 'high' },
      { discipline: 'Cutting', magnitude: 'medium' },
    ],
    temperamentCompatibility: [
      { horseTemperament: 'Bold/Experienced', rating: 'high' },
      { horseTemperament: 'Competition Horses', rating: 'high' },
      { horseTemperament: 'Nervous/Shy', rating: 'low' },
    ],
    effectivenessRating: 'high',
    riderNote:
      'Competitive riders elevate their game at prestige events — especially effective in finals and championships.',
    colorClass: 'bg-amber-50 text-amber-700',
    badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
};

/** Return personality info for a given personality string; falls back to methodical. */
export function getRiderPersonalityInfo(personality: string): RiderPersonalityInfo {
  const key = personality.toLowerCase() as RiderPersonality;
  return RIDER_PERSONALITY_DATA[key] ?? RIDER_PERSONALITY_DATA.methodical;
}

/** Return a human-readable compatibility label. */
export function riderCompatibilityLabel(rating: 'high' | 'medium' | 'low'): string {
  const labels: Record<'high' | 'medium' | 'low', string> = {
    high: 'High Compatibility',
    medium: 'Moderate Compatibility',
    low: 'Low Compatibility',
  };
  return labels[rating];
}

/** Return a CSS colour class for a compatibility rating. */
export function riderCompatibilityColorClass(rating: 'high' | 'medium' | 'low'): string {
  const classes: Record<'high' | 'medium' | 'low', string> = {
    high: 'text-emerald-400',
    medium: 'text-amber-400',
    low: 'text-red-400',
  };
  return classes[rating];
}
