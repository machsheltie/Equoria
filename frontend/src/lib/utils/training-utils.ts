/**
 * Training Utilities
 *
 * Provides utility functions for the training system:
 * - Discipline data and categorization (23 disciplines, 4 categories)
 * - Score gain calculations
 * - Training eligibility checks
 * - Formatting helpers
 *
 * Story 4-1: Training Session Interface - Task 1
 */

export interface Discipline {
  id: string;
  name: string;
  category: 'Western' | 'English' | 'Specialized' | 'Racing';
  description: string;
  primaryStats: string[];
}

/**
 * Complete list of all 23 disciplines in Equoria
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

  // Specialized Disciplines (7)
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
 * Calculate expected score gain based on base gain and trait modifiers
 *
 * @param baseGain - Base score gain (+5 typically)
 * @param traitModifiers - Array of trait modifier values (e.g., [+1, -2, +1])
 * @returns Total expected gain
 */
export function calculateExpectedGain(baseGain: number, traitModifiers: number[]): number {
  const traitBonus = traitModifiers.reduce((sum, mod) => sum + mod, 0);
  return Math.max(0, baseGain + traitBonus); // Never negative
}

/**
 * Check if a horse is eligible for training
 *
 * Requirements:
 * - Horse must be 3+ years old
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

  // Cooldown check
  if (horse.trainingCooldown) {
    const cooldownDate = new Date(horse.trainingCooldown);
    const now = new Date();

    if (cooldownDate > now) {
      return {
        eligible: false,
        reason: `Horse is on cooldown until ${cooldownDate.toLocaleDateString()}`,
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
 * Get the current score for a specific discipline
 */
export function getDisciplineScore(horse: Horse, disciplineId: string): number {
  return horse.disciplineScores?.[disciplineId] || 0;
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

  return cooldownDate.toLocaleDateString();
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

/**
 * Trait Modifier Interface
 *
 * Represents a trait modifier that affects training performance.
 * Used for calculating net training effects based on horse traits.
 */
export interface TraitModifier {
  traitId: string;
  traitName: string;
  effect: number;
  description: string;
  affectedDisciplines: string[];
  category: 'positive' | 'negative' | 'neutral';
}

/**
 * Calculates the net effect of trait modifiers on training
 *
 * @param baseGain - Base training gain (typically 5)
 * @param modifiers - Array of trait modifiers
 * @returns Net training gain after applying all modifiers
 */
export function calculateNetEffect(baseGain: number, modifiers: TraitModifier[]): number {
  const positiveSum = modifiers
    .filter((m) => m.category === 'positive')
    .reduce((sum, m) => sum + m.effect, 0);

  const negativeSum = Math.abs(
    modifiers.filter((m) => m.category === 'negative').reduce((sum, m) => sum + m.effect, 0)
  );

  return baseGain + positiveSum - negativeSum;
}

/**
 * Groups trait modifiers by their category
 *
 * @param modifiers - Array of trait modifiers
 * @returns Object with positive, negative, and neutral arrays
 */
export function groupModifiersByCategory(modifiers: TraitModifier[]): {
  positive: TraitModifier[];
  negative: TraitModifier[];
  neutral: TraitModifier[];
} {
  return {
    positive: modifiers.filter((m) => m.category === 'positive'),
    negative: modifiers.filter((m) => m.category === 'negative'),
    neutral: modifiers.filter((m) => m.category === 'neutral'),
  };
}

/**
 * Mock trait database for trait modifier lookups
 *
 * NOTE: In production, this would be fetched from the backend API.
 * This is a mock implementation for client-side calculations.
 */
const traitDatabase: Record<string, TraitModifier> = {
  athletic: {
    traitId: 'athletic',
    traitName: 'Athletic',
    effect: 3,
    description: 'Enhances performance in physical disciplines',
    affectedDisciplines: ['racing', 'show-jumping', 'barrel-racing'],
    category: 'positive',
  },
  stubborn: {
    traitId: 'stubborn',
    traitName: 'Stubborn',
    effect: -2,
    description: 'Reduces training effectiveness',
    affectedDisciplines: ['all'],
    category: 'negative',
  },
  intelligent: {
    traitId: 'intelligent',
    traitName: 'Intelligent',
    effect: 4,
    description: 'Learns techniques quickly',
    affectedDisciplines: ['dressage', 'western-pleasure'],
    category: 'positive',
  },
  'quick-learner': {
    traitId: 'quick-learner',
    traitName: 'Quick Learner',
    effect: 2,
    description: 'Picks up new skills faster',
    affectedDisciplines: ['all'],
    category: 'positive',
  },
  calm: {
    traitId: 'calm',
    traitName: 'Calm',
    effect: 0,
    description: 'Maintains composure under pressure',
    affectedDisciplines: ['all'],
    category: 'neutral',
  },
};

/**
 * Gets trait modifiers that apply to a specific discipline
 *
 * NOTE: This is a mock implementation. In production, this would query horse traits
 * from the backend API.
 *
 * @param horseTraits - Array of trait IDs the horse has (e.g., ['athletic', 'stubborn'])
 * @param discipline - Discipline ID (e.g., 'racing', 'dressage')
 * @returns Array of trait modifiers that affect this discipline
 */
export function getTraitModifiersForDiscipline(
  horseTraits: string[],
  discipline: string
): TraitModifier[] {
  // Get modifiers for traits the horse has
  const modifiers: TraitModifier[] = [];

  for (const traitId of horseTraits) {
    const trait = traitDatabase[traitId];
    if (!trait) continue;

    // Check if trait affects this discipline
    if (
      trait.affectedDisciplines.includes('all') ||
      trait.affectedDisciplines.includes(discipline)
    ) {
      modifiers.push(trait);
    }
  }

  return modifiers;
}
