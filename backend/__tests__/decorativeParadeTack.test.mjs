/**
 * Tests for Decorative & Parade Tack System (Equoria-rmlh).
 *
 * Covers:
 *   - TACK_INVENTORY decorative items shape and values
 *   - resolveTackBonus() with parade showType
 *   - simulateCompetition() parade scoring branch (presenceBonus × groomBondModifier)
 */

import { jest } from '@jest/globals';

// ── Mocks (must precede dynamic imports) ─────────────────────────────────────

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
jest.unstable_mockModule('../utils/logger.mjs', () => ({ default: mockLogger }));

// ── Dynamic imports (after mocks) ────────────────────────────────────────────

const { TACK_INVENTORY, resolveTackBonus } = await import(
  '../modules/services/controllers/tackShopController.mjs'
);
const { simulateCompetition } = await import('../logic/simulateCompetition.mjs');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimal horse for simulateCompetition */
function makeHorse(overrides = {}) {
  return {
    id: 1,
    name: 'TestHorse',
    speed: 50,
    stamina: 50,
    agility: 50,
    intelligence: 50,
    precision: 50,
    focus: 50,
    boldness: 50,
    coordination: 50,
    flexibility: 50,
    obedience: 50,
    health: 'Good',
    stress_level: 0,
    tack: null,
    rider: null,
    trainingScore: 0,
    trait: null,
    epigenetic_modifiers: { positive: [], negative: [], hidden: [] },
    temperament: null,
    ...overrides,
  };
}

/** Ridden show */
function makeShow(overrides = {}) {
  return { discipline: 'Racing', showType: 'ridden', ...overrides };
}

// ─────────────────────────────────────────────────────────────────────────────
// TACK_INVENTORY — decorative items shape
// ─────────────────────────────────────────────────────────────────────────────

describe('TACK_INVENTORY — decorative items', () => {
  const decorative = TACK_INVENTORY.filter(i => i.category === 'decorative');

  it('exports at least 5 decorative items', () => {
    expect(decorative.length).toBeGreaterThanOrEqual(5);
  });

  it('every decorative item has isCosmetic: true and presenceBonus >= 1', () => {
    for (const item of decorative) {
      expect(item.isCosmetic).toBe(true);
      expect(typeof item.presenceBonus).toBe('number');
      expect(item.presenceBonus).toBeGreaterThanOrEqual(1);
    }
  });

  it('required items present: show-ribbon, braided-mane-wrap, parade-blanket, glitter-spray, floral-browband', () => {
    const ids = decorative.map(i => i.id);
    for (const required of [
      'show-ribbon',
      'braided-mane-wrap',
      'parade-blanket',
      'glitter-spray',
      'floral-browband',
    ]) {
      expect(ids).toContain(required);
    }
  });

  it('at least one item has a seasonalTag', () => {
    expect(decorative.some(i => typeof i.seasonalTag === 'string')).toBe(true);
  });

  it('snowflake-parade-tack has seasonalTag: winter', () => {
    const item = decorative.find(i => i.id === 'snowflake-parade-tack');
    expect(item).toBeDefined();
    expect(item.seasonalTag).toBe('winter');
  });

  it('glitter-spray has limitedUse: 3', () => {
    const item = decorative.find(i => i.id === 'glitter-spray');
    expect(item.limitedUse).toBe(3);
  });

  it('all decorative items have numericBonus: 0 (no stat effect)', () => {
    for (const item of decorative) {
      expect(item.numericBonus).toBe(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveTackBonus — parade showType
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveTackBonus() — parade presenceBonus', () => {
  it('returns presenceBonus 0 for null tack', () => {
    expect(resolveTackBonus(null, 'parade')).toEqual({
      saddleBonus: 0,
      bridleBonus: 0,
      presenceBonus: 0,
    });
  });

  it('returns presenceBonus 0 for empty tack (no decorations)', () => {
    expect(resolveTackBonus({}, 'parade')).toEqual({
      saddleBonus: 0,
      bridleBonus: 0,
      presenceBonus: 0,
    });
  });

  it('sums presenceBonus for a single decoration', () => {
    // show-ribbon has presenceBonus: 3
    const tack = { decorations: ['show-ribbon'] };
    const result = resolveTackBonus(tack, 'parade');
    expect(result.presenceBonus).toBe(3);
  });

  it('sums presenceBonus for multiple decorations', () => {
    // show-ribbon (3) + floral-browband (3) = 6
    const tack = { decorations: ['show-ribbon', 'floral-browband'] };
    const result = resolveTackBonus(tack, 'parade');
    expect(result.presenceBonus).toBe(6);
  });

  it('ignores unknown item IDs gracefully', () => {
    const tack = { decorations: ['show-ribbon', 'not-a-real-item'] };
    const result = resolveTackBonus(tack, 'parade');
    expect(result.presenceBonus).toBe(3); // only show-ribbon counted
  });

  it('returns presenceBonus 0 for ridden showType even with decorations', () => {
    const tack = { decorations: ['show-ribbon', 'floral-browband'] };
    const result = resolveTackBonus(tack, 'ridden');
    expect(result.presenceBonus).toBe(0);
  });

  it('returns presenceBonus 0 for conformation showType with decorations', () => {
    const tack = { decorations: ['parade-blanket'] };
    const result = resolveTackBonus(tack, 'conformation');
    expect(result.presenceBonus).toBe(0);
  });

  it('parade + saddle: returns both saddleBonus and presenceBonus', () => {
    const tack = { saddle: 'basic-saddle', decorations: ['show-ribbon'] };
    const result = resolveTackBonus(tack, 'parade');
    expect(result.presenceBonus).toBe(3);
    // saddleBonus depends on whether basic-saddle is in the catalog — just verify type
    expect(typeof result.saddleBonus).toBe('number');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// simulateCompetition — parade scoring branch
// ─────────────────────────────────────────────────────────────────────────────

describe('simulateCompetition() — parade show scoring', () => {
  let mathRandomSpy;

  beforeEach(() => {
    // Lock Math.random = 0.5 → deterministic luck (depends on simulateCompetition's luck formula)
    mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    mathRandomSpy.mockRestore();
  });

  it('parade show applies presenceBonus × 10 as tackBonus', () => {
    // show-ribbon (presenceBonus 3) + floral-browband (3) = 6 → tackBonus = 60
    const horse = makeHorse({ tack: { decorations: ['show-ribbon', 'floral-browband'] } });
    const show = makeShow({ showType: 'parade' });

    const results = simulateCompetition([horse], show);
    expect(results).toHaveLength(1);
    // Score should be meaningfully above base (decorations add 60 pts)
    expect(results[0].score).toBeGreaterThan(50);
  });

  it('parade show without decorations gets no tack bonus', () => {
    const horseWithDeco = makeHorse({ tack: { decorations: ['parade-blanket'] } }); // presenceBonus 5 → +50
    const horseNoDeco = makeHorse({ tack: {} });

    const show = makeShow({ showType: 'parade' });
    const withDeco = simulateCompetition([horseWithDeco], show)[0].score;
    const noDeco = simulateCompetition([horseNoDeco], show)[0].score;

    expect(withDeco).toBeGreaterThan(noDeco);
  });

  it('ridden show ignores decorations (presenceBonus not applied)', () => {
    const horseWithDeco = makeHorse({ tack: { decorations: ['parade-blanket'] } });
    const horseNoDeco = makeHorse({ tack: {} });

    const show = makeShow({ showType: 'ridden' });
    const withDeco = simulateCompetition([horseWithDeco], show)[0].score;
    const noDeco = simulateCompetition([horseNoDeco], show)[0].score;

    // Scores should be identical (decorations irrelevant for ridden)
    expect(withDeco).toBe(noDeco);
  });

  it('parade show ranks horses correctly by decoration score', () => {
    const highDeco = makeHorse({
      name: 'HighDeco',
      tack: { decorations: ['parade-blanket', 'braided-mane-wrap'] }, // 5+4=9 → +90
    });
    const noDeco = makeHorse({ name: 'NoDeco', tack: {} });

    const show = makeShow({ showType: 'parade' });
    const results = simulateCompetition([noDeco, highDeco], show);

    expect(results[0].name).toBe('HighDeco');
    expect(results[1].name).toBe('NoDeco');
  });

  it('parade show: missing showType defaults to ridden (decorations ignored)', () => {
    const horseWithDeco = makeHorse({ tack: { decorations: ['parade-blanket'] } });
    const horseNoDeco = makeHorse({ tack: {} });

    // Show with no showType field — should default to 'ridden'
    const show = { discipline: 'Racing' };
    const withDeco = simulateCompetition([horseWithDeco], show)[0].score;
    const noDeco = simulateCompetition([horseNoDeco], show)[0].score;

    expect(withDeco).toBe(noDeco);
  });
});
