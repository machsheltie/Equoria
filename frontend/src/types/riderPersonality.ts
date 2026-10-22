/**
 * Rider Personality Type System
 *
 * Defines personality types for riders and their effects on horse performance.
 * Each personality influences different competition outcomes. Riders carry no
 * horse-temperament fit (Equoria-dw9f4): temperament acts only on the show
 * matrix, groom bond synergy and trainer fit (owner ruling 2026-10-21).
 *
 * Mirrors groomPersonality.ts pattern for the Rider System (Epic 9C).
 */

export type RiderPersonality = 'daring' | 'methodical' | 'intuitive' | 'competitive';

export interface DisciplineAffinity {
  discipline: string;
  magnitude: 'high' | 'medium' | 'low';
}

export interface RiderPersonalityInfo {
  label: string;
  icon: string;
  description: string;
  disciplineAffinities: DisciplineAffinity[];
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
      { discipline: 'Steeplechase', magnitude: 'high' },
      { discipline: 'Cross Country', magnitude: 'medium' },
      { discipline: 'Polo', magnitude: 'medium' },
      { discipline: 'Rodeo', magnitude: 'medium' },
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
      { discipline: 'Pleasure Driving', magnitude: 'high' },
      { discipline: 'Reining', magnitude: 'medium' },
      { discipline: 'Fine Harness', magnitude: 'medium' },
      { discipline: 'Saddleseat', magnitude: 'medium' },
      { discipline: 'Hunter', magnitude: 'medium' },
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
      { discipline: 'Endurance', magnitude: 'high' },
      { discipline: 'Eventing', magnitude: 'medium' },
      { discipline: 'Vaulting', magnitude: 'medium' },
      { discipline: 'Gaited', magnitude: 'medium' },
      { discipline: 'Combined Driving', magnitude: 'medium' },
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
      { discipline: 'Show Jumping', magnitude: 'high' },
      { discipline: 'Barrel Racing', magnitude: 'high' },
      { discipline: 'Gymkhana', magnitude: 'high' },
      { discipline: 'Cutting', magnitude: 'medium' },
      { discipline: 'Harness Racing', magnitude: 'medium' },
      { discipline: 'Team Penning', magnitude: 'medium' },
      { discipline: 'Roping', magnitude: 'medium' },
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
