/**
 * Legacy trait tables name only roster traits (Equoria-qw4kp).
 *
 * Owner ruling 2026-10-27 (q117, q137): the twenty traits in
 * utils/epigeneticTraits.mjs are the only traits; every other trait name is
 * removed. These two tables still named retired traits (anxious, calm, social,
 * withdrawn, intelligent, ...):
 *   - the flag definitions' `conflictsWith` lists (config/epigeneticFlagDefinitions.mjs)
 *   - the environmental triggers' `traitsAffected` lists, which
 *     GET /horses/:id/environmental-analysis sends as `affectedTraits`
 *     (modules/traits/services/environmentalTriggerRules.mjs)
 */

import { describe, it, expect } from '@jest/globals';
import { getAllFlagDefinitions } from '../../../config/epigeneticFlagDefinitions.mjs';
import * as triggerRules from '../services/environmentalTriggerRules.mjs';
import { isRosterTrait } from '../../../utils/epigeneticTraits.mjs';

const offRoster = names => names.filter(name => !isRosterTrait(name));

describe('Equoria-qw4kp: legacy trait tables name only roster traits', () => {
  it('flag conflict lists name no retired trait', () => {
    const named = Object.values(getAllFlagDefinitions()).flatMap(flag => flag.conflictsWith ?? []);
    expect(named.length).toBeGreaterThan(0);
    expect(offRoster(named)).toEqual([]);
  });

  it('environmental trigger trait lists name no retired trait', () => {
    // Every trigger in the rules module (the triggers table is the one whose
    // entries carry traitsAffected).
    const named = Object.values(triggerRules)
      .filter(table => table && typeof table === 'object' && !Array.isArray(table))
      .flatMap(table => Object.values(table))
      .filter(entry => Array.isArray(entry?.traitsAffected))
      .flatMap(trigger => trigger.traitsAffected);
    expect(named.length).toBeGreaterThan(0);
    expect(offRoster(named)).toEqual([]);
  });
});
