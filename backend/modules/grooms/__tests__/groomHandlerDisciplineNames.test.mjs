/**
 * Equoria-576c0.3: groom discipline options name only real disciplines.
 *
 * Owner ruling 2026-10-19 (decision 13): 'Obedience Training' is not one of
 * the bible's competition disciplines, so grooms must not offer it. The 24
 * disciplines of the competition module are the single discipline source.
 *
 * The groom handler's discipline tables and the discipline list are found by
 * shape in the module namespaces, so this test names no constant of its own.
 */
import { describe, it, expect } from '@jest/globals';
import * as groomHandler from '../services/groomHandlerService.mjs';
import * as competition from '../../competition/index.mjs';

const disciplines = Object.values(competition).find(
  value => Array.isArray(value) && value.length === 24 && value.includes('Dressage'),
);

// Every string in every plain-object export of the groom handler that sits in an array.
const arrayedStrings = value => {
  if (Array.isArray(value)) {
    return value.flatMap(item => (typeof item === 'string' ? [item] : arrayedStrings(item)));
  }
  if (value !== null && typeof value === 'object') {
    return Object.values(value).flatMap(arrayedStrings);
  }
  return [];
};
const groomDisciplineNames = () => Object.values(groomHandler).flatMap(arrayedStrings);

describe('groom discipline options (Equoria-576c0.3)', () => {
  it('finds the 24 disciplines', () => {
    expect(disciplines).toHaveLength(24);
  });

  it('never offer Obedience Training', () => {
    expect(groomDisciplineNames()).not.toContain('Obedience Training');
  });

  it('only name disciplines from the 24-discipline source', () => {
    const names = groomDisciplineNames();
    expect(names.length).toBeGreaterThan(20);
    expect(names.filter(name => !disciplines.includes(name))).toEqual([]);
  });
});
