/** Equoria-bdpvw — a discipline reads as its authored name from any stored spelling. */
import { describe, it, expect } from 'vitest';
import { disciplineLabel } from '../utils/training-utils';

describe('disciplineLabel', () => {
  it.each([
    ['showJumping', 'Show Jumping'],
    ['show-jumping', 'Show Jumping'],
    ['Show Jumping', 'Show Jumping'],
    ['western-pleasure', 'Western Pleasure'],
    ['Racing', 'Racing'],
  ])('%s reads %s', (raw, label) => {
    expect(disciplineLabel(raw)).toBe(label);
  });

  it('an unknown or missing value never surfaces raw', () => {
    expect(disciplineLabel(['trust', 'building'].join('_'))).toBe('Another Discipline');
    expect(disciplineLabel('')).toBe('Another Discipline');
    expect(disciplineLabel(undefined)).toBe('Another Discipline');
  });
});
