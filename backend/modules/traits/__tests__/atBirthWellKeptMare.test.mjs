/**
 * Well-kept mare birth bonus uses the bible numbers (owner ruling 2026-10-28, q175;
 * Equoria-q4uem.17, Equoria-j0254).
 *
 * Bible 08 (prenatal table): "Mare stress <30 + good feed: ~10% chance of
 * Resilient / High Immunity-style positive flag". Equoria has no stress and High
 * Immunity is not on the trait roster, so a well-kept mare (feedQuality >= 80)
 * gives her foal a 10% chance of Resilient and nothing else.
 *
 * Old behaviour (unruled): 75% Resilient plus 60% People Trusting.
 *
 * Pure function, injected rng; no mocks.
 */

import { describe, expect, it } from '@jest/globals';
import { applyEpigeneticTraitsAtBirth } from '../../../utils/applyEpigeneticTraitsAtBirth.mjs';
import { seededRng } from '../../../__tests__/helpers/seededRng.mjs';

const mare = { id: 1, name: 'Well Kept Mare', bondScore: 50 };
const carried = r => [...r.positive, ...r.negative, ...r.hidden];
const born = (feedQuality, roll) =>
  carried(applyEpigeneticTraitsAtBirth({ mare, lineage: [], feedQuality, rng: () => roll }));

describe('well-kept mare birth bonus (bible 08, q175)', () => {
  it('a roll under 10% gives Resilient, and never People Trusting', () => {
    expect(born(90, 0.05)).toEqual(['resilient']);
  });

  it('a roll at or over 10% gives nothing (the old 75% / 60% bonus is gone)', () => {
    expect(born(90, 0.1)).toEqual([]);
    expect(born(90, 0.5)).toEqual([]);
  });

  it('a mare below the well-kept threshold gives nothing, whatever the roll', () => {
    expect(born(79, 0)).toEqual([]);
  });

  it('over many births about one in ten foals of a well-kept mare is Resilient', () => {
    const rng = seededRng(12345);
    const births = 1000;
    let resilient = 0;
    for (let i = 0; i < births; i++) {
      const traits = carried(applyEpigeneticTraitsAtBirth({ mare, lineage: [], feedQuality: 100, rng }));
      expect(traits).not.toContain('peopleTrusting');
      if (traits.includes('resilient')) {
        resilient += 1;
      }
    }
    expect(resilient / births).toBeGreaterThan(0.07);
    expect(resilient / births).toBeLessThan(0.13);
  });
});
