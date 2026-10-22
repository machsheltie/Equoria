/**
 * Tied ridden scores are separated by a luck re-roll among the tied horses
 * (Equoria-bvddn.22; owner ruling 2026-10-22: "the luck roll is re-rolled among
 * the tied horses to decide the order", never shared placings or split prizes).
 *
 * rankScoredEntries is pure: these cases drive it with a scripted rng. The
 * executor-level case (strict placements, unsplit prizes on a real show) lives
 * in showSettlementTieBreak.integration.test.mjs.
 */

import { describe, it, expect } from '@jest/globals';
import { rankScoredEntries, rollLuckPercent } from '../services/competitionScoring.mjs';

/** An rng that answers `values` in order and fails loudly when it runs out. */
function scripted(values) {
  const queue = [...values];
  const rng = () => {
    if (queue.length === 0) {
      throw new Error('rng called more often than the test scripted');
    }
    return queue.shift();
  };
  rng.remaining = () => queue.length;
  return rng;
}

const item = (horseId, score) => ({ entry: { horseId }, score });
const order = ranked => ranked.map(r => r.entry.horseId);

describe('rankScoredEntries (Equoria-bvddn.22)', () => {
  it('ranks by score and never rolls when nobody ties', () => {
    const rng = scripted([]);
    expect(order(rankScoredEntries([item(1, 70), item(2, 90), item(3, 80)], rng))).toEqual([2, 3, 1]);
  });

  it('re-rolls only the tied horses; the others keep their places and every score stays as tied', () => {
    // Horses 2 and 3 tie on 80; they roll in horseId order: 2 rolls 1%, 3 rolls 10%.
    expect(rollLuckPercent(() => 0.05)).toBe(1);
    expect(rollLuckPercent(() => 0.95)).toBe(10);
    const rng = scripted([0.05, 0.95]);
    const ranked = rankScoredEntries([item(3, 80), item(1, 95), item(2, 80), item(4, 60)], rng);
    expect(order(ranked)).toEqual([1, 3, 2, 4]);
    expect(ranked.map(r => r.score)).toEqual([95, 80, 80, 60]);
    expect(rng.remaining()).toBe(0);
  });

  it('horses that roll the same re-roll among themselves until the order is strict', () => {
    // Round 1: 1 and 2 both roll 6%, 3 rolls 2% -> 3 is last; round 2 between
    // 1 and 2: 1 rolls 3%, 2 rolls 9% -> 2 ahead of 1.
    const rng = scripted([0.5, 0.5, 0.1, 0.2, 0.8]);
    expect(order(rankScoredEntries([item(1, 50), item(2, 50), item(3, 50)], rng))).toEqual([2, 1, 3]);
    expect(rng.remaining()).toBe(0);
  });

  it('a fixed rng that can never break the tie still terminates, in horseId order', () => {
    const ranked = rankScoredEntries([item(9, 40), item(4, 40), item(7, 40)], () => 0.3);
    expect(order(ranked)).toEqual([4, 7, 9]);
  });
});
