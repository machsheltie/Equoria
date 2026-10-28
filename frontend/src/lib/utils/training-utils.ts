/**
 * Training Utilities
 *
 * Provides utility functions for the training system:
 * - Discipline data and categorization (24 disciplines, 4 categories)
 * - Score gain calculations
 * - Training eligibility checks
 * - Formatting helpers
 *
 * Story 4-1: Training Session Interface - Task 1
 */

import { formatDate } from '@/lib/formatDate';
import { retirementAgeYears } from '@/lib/horseAgePolicy';

export interface Discipline {
  id: string;
  name: string;
  category: 'Western' | 'English' | 'Specialized' | 'Racing';
  description: string;
  primaryStats: string[];
}

/**
 * Complete list of all 24 disciplines in Equoria
 * Organized by category for UI display
 */
export const DISCIPLINES: Discipline[] = [
  // Western Disciplines (7)
  {
    id: 'western-pleasure',
    name: 'Western Pleasure',
    category: 'Western',
    description: 'Focus on smooth gaits and responsive obedience',
    primaryStats: ['obedience', 'focus', 'precision'],
  },
  {
    id: 'reining',
    name: 'Reining',
    category: 'Western',
    description: 'Precision sliding stops, spins, and lead changes',
    primaryStats: ['precision', 'agility', 'focus'],
  },
  {
    id: 'cutting',
    name: 'Cutting',
    category: 'Western',
    description: 'Separating cattle from herd with quick movements',
    primaryStats: ['agility', 'speed', 'intelligence'],
  },
  {
    id: 'barrel-racing',
    name: 'Barrel Racing',
    category: 'Western',
    description: 'Speed and agility around barrel pattern',
    primaryStats: ['speed', 'agility', 'stamina'],
  },
  {
    id: 'roping',
    name: 'Roping',
    category: 'Western',
    description: 'Team roping requiring strength and precision',
    primaryStats: ['speed', 'precision', 'focus'],
  },
  {
    id: 'team-penning',
    name: 'Team Penning',
    category: 'Western',
    description: 'Team coordination to pen specific cattle',
    primaryStats: ['intelligence', 'agility', 'obedience'],
  },
  {
    id: 'rodeo',
    name: 'Rodeo',
    category: 'Western',
    description: 'Rough stock events requiring strength and stamina',
    primaryStats: ['stamina', 'agility', 'boldness'],
  },

  // English Disciplines (6)
  {
    id: 'hunter',
    name: 'Hunter',
    category: 'English',
    description: 'Smooth jumping style over obstacles',
    primaryStats: ['precision', 'stamina', 'agility'],
  },
  {
    id: 'saddleseat',
    name: 'Saddleseat',
    category: 'English',
    description: 'High-stepping gaits with animated movement',
    primaryStats: ['flexibility', 'obedience', 'precision'],
  },
  {
    id: 'dressage',
    name: 'Dressage',
    category: 'English',
    description: 'Precision movements and obedience training',
    primaryStats: ['precision', 'obedience', 'focus'],
  },
  {
    id: 'show-jumping',
    name: 'Show Jumping',
    category: 'English',
    description: 'Clearing obstacles with speed and precision',
    primaryStats: ['agility', 'precision', 'intelligence'],
  },
  {
    id: 'eventing',
    name: 'Eventing',
    category: 'English',
    description: 'Three-phase competition combining disciplines',
    primaryStats: ['stamina', 'precision', 'agility'],
  },
  {
    id: 'cross-country',
    name: 'Cross Country',
    category: 'English',
    description: 'Endurance jumping over natural obstacles',
    primaryStats: ['stamina', 'intelligence', 'agility'],
  },

  // Specialized Disciplines (8)
  {
    id: 'endurance',
    name: 'Endurance',
    category: 'Specialized',
    description: 'Long-distance riding requiring stamina',
    primaryStats: ['stamina', 'speed', 'focus'],
  },
  {
    id: 'vaulting',
    name: 'Vaulting',
    category: 'Specialized',
    description: 'Gymnastic movements performed on horseback',
    primaryStats: ['flexibility', 'stamina', 'balance'],
  },
  {
    id: 'polo',
    name: 'Polo',
    category: 'Specialized',
    description: 'Fast-paced team sport requiring agility',
    primaryStats: ['speed', 'agility', 'intelligence'],
  },
  {
    id: 'combined-driving',
    name: 'Combined Driving',
    category: 'Specialized',
    description: 'Carriage driving with obstacles and precision',
    primaryStats: ['obedience', 'stamina', 'focus'],
  },
  {
    id: 'fine-harness',
    name: 'Fine Harness',
    category: 'Specialized',
    description: 'Elegant trotting in harness',
    primaryStats: ['precision', 'flexibility', 'obedience'],
  },
  {
    id: 'gaited',
    name: 'Gaited',
    category: 'Specialized',
    description: 'Specialized four-beat gaits',
    primaryStats: ['flexibility', 'obedience', 'focus'],
  },
  {
    id: 'gymkhana',
    name: 'Gymkhana',
    category: 'Specialized',
    description: 'Timed games requiring speed and flexibility',
    primaryStats: ['speed', 'flexibility', 'stamina'],
  },
  {
    id: 'pleasure-driving',
    name: 'Pleasure Driving',
    category: 'Specialized',
    description: 'Driving in harness, judged on manners and a pleasant way of going',
    primaryStats: ['obedience', 'balance', 'focus'],
  },

  // Racing Disciplines (3)
  {
    id: 'racing',
    name: 'Racing',
    category: 'Racing',
    description: 'Flat racing for maximum speed',
    primaryStats: ['speed', 'stamina', 'intelligence'],
  },
  {
    id: 'steeplechase',
    name: 'Steeplechase',
    category: 'Racing',
    description: 'Jump racing over obstacles',
    primaryStats: ['speed', 'stamina', 'agility'],
  },
  {
    id: 'harness-racing',
    name: 'Harness Racing',
    category: 'Racing',
    description: 'Trotting or pacing in harness',
    primaryStats: ['speed', 'precision', 'stamina'],
  },
];

/**
 * Training eligibility interface
 */
export interface Horse {
  id: number;
  name: string;
  age: number;
  health?: number;
  /**
   * Why the server refuses to train this horse (too old, bad health, ...), as the
   * trainable-horses list reports it; null or absent when it does not refuse. The
   * server owns these rules, so a horse carrying one is never shown as ready.
   */
  ineligibleReason?: string | null;
  trainingCooldown?: Date | string | null;
  disciplineScores?: { [discipline: string]: number };
}

/**
 * Get all disciplines in a specific category
 */
export function getDisciplinesByCategory(
  category: 'Western' | 'English' | 'Specialized' | 'Racing'
): Discipline[] {
  return DISCIPLINES.filter((d) => d.category === category);
}

/**
 * Get a discipline by its ID
 */
export function getDisciplineById(id: string): Discipline | undefined {
  return DISCIPLINES.find((d) => d.id === id);
}

/**
 * Get discipline name from ID
 */
export function formatDisciplineName(id: string): string {
  const discipline = getDisciplineById(id);
  return discipline?.name || id;
}

/**
 * A discipline as the player reads it, from any spelling a payload carries: the
 * id ('showJumping', 'western-pleasure') or the display name ('Show Jumping').
 * A value that is no discipline reads as a generic authored phrase, never the
 * stored value (owner ruling 2026-10-23, Equoria-bdpvw).
 */
export function disciplineLabel(value: string | null | undefined): string {
  const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (typeof value !== 'string' || squash(value) === '') return 'Another Discipline';
  const key = squash(value);
  const match = DISCIPLINES.find((d) => squash(d.id) === key || squash(d.name) === key);
  return match?.name ?? 'Another Discipline';
}

/**
 * A show's or a show result's discipline as its authored name. Conformation and
 * parade results store their show type in the discipline column ('conformation'),
 * so those read as the show's name; every other value goes through
 * disciplineLabel (owner ruling 2026-10-23, Equoria-q4pb8).
 */
export function competitionDisciplineLabel(value: string | null | undefined): string {
  const key = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (key === 'conformation') return 'Conformation';
  if (key === 'parade') return 'Parade';
  return disciplineLabel(value);
}

/**
 * Check if a horse is eligible for training
 *
 * Requirements:
 * - Horse must be 3 to 20 years old (21 and over are retired)
 * - Horse must not be refused by the server (`ineligibleReason`: bad health and the like)
 * - Horse must not be on cooldown
 * - Horse must have sufficient health (optional check)
 */
export function canTrain(
  horse: Horse,
  options?: {
    checkHealth?: boolean;
    minHealth?: number;
  }
): { eligible: boolean; reason?: string } {
  // Age requirement
  if (horse.age < 3) {
    return {
      eligible: false,
      reason: 'Horse must be at least 3 years old to train',
    };
  }

  // Retired horses do not train (the backend refuses them too).
  if (horse.age >= retirementAgeYears) {
    return {
      eligible: false,
      reason: 'Horse is too old to train',
    };
  }

  // A refusal the server has already made (it owns the health rules).
  if (horse.ineligibleReason) {
    return {
      eligible: false,
      reason: horse.ineligibleReason,
    };
  }

  // Cooldown check
  if (horse.trainingCooldown) {
    const cooldownDate = new Date(horse.trainingCooldown);
    const now = new Date();

    if (cooldownDate > now) {
      return {
        eligible: false,
        reason: `Horse is on cooldown until ${formatDate(cooldownDate)}`,
      };
    }
  }

  // Health check (optional)
  if (options?.checkHealth && horse.health !== undefined) {
    const minHealth = options.minHealth || 50;
    if (horse.health < minHealth) {
      return {
        eligible: false,
        reason: `Horse health (${horse.health}) is below minimum (${minHealth})`,
      };
    }
  }

  return { eligible: true };
}

/**
 * A horse's score in one discipline, read from `disciplineScores` as the API
 * sends it: keyed by the discipline's NAME ('Show Jumping'), not by the kebab id
 * this module uses for its own bookkeeping ('show-jumping'). The id is kept as a
 * fallback key for payloads that still use it (Equoria-znmtg).
 */
export function scoreForDiscipline(
  scores: Record<string, number> | undefined,
  disciplineId: string
): number {
  const name = getDisciplineById(disciplineId)?.name;
  return (name !== undefined ? scores?.[name] : undefined) ?? scores?.[disciplineId] ?? 0;
}

/**
 * Get the current score for a specific discipline
 */
export function getDisciplineScore(horse: Horse, disciplineId: string): number {
  return scoreForDiscipline(horse.disciplineScores, disciplineId);
}

/**
 * Format a date for display (used for cooldown dates)
 */
export function formatCooldownDate(date: Date | string | null): string {
  if (!date) return 'Available now';

  const cooldownDate = new Date(date);
  const now = new Date();

  if (cooldownDate <= now) {
    return 'Available now';
  }

  const diffTime = cooldownDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return '1 day';
  }

  if (diffDays < 7) {
    return `${diffDays} days`;
  }

  return formatDate(cooldownDate);
}

/**
 * Calculate days remaining until training is available
 */
export function getDaysUntilAvailable(cooldownDate: Date | string | null): number {
  if (!cooldownDate) return 0;

  const cooldown = new Date(cooldownDate);
  const now = new Date();

  if (cooldown <= now) return 0;

  const diffTime = cooldown.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get all disciplines grouped by category
 */
export function getDisciplinesGroupedByCategory(): Record<string, Discipline[]> {
  return {
    Western: getDisciplinesByCategory('Western'),
    English: getDisciplinesByCategory('English'),
    Specialized: getDisciplinesByCategory('Specialized'),
    Racing: getDisciplinesByCategory('Racing'),
  };
}

/**
 * Validate discipline ID
 */
export function isValidDiscipline(id: string): boolean {
  return DISCIPLINES.some((d) => d.id === id);
}

/**
 * Get category color for UI display
 */
export function getCategoryColor(
  category: 'Western' | 'English' | 'Specialized' | 'Racing'
): string {
  const colors = {
    Western: 'orange',
    English: 'blue',
    Specialized: 'purple',
    Racing: 'red',
  };

  return colors[category];
}
