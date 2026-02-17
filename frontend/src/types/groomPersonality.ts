/**
 * Groom Personality Type System
 *
 * Defines personality types for grooms and their effects on horse care.
 * Each personality influences different horse traits and has compatibility
 * ratings with different horse temperaments.
 */

export type GroomPersonality = 'gentle' | 'energetic' | 'patient' | 'strict';

export interface TraitInfluence {
  trait: string;
  magnitude: 'high' | 'medium' | 'low';
}

export interface CompatibilityRating {
  horseType: string;
  rating: 'high' | 'medium' | 'low';
}

export interface PersonalityInfo {
  label: string;
  icon: string;
  description: string;
  traitInfluences: TraitInfluence[];
  compatibilityRatings: CompatibilityRating[];
  effectivenessRating: 'high' | 'medium' | 'low';
  developmentNote: string;
  colorClass: string;
  badgeClass: string;
}

export const PERSONALITY_DATA: Record<GroomPersonality, PersonalityInfo> = {
  gentle: {
    label: 'Gentle',
    icon: '🌿',
    description:
      'Creates a calm, trusting environment for horses. Excels with sensitive or nervous horses.',
    traitInfluences: [
      { trait: 'Bonding', magnitude: 'high' },
      { trait: 'Stress Reduction', magnitude: 'high' },
      { trait: 'Obedience', magnitude: 'medium' },
    ],
    compatibilityRatings: [
      { horseType: 'Nervous/Shy', rating: 'high' },
      { horseType: 'Young Foals', rating: 'high' },
      { horseType: 'Bold/Confident', rating: 'medium' },
    ],
    effectivenessRating: 'high',
    developmentNote:
      'Gentle grooms grow in empathy over their career, increasing bond-building effectiveness.',
    colorClass: 'bg-green-50 text-green-700',
    badgeClass: 'bg-green-50 text-green-700 border border-green-200',
  },
  energetic: {
    label: 'Energetic',
    icon: '⚡',
    description:
      'Keeps horses active and engaged. Best for athletic training and competition preparation.',
    traitInfluences: [
      { trait: 'Agility', magnitude: 'high' },
      { trait: 'Speed', magnitude: 'medium' },
      { trait: 'Training Focus', magnitude: 'medium' },
    ],
    compatibilityRatings: [
      { horseType: 'Bold/Confident', rating: 'high' },
      { horseType: 'Athletic Breeds', rating: 'high' },
      { horseType: 'Nervous/Shy', rating: 'low' },
    ],
    effectivenessRating: 'high',
    developmentNote:
      'Energetic grooms channel enthusiasm into expertise, improving training routines over time.',
    colorClass: 'bg-amber-50 text-amber-700',
    badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
  patient: {
    label: 'Patient',
    icon: '⏳',
    description: 'Methodical and consistent approach. Works well with any horse temperament.',
    traitInfluences: [
      { trait: 'Intelligence', magnitude: 'high' },
      { trait: 'Precision', magnitude: 'high' },
      { trait: 'Calm Demeanor', magnitude: 'medium' },
    ],
    compatibilityRatings: [
      { horseType: 'Any Temperament', rating: 'high' },
      { horseType: 'Complex/Difficult', rating: 'high' },
      { horseType: 'Young Foals', rating: 'medium' },
    ],
    effectivenessRating: 'high',
    developmentNote:
      'Patient grooms develop refined techniques over years, making them universally effective.',
    colorClass: 'bg-blue-50 text-blue-700',
    badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
  },
  strict: {
    label: 'Strict',
    icon: '📋',
    description: 'Disciplined, high-standard care. Maximizes performance for competition horses.',
    traitInfluences: [
      { trait: 'Discipline', magnitude: 'high' },
      { trait: 'Performance', magnitude: 'high' },
      { trait: 'Obedience', magnitude: 'medium' },
    ],
    compatibilityRatings: [
      { horseType: 'Bold/Experienced', rating: 'high' },
      { horseType: 'Competition Horses', rating: 'high' },
      { horseType: 'Young Foals', rating: 'low' },
    ],
    effectivenessRating: 'high',
    developmentNote:
      'Strict grooms refine their standards over their career, producing top competitive results.',
    colorClass: 'bg-purple-50 text-purple-700',
    badgeClass: 'bg-purple-50 text-purple-700 border border-purple-200',
  },
};

/** Return personality info for a given personality string; falls back to patient. */
export function getPersonalityInfo(personality: string): PersonalityInfo {
  const key = personality.toLowerCase() as GroomPersonality;
  return PERSONALITY_DATA[key] ?? PERSONALITY_DATA.patient;
}

/** Return a human-readable compatibility label. */
export function compatibilityLabel(rating: 'high' | 'medium' | 'low'): string {
  const labels: Record<'high' | 'medium' | 'low', string> = {
    high: 'High Compatibility',
    medium: 'Moderate Compatibility',
    low: 'Low Compatibility',
  };
  return labels[rating];
}

/** Return a CSS color class for a compatibility rating. */
export function compatibilityColorClass(rating: 'high' | 'medium' | 'low'): string {
  const classes: Record<'high' | 'medium' | 'low', string> = {
    high: 'text-green-600',
    medium: 'text-amber-600',
    low: 'text-red-500',
  };
  return classes[rating];
}

/** Return a CSS color class for a trait influence magnitude. */
export function magnitudeColorClass(magnitude: 'high' | 'medium' | 'low'): string {
  const classes: Record<'high' | 'medium' | 'low', string> = {
    high: 'text-green-700 font-bold',
    medium: 'text-amber-700',
    low: 'text-slate-500',
  };
  return classes[magnitude];
}
