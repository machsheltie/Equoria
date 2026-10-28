/** Equoria-bdpvw — a discipline reads as its authored name from any stored spelling. */
import { describe, it, expect } from 'vitest';
import { competitionDisciplineLabel, disciplineLabel } from '../utils/training-utils';

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

/** Equoria-q4pb8 — a show result's discipline column can hold the show type. */
describe('competitionDisciplineLabel', () => {
  it.each([
    ['conformation', 'Conformation'],
    ['parade', 'Parade'],
    ['Show Jumping', 'Show Jumping'],
    ['showJumping', 'Show Jumping'],
  ])('%s reads %s', (raw, label) => {
    expect(competitionDisciplineLabel(raw)).toBe(label);
  });

  it('an unknown or missing value never surfaces raw', () => {
    expect(competitionDisciplineLabel(['trust', 'building'].join('_'))).toBe('Another Discipline');
    expect(competitionDisciplineLabel(null)).toBe('Another Discipline');
  });
});
