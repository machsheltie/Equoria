/**
 * temperamentMatrix.test.mjs (Equoria-576c0 B6)
 *
 * Owner ruling R1 (Stacey, 2026-10-15): a horse's temperament is +5%, 0 or -5%
 * in a ridden competition, by discipline, per the owner's matrix
 * EquoriaBible/RelevantFiles/Equoria_Temperament_Competition_Matrix.xlsx, sheet
 * "Matrix" (O4 resolved 2026-10-16: the Matrix cells govern; the Notes sheet is
 * commentary).
 *
 * SHEET below is an independent copy of that sheet's 24 discipline rows, in the
 * sheet's own words and column order, generated from the xlsx (read-only) on
 * 2026-10-17. Every one of the 24 x 11 = 264 cells is checked against
 * rules/disciplineRules.mjs.
 */

import { describe, it, expect } from '@jest/globals';
import {
  COMPETITION_DISCIPLINES,
  TEMPERAMENTS,
  TEMPERAMENT_MATRIX,
  temperamentPercent,
} from '../rules/disciplineRules.mjs';

const SHEET_HEADER = [
  'Spirited',
  'Nervous',
  'Calm',
  'Bold',
  'Steady',
  'Independent',
  'Reactive',
  'Stubborn',
  'Playful',
  'Lazy',
  'Aggressive',
];
const SHEET = [
  'Western Pleasure\tNeutral\tNegative\tPositive\tNeutral\tPositive\tNegative\tNegative\tNegative\tNeutral\tPositive\tNegative',
  'Reining\tPositive\tNegative\tNeutral\tPositive\tPositive\tNeutral\tNeutral\tNegative\tNegative\tNegative\tNegative',
  'Cutting\tPositive\tNegative\tPositive\tPositive\tNeutral\tPositive\tPositive\tNegative\tNeutral\tNegative\tNeutral',
  'Barrel Racing\tPositive\tNegative\tNeutral\tPositive\tNeutral\tNeutral\tNeutral\tNegative\tNeutral\tNegative\tNegative',
  'Roping\tNeutral\tNegative\tPositive\tPositive\tPositive\tPositive\tNeutral\tNegative\tNegative\tNegative\tNegative',
  'Team Penning\tPositive\tNegative\tNeutral\tPositive\tNeutral\tPositive\tNeutral\tNegative\tNeutral\tNegative\tNegative',
  'Rodeo\tPositive\tNegative\tNeutral\tPositive\tPositive\tNeutral\tNegative\tNegative\tNeutral\tNegative\tNegative',
  'Hunter\tNegative\tNegative\tPositive\tNeutral\tPositive\tNeutral\tNegative\tNegative\tNeutral\tNeutral\tNegative',
  'Saddleseat\tPositive\tNegative\tNeutral\tPositive\tNeutral\tNegative\tNeutral\tNegative\tNeutral\tNegative\tNegative',
  'Endurance\tNeutral\tNegative\tPositive\tPositive\tPositive\tPositive\tNegative\tNegative\tNeutral\tNegative\tNegative',
  'Eventing\tPositive\tNegative\tPositive\tPositive\tNeutral\tPositive\tNegative\tNegative\tNeutral\tNegative\tNegative',
  'Dressage\tNeutral\tNegative\tPositive\tNeutral\tPositive\tNegative\tNegative\tNegative\tNeutral\tNeutral\tNegative',
  'Show Jumping\tPositive\tNegative\tNeutral\tPositive\tNeutral\tNeutral\tNeutral\tNegative\tNeutral\tNegative\tNegative',
  'Vaulting\tNegative\tNegative\tPositive\tNeutral\tPositive\tNeutral\tNegative\tNegative\tNeutral\tNeutral\tNegative',
  'Polo\tPositive\tNegative\tNeutral\tPositive\tNeutral\tPositive\tNeutral\tNegative\tNeutral\tNegative\tNeutral',
  'Cross Country\tPositive\tNegative\tNeutral\tPositive\tNeutral\tPositive\tNegative\tNegative\tNeutral\tNegative\tNegative',
  'Combined Driving\tNeutral\tNegative\tPositive\tPositive\tPositive\tNegative\tNegative\tNegative\tNeutral\tNegative\tNegative',
  'Fine Harness\tPositive\tNegative\tNeutral\tPositive\tNeutral\tNegative\tNegative\tNegative\tNeutral\tNegative\tNegative',
  'Gaited\tPositive\tNegative\tPositive\tNeutral\tNeutral\tNeutral\tNegative\tNegative\tNeutral\tNegative\tNegative',
  'Gymkhana\tPositive\tNegative\tPositive\tPositive\tNeutral\tNeutral\tNeutral\tNegative\tPositive\tNegative\tNegative',
  'Steeplechase\tPositive\tNegative\tNeutral\tPositive\tNeutral\tPositive\tNegative\tNegative\tNeutral\tNegative\tNeutral',
  'Harness Racing\tPositive\tNegative\tNeutral\tNeutral\tPositive\tNeutral\tNegative\tNegative\tNegative\tNegative\tNeutral',
  'Racing\tPositive\tNegative\tNeutral\tPositive\tNeutral\tNeutral\tNeutral\tNegative\tNeutral\tNegative\tNeutral',
  // Owner ruling 2026-10-21: Pleasure Driving is the 24th discipline. Old contract: 23. The owner's row, Playful from her Driven cell.
  'Pleasure Driving\tPositive\tNegative\tPositive\tPositive\tPositive\tNeutral\tNegative\tNegative\tNegative\tNeutral\tNegative',
];
const PERCENT = { Positive: 5, Neutral: 0, Negative: -5 };

const cells = SHEET.flatMap(line => {
  const [discipline, ...values] = line.split('\t');
  return values.map((value, i) => ({ discipline, temperament: SHEET_HEADER[i], value }));
});

describe("the temperament matrix is the owner's Matrix sheet (R1, O4)", () => {
  it("has the 11 temperaments in the sheet's order", () => {
    expect(TEMPERAMENTS).toEqual(SHEET_HEADER);
  });

  it('has exactly the 24 competition disciplines', () => {
    expect(SHEET).toHaveLength(24);
    expect(Object.keys(TEMPERAMENT_MATRIX).sort()).toEqual([...COMPETITION_DISCIPLINES].sort());
  });

  it('matches all 264 cells: Positive +5, Neutral 0, Negative -5', () => {
    expect(cells).toHaveLength(264);
    const mismatches = cells.filter(c => temperamentPercent(c.discipline, c.temperament) !== PERCENT[c.value]);
    expect(mismatches).toEqual([]);
  });

  it('keeps the two O4 cells as the sheet has them', () => {
    expect(temperamentPercent('Show Jumping', 'Nervous')).toBe(-5);
    expect(temperamentPercent('Reining', 'Independent')).toBe(0);
  });

  it('answers null, not a number, for a missing or unknown temperament or discipline', () => {
    expect(temperamentPercent('Dressage', null)).toBeNull();
    expect(temperamentPercent('Dressage', undefined)).toBeNull();
    expect(temperamentPercent('Dressage', 'Grumpy')).toBeNull();
    expect(temperamentPercent('Dressage', 'calm')).toBeNull();
    expect(temperamentPercent('Obedience Training', 'Calm')).toBeNull();
    expect(temperamentPercent('Dressage', 'toString')).toBeNull();
  });
});
