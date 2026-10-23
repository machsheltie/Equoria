/**
 * Equoria-576c0.3: groom discipline options name only real disciplines.
 *
 * Owner ruling 2026-10-19 (decision 13): 'Obedience Training' is not one of
 * the bible's competition disciplines, so grooms must not offer it. The 24
 * disciplines in disciplineRules.mjs are the single discipline source.
 */
import { describe, it, expect } from '@jest/globals';
import { PERSONALITY_DISCIPLINE_SYNERGY, SPECIALTY_DISCIPLINE_BONUSES } from '../services/groomHandlerService.mjs';
import { COMPETITION_DISCIPLINES } from '../../competition/index.mjs';

const groomDisciplineNames = () => [
  ...Object.values(PERSONALITY_DISCIPLINE_SYNERGY).flatMap(entry => entry.beneficial),
  ...Object.values(SPECIALTY_DISCIPLINE_BONUSES).flatMap(entry => entry.disciplines),
];

describe('groom discipline options (Equoria-576c0.3)', () => {
  it('never offer Obedience Training', () => {
    expect(groomDisciplineNames()).not.toContain('Obedience Training');
  });

  it('only name disciplines from the 24-discipline source', () => {
    const unknown = groomDisciplineNames().filter(name => !COMPETITION_DISCIPLINES.includes(name));
    expect(unknown).toEqual([]);
  });
});
