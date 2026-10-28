/** Equoria-q4pb8 — a tack category reads as an authored word, never the stored code. */
import { describe, it, expect } from 'vitest';
import { knownTackCategoryLabels, tackCategoryLabel } from '../tackLabels';

describe('tackCategoryLabel', () => {
  it.each([
    ['saddle', 'Saddle'],
    [['saddle', 'pad'].join('_'), 'Saddle Pad'],
    ['saddlePad', 'Saddle Pad'],
    [['leg', 'wraps'].join('_'), 'Leg Wraps'],
    ['breastplate', 'Breastplate'],
    ['decorative', 'Decorative'],
  ])('%s reads %s', (raw, label) => {
    expect(tackCategoryLabel(raw)).toBe(label);
  });

  it('covers every category the tack catalogue stores', () => {
    const stored = [
      'saddle',
      'bridle',
      'halter',
      'saddlePad',
      'legWraps',
      'reins',
      'girth',
      'breastplate',
      'decorative',
    ];
    for (const category of stored) {
      expect(knownTackCategoryLabels[category]).toBeTruthy();
    }
  });

  it('an unknown or missing category never surfaces raw', () => {
    expect(tackCategoryLabel(['hoof', 'boots'].join('_'))).toBe('Tack');
    expect(tackCategoryLabel(undefined)).toBe('Tack');
  });
});
