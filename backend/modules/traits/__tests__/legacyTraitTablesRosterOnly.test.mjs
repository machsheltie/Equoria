/**
 * Legacy trait tables name only roster traits (Equoria-qw4kp).
 *
 * Owner ruling 2026-10-27 (q117, q137): the twenty traits in
 * utils/epigeneticTraits.mjs are the only traits; every other trait name is
 * removed. These tables still named retired traits (anxious, calm, social,
 * withdrawn, intelligent, ...):
 *   - the flag definitions' `conflictsWith` lists (config/epigeneticFlagDefinitions.mjs)
 *
 * The environmental triggers' `traitsAffected` lists went with
 * GET /horses/:id/environmental-analysis and environmentalTriggerRules
 * (Equoria-a7f1p), so they no longer need checking here.
 */

import { describe, it, expect } from '@jest/globals';
import { getAllFlagDefinitions } from '../../../config/epigeneticFlagDefinitions.mjs';
import { isRosterTrait } from '../../../utils/epigeneticTraits.mjs';

const offRoster = names => names.filter(name => !isRosterTrait(name));

describe('Equoria-qw4kp: legacy trait tables name only roster traits', () => {
  it('flag conflict lists name no retired trait', () => {
    const named = Object.values(getAllFlagDefinitions()).flatMap(flag => flag.conflictsWith ?? []);
    expect(named.length).toBeGreaterThan(0);
    expect(offRoster(named)).toEqual([]);
  });
});
