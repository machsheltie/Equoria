/**
 * Sentinel: full discipline-affinity coverage (Equoria-9o3n7.5, §F).
 *
 * Asserts that EVERY canonical discipline has a disciplineAffinity<Discipline>
 * traitEffects entry with rich effects, and that the at-birth emitter's affinity
 * key, the competition scorer's key, and the effects map all agree (no
 * jumping/show_jumping drift). Sentinel-positive: a planted bogus discipline
 * key would have no effect entry and fail the resolution assertion.
 */

import { describe, it, expect } from '@jest/globals';
import { getAllTraitEffects, getTraitEffects } from '../../../utils/traitEffects.mjs';
import { DISCIPLINES } from '../../../constants/schema.mjs';
import { disciplineAffinityKey } from '../../../utils/epigeneticTraitKeyMap.mjs';

const disciplines = Object.values(DISCIPLINES);

describe('§F discipline-affinity coverage — every discipline resolves', () => {
  it('has 23 canonical disciplines', () => {
    expect(disciplines.length).toBe(23);
  });

  it.each(disciplines)('disciplineAffinity for "%s" resolves to a rich effect entry', discipline => {
    const key = disciplineAffinityKey(discipline);
    const effects = getTraitEffects(key);
    expect(effects).not.toBeNull();
    // +5 match bonus is applied by the scorer when key matches; here assert the
    // rich effects exist: competition score modifier, a discipline-specific
    // modifier for THIS discipline, and a baseStatBoost.
    expect(effects.competitionScoreModifier).toBeGreaterThan(0);
    expect(effects.disciplineModifiers[discipline]).toBeGreaterThan(0);
    expect(typeof effects.baseStatBoost).toBe('object');
    expect(Object.keys(effects.baseStatBoost).length).toBeGreaterThan(0);
  });

  it('the historic jumping/show_jumping drift is resolved: "Show Jumping" key has an effect', () => {
    const key = disciplineAffinityKey('Show Jumping');
    expect(key).toBe('disciplineAffinityShowJumping');
    expect(getTraitEffects(key)).not.toBeNull();
  });

  it('every disciplineAffinity* key in traitEffects maps back to a canonical discipline', () => {
    const affinityKeys = Object.keys(getAllTraitEffects()).filter(k => k.startsWith('disciplineAffinity'));
    const canonicalKeys = new Set(disciplines.map(disciplineAffinityKey));
    expect(affinityKeys.length).toBe(disciplines.length);
    for (const k of affinityKeys) {
      expect(canonicalKeys.has(k)).toBe(true);
    }
  });

  it('SENTINEL-POSITIVE: a bogus discipline key does NOT resolve (proves the check is real)', () => {
    expect(getTraitEffects('disciplineAffinityNotARealDiscipline')).toBeNull();
  });
});
