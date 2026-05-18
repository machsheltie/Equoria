/**
 * disciplineRecommendation tests (Equoria-pfp1w)
 *
 * Proves the recommended set is ranked BY the horse's real stat profile
 * (not the static DEFAULT_RECOMMENDED list) and that trait indicators are
 * derived from the horse's actual traits.
 */

import { describe, it, expect } from 'vitest';
import {
  rankDisciplinesForHorse,
  recommendedDisciplineOrder,
  disciplineMatchScores,
  disciplineTraitIndicators,
} from '../disciplineRecommendation';

// Real HorseSummary-ish: a sprinter — high speed/stamina/agility, low
// precision/focus/obedience. A stat-aware ranker MUST surface speed
// disciplines (Racing, Barrel Racing) above precision ones (Dressage).
const sprinter = {
  stats: {
    speed: 95,
    stamina: 90,
    agility: 88,
    intelligence: 70,
    precision: 20,
    focus: 25,
    obedience: 22,
    strength: 60,
    endurance: 75,
    balance: 50,
    boldness: 50,
    flexibility: 40,
  },
  traits: ['Athletic'],
};

describe('rankDisciplinesForHorse', () => {
  it('ranks by the horse real stat profile, not a static list', () => {
    const ranked = rankDisciplinesForHorse(sprinter);
    expect(ranked.length).toBeGreaterThan(0);

    const order = ranked.map((r) => r.discipline);
    const racingIdx = order.indexOf('Racing');
    const dressageIdx = order.indexOf('Dressage');

    // sprinter → Racing (speed/stamina/intelligence) must out-rank Dressage
    // (precision/focus/obedience). The OLD static DEFAULT_RECOMMENDED listed
    // Dressage FIRST regardless of horse — this asserts that is gone.
    expect(racingIdx).toBeGreaterThanOrEqual(0);
    expect(dressageIdx).toBeGreaterThan(racingIdx);

    // matchScore is the real weighted stat alignment (50/30/20)
    const racing = ranked.find((r) => r.discipline === 'Racing')!;
    // speed95*.5 + stamina90*.3 + intelligence70*.2 = 47.5+27+14 = 88.5 → 89
    expect(racing.matchScore).toBe(89);
    const dressage = ranked.find((r) => r.discipline === 'Dressage')!;
    // precision20*.5 + focus25*.3 + obedience22*.2 = 10+7.5+4.4 = 21.9 → 22
    expect(dressage.matchScore).toBe(22);
  });

  it('surfaces real trait indicators from the horse traits', () => {
    const ranked = rankDisciplinesForHorse(sprinter);
    // Athletic is a physical-discipline bonus → Racing should show a bonus
    const racing = ranked.find((r) => r.discipline === 'Racing')!;
    expect(racing.traitIndicators).toEqual([{ trait: 'athletic', kind: 'bonus' }]);

    // Dressage is a mental discipline → Athletic does NOT apply there
    const dressage = ranked.find((r) => r.discipline === 'Dressage')!;
    expect(dressage.traitIndicators).toEqual([]);
  });

  it('negative trait surfaces as a penalty indicator on physical disciplines', () => {
    const stubbornHorse = { ...sprinter, traits: ['Stubborn'] };
    const ranked = rankDisciplinesForHorse(stubbornHorse);
    const racing = ranked.find((r) => r.discipline === 'Racing')!;
    expect(racing.traitIndicators).toEqual([{ trait: 'stubborn', kind: 'penalty' }]);
  });

  it('reads flat stat fields when stats object is absent', () => {
    const flat = { speed: 80, stamina: 80, intelligence: 80, traits: [] };
    const ranked = rankDisciplinesForHorse(flat);
    const racing = ranked.find((r) => r.discipline === 'Racing');
    expect(racing?.matchScore).toBe(80);
  });

  it('returns empty (no fabrication) when horse missing or has no stats', () => {
    expect(rankDisciplinesForHorse(null)).toEqual([]);
    expect(rankDisciplinesForHorse(undefined)).toEqual([]);
    expect(rankDisciplinesForHorse({ stats: {}, traits: [] })).toEqual([]);
  });
});

describe('convenience selectors', () => {
  it('recommendedDisciplineOrder is the ranked name list, top first', () => {
    const order = recommendedDisciplineOrder(sprinter);
    expect(order[0]).not.toBe('Dressage');
    expect(order).toContain('Racing');
  });

  it('disciplineMatchScores maps discipline → real score', () => {
    const scores = disciplineMatchScores(sprinter);
    expect(scores.Racing).toBe(89);
    expect(scores.Dressage).toBe(22);
  });

  it('disciplineTraitIndicators only includes disciplines with real indicators', () => {
    const ind = disciplineTraitIndicators(sprinter);
    expect(ind.Racing).toEqual([{ trait: 'athletic', kind: 'bonus' }]);
    expect(ind.Dressage).toBeUndefined();
  });
});
