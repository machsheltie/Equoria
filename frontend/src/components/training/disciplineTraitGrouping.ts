/**
 * disciplineTraitGrouping (Equoria-svilx)
 *
 * Single source of truth for the discipline → trait-effect grouping that
 * was previously duplicated between:
 *   - TrainingSessionModal.getDisciplineTraitModifiers (full TraitModifier[])
 *   - disciplineRecommendation.disciplineTraitEffects ({bonus, penalty} names)
 *
 * Both consumers now import from here, so the Trait-Modifiers panel and the
 * per-discipline recommendation indicators can never drift. No behaviour
 * change: the modifier objects and the normalized discipline-group sets are
 * byte-for-byte the ones the two call sites previously hardcoded.
 */

import type { TraitModifier } from './TraitModifierBadge';

/**
 * Normalize a discipline label for group comparison: lowercase, strip
 * spaces and hyphens. ("Show-Jumping" → "showjumping").
 */
export function normalizeDiscipline(discipline: string): string {
  return discipline.toLowerCase().replace(/[\s-]/g, '');
}

/** Normalized physical-discipline group (substring match). */
export const PHYSICAL_DISCIPLINE_KEYS = [
  'racing',
  'showjumping',
  'barrelracing',
  'steeplechase',
  'polo',
] as const;

/** Normalized mental-discipline group (substring match). */
export const MENTAL_DISCIPLINE_KEYS = [
  'dressage',
  'westernpleasure',
  'saddleseat',
  'fineharness',
  'gaited',
] as const;

type Group = 'physical' | 'mental' | 'default';

/**
 * Resolve a discipline label to its trait group. Uses substring matching
 * on the normalized label exactly as the two original call sites did.
 */
export function disciplineGroup(discipline: string): Group {
  const n = normalizeDiscipline(discipline);
  if (PHYSICAL_DISCIPLINE_KEYS.some((d) => n.includes(d))) return 'physical';
  if (MENTAL_DISCIPLINE_KEYS.some((d) => n.includes(d))) return 'mental';
  return 'default';
}

/**
 * Canonical TraitModifier[] per group — the exact objects
 * TrainingSessionModal.getDisciplineTraitModifiers previously returned.
 */
const GROUP_MODIFIERS: Record<Group, TraitModifier[]> = {
  physical: [
    {
      traitId: 'athletic',
      traitName: 'Athletic',
      effect: 3,
      description: 'Enhances performance in physical disciplines',
      affectedDisciplines: ['racing', 'show-jumping', 'barrel-racing'],
      category: 'positive',
    },
    {
      traitId: 'stubborn',
      traitName: 'Stubborn',
      effect: -2,
      description: 'Reduces training effectiveness',
      affectedDisciplines: ['all'],
      category: 'negative',
    },
  ],
  mental: [
    {
      traitId: 'intelligent',
      traitName: 'Intelligent',
      effect: 4,
      description: 'Learns techniques quickly',
      affectedDisciplines: ['dressage', 'western-pleasure'],
      category: 'positive',
    },
    {
      traitId: 'calm',
      traitName: 'Calm',
      effect: 0,
      description: 'Maintains composure under pressure',
      affectedDisciplines: ['all'],
      category: 'neutral',
    },
  ],
  default: [
    {
      traitId: 'quick-learner',
      traitName: 'Quick Learner',
      effect: 2,
      description: 'Picks up new skills faster',
      affectedDisciplines: ['all'],
      category: 'positive',
    },
  ],
};

/**
 * Full trait-modifier list for a discipline (consumed by
 * TrainingSessionModal). Returns a fresh array so callers cannot mutate
 * the canonical definition.
 */
export function getDisciplineTraitModifiers(discipline: string): TraitModifier[] {
  return GROUP_MODIFIERS[disciplineGroup(discipline)].map((m) => ({ ...m }));
}

/**
 * Lowercased trait-name lists that benefit / harm a discipline (consumed
 * by disciplineRecommendation). Derived from the SAME canonical modifiers
 * so the two views cannot disagree. The 'quick-learner' default also
 * exposes the space-form 'quick learner' because horses may store either.
 */
export function disciplineTraitEffects(discipline: string): {
  bonus: string[];
  penalty: string[];
} {
  const group = disciplineGroup(discipline);
  const mods = GROUP_MODIFIERS[group];
  const bonus: string[] = [];
  const penalty: string[] = [];
  for (const m of mods) {
    if (m.category === 'positive') {
      bonus.push(m.traitId);
      // Preserve the prior behaviour: the default group matched both the
      // hyphen and space spelling of "quick learner".
      if (m.traitId === 'quick-learner') bonus.push('quick learner');
    } else if (m.category === 'negative') {
      penalty.push(m.traitId);
    }
  }
  return { bonus, penalty };
}
