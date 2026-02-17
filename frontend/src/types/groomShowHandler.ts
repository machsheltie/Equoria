/**
 * Groom Show Handler Types for Story 7-7 (Show Handling & Rare Traits)
 *
 * Types and constants for the groom show handler system,
 * mirroring backend groomHandlerService.mjs and conformationShowService.mjs.
 *
 * FR-G7: Groom as competition handler for conformation shows.
 *
 * Conformation Show Scoring:
 * - 65% horse conformation stats
 * - 20% groom handler skill
 * - 8% bond score with groom
 * - 7% temperament synergy
 */

export type HandlerSkillLevel = 'novice' | 'intermediate' | 'expert' | 'master';

export type HandlerSpecialty =
  | 'showHandling'
  | 'racing'
  | 'western'
  | 'training'
  | 'foalCare'
  | 'general';

export type HandlerPersonality =
  | 'gentle'
  | 'energetic'
  | 'patient'
  | 'strict'
  | 'calm'
  | 'confident';

export interface HandlerSkillBonus {
  baseBonus: number; // Base bonus as decimal (e.g. 0.05 = 5%)
  maxBonus: number; // Max bonus as decimal (e.g. 0.10 = 10%)
  experienceMultiplier: number; // Bonus per experience point
}

export interface PersonalitySynergy {
  beneficial: string[]; // Disciplines that benefit from this personality
  bonus: number; // Synergy bonus as decimal
}

export interface SpecialtyDisciplineBonus {
  disciplines: string[]; // Disciplines this specialty applies to
  bonus: number; // Bonus as decimal
}

export interface GroomHandlerData {
  id: number;
  name: string;
  skillLevel: HandlerSkillLevel;
  speciality: HandlerSpecialty;
  personality: HandlerPersonality;
  experience: number;
}

/** Handler skill bonuses by skill level (mirrors backend HANDLER_SKILL_BONUSES) */
export const HANDLER_SKILL_BONUSES: Record<HandlerSkillLevel, HandlerSkillBonus> = {
  novice: { baseBonus: 0.05, maxBonus: 0.1, experienceMultiplier: 0.001 },
  intermediate: { baseBonus: 0.08, maxBonus: 0.15, experienceMultiplier: 0.0015 },
  expert: { baseBonus: 0.12, maxBonus: 0.2, experienceMultiplier: 0.002 },
  master: { baseBonus: 0.15, maxBonus: 0.25, experienceMultiplier: 0.0025 },
};

/** Personality-discipline synergy bonuses (mirrors backend PERSONALITY_DISCIPLINE_SYNERGY) */
export const PERSONALITY_DISCIPLINE_SYNERGY: Record<HandlerPersonality, PersonalitySynergy> = {
  gentle: { beneficial: ['Dressage', 'Western Pleasure', 'Hunter', 'Saddleseat'], bonus: 0.03 },
  energetic: { beneficial: ['Racing', 'Barrel Racing', 'Gymkhana', 'Steeplechase'], bonus: 0.04 },
  patient: { beneficial: ['Endurance', 'Combined Driving', 'Obedience Training'], bonus: 0.035 },
  strict: { beneficial: ['Show Jumping', 'Eventing', 'Reining', 'Cutting'], bonus: 0.045 },
  calm: { beneficial: ['Dressage', 'Fine Harness', 'Vaulting'], bonus: 0.03 },
  confident: { beneficial: ['Racing', 'Steeplechase', 'Cross Country', 'Polo'], bonus: 0.04 },
};

/** Specialty-discipline bonuses (mirrors backend SPECIALTY_DISCIPLINE_BONUSES) */
export const SPECIALTY_DISCIPLINE_BONUSES: Record<HandlerSpecialty, SpecialtyDisciplineBonus> = {
  showHandling: {
    disciplines: ['Dressage', 'Show Jumping', 'Hunter', 'Saddleseat', 'Fine Harness'],
    bonus: 0.06,
  },
  racing: { disciplines: ['Racing', 'Steeplechase', 'Harness Racing'], bonus: 0.07 },
  western: {
    disciplines: ['Western Pleasure', 'Reining', 'Cutting', 'Barrel Racing', 'Roping'],
    bonus: 0.06,
  },
  training: { disciplines: ['Obedience Training', 'Combined Driving'], bonus: 0.05 },
  foalCare: { disciplines: [], bonus: 0.02 },
  general: { disciplines: [], bonus: 0.01 },
};

/** Conformation show scoring weights */
export const CONFORMATION_SHOW_WEIGHTS = {
  conformationWeight: 0.65, // 65% — horse's physical conformation
  handlerWeight: 0.2, // 20% — groom's show handling skill
  bondWeight: 0.08, // 8% — bond score with groom
  temperamentWeight: 0.07, // 7% — temperament synergy
} as const;

/**
 * Get formatted handler bonus range string.
 * e.g. novice → "5% – 10%"
 */
export function getHandlerBonusRange(skillLevel: HandlerSkillLevel): string {
  const bonus = HANDLER_SKILL_BONUSES[skillLevel];
  const base = Math.round(bonus.baseBonus * 100);
  const max = Math.round(bonus.maxBonus * 100);
  return `${base}% – ${max}%`;
}

/**
 * Get disciplines that benefit from this personality's synergy.
 */
export function getPersonalitySynergyDisciplines(personality: HandlerPersonality): string[] {
  return PERSONALITY_DISCIPLINE_SYNERGY[personality]?.beneficial ?? [];
}

/**
 * Get the specialty bonus percentage for show handling.
 * Returns 0 if specialty has no relevant disciplines.
 */
export function getSpecialtyBonusPercent(specialty: HandlerSpecialty): number {
  return Math.round(SPECIALTY_DISCIPLINE_BONUSES[specialty].bonus * 100);
}

/**
 * Format a decimal bonus as "+X%" string.
 */
export function formatHandlerBonus(decimal: number): string {
  const pct = Math.round(decimal * 100);
  return `+${pct}%`;
}

/**
 * Get display label for a skill level.
 */
export function getSkillLevelLabel(skillLevel: HandlerSkillLevel): string {
  const labels: Record<HandlerSkillLevel, string> = {
    novice: 'Novice',
    intermediate: 'Intermediate',
    expert: 'Expert',
    master: 'Master',
  };
  return labels[skillLevel];
}

/**
 * Get display label for a specialty.
 */
export function getSpecialtyLabel(specialty: HandlerSpecialty): string {
  const labels: Record<HandlerSpecialty, string> = {
    showHandling: 'Show Handling',
    racing: 'Racing',
    western: 'Western',
    training: 'Training',
    foalCare: 'Foal Care',
    general: 'General',
  };
  return labels[specialty];
}

/**
 * Check if specialty is directly relevant to conformation shows.
 */
export function isShowHandlingSpecialty(specialty: HandlerSpecialty): boolean {
  return specialty === 'showHandling';
}
