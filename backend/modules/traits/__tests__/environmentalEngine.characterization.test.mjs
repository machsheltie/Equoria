/**
 * Environmental engine characterization (Equoria-q4uem.7 S3).
 *
 * Both golden files were recorded from the pre-S3 engine (439e793d6) and this
 * test requires the current engine to reproduce them:
 *
 * 1. helpers/environmentalEngine.golden.json: sha256 digests, in 100 groups, of
 *    every engine OUTPUT over the grid in helpers/environmentalEngineGrid.mjs
 *    (16,472 cases, including trait sets that put 3, 4 and 5 factors into one
 *    product). It proves the outputs are unchanged on that grid: any change to
 *    a returned number, text or key there fails.
 * 2. helpers/environmentalTraitProducts.golden.json: the UNROUNDED trait-factor
 *    products (trigger and impact tables) for every trait subset and
 *    condition context, compared with Object.is. Outputs are rounded before they
 *    leave the engine, so (1) cannot see the order a product is multiplied in;
 *    (2) can: reordering a table or its loop changes the last bit of some product.
 *
 * A deliberate mechanics change
 * (owner ruling) re-records the golden files and says so in its commit.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  assessHorseEnvironment,
  buildEnvironmentalSnapshot,
  calculateComfortZone,
  calculateCurrentWeather,
  getEnvironmentalHistory,
  getSeasonalFactors,
} from '../services/environmentalFactorEngineService.mjs';
import {
  canonicalJson,
  groupDigests,
  groupOf,
  runGrid,
  TRAIT_PRODUCT_CASES,
} from './helpers/environmentalEngineGrid.mjs';
import { IMPACT_TRAIT_FACTORS, TRIGGER_TRAIT_FACTORS, traitFactorProduct } from '../services/environmentalPolicy.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PRODUCTS = JSON.parse(readFileSync(resolve(HERE, 'helpers/environmentalTraitProducts.golden.json'), 'utf8'));
const TABLES = {
  trigger: TRIGGER_TRAIT_FACTORS,
  impact: IMPACT_TRAIT_FACTORS,
};
const GOLDEN = JSON.parse(readFileSync(resolve(HERE, 'helpers/environmentalEngine.golden.json'), 'utf8'));

const assess = (d, l, h, w) => assessHorseEnvironment(buildEnvironmentalSnapshot(d, l, { weather: w }), h);

const API = {
  weather: (d, l) => calculateCurrentWeather(d, l),
  seasonal: d => getSeasonalFactors(d),
  comfort: h => calculateComfortZone(h),
  triggers: (d, l, h, w) => assess(d, l, h, w).triggers,
  impact: (d, l, h, w) => assess(d, l, h, w).impact,
  history: (s, e, l) => getEnvironmentalHistory(s, e, l),
};

describe('environmental engine characterization (golden digests from the pre-S3 engine)', () => {
  const outputs = runGrid(API);
  const digests = groupDigests(outputs);

  it('covers the same cases and groups as the recording', () => {
    expect(Object.keys(outputs)).toHaveLength(GOLDEN.cases);
    expect(Object.keys(digests).sort()).toEqual(Object.keys(GOLDEN.groups).sort());
  });

  it('reproduces every group digest', () => {
    const mismatched = Object.keys(GOLDEN.groups).filter(g => digests[g] !== GOLDEN.groups[g]);
    if (mismatched.length > 0) {
      const firstKey = Object.keys(outputs).find(k => groupOf(k) === mismatched[0]);
      // Diagnosis aid: the first case of the first mismatched group, as now computed.
      process.stderr.write(
        `first mismatched group ${mismatched[0]}; first case ${firstKey}:\n${canonicalJson(outputs[firstKey]).slice(0, 2000)}\n`,
      );
    }
    expect(mismatched).toEqual([]);
  });

  it('assesses every horse against the one snapshot it is given', () => {
    const snapshot = buildEnvironmentalSnapshot(new Date('2025-07-15T12:00:00.000Z'), {
      latitude: 40,
      longitude: -74,
      region: 'temperate',
      elevation: 0,
    });
    const horse = { traits: ['nervous'], age: 8, health: 75 };
    const { triggers, impact } = assessHorseEnvironment(snapshot, horse);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(triggers.weather).toBe(snapshot.weather);
    expect(impact.weather).toBe(snapshot.weather);
    expect(triggers.seasonalFactors).toBe(snapshot.seasonal);
    expect(impact.seasonalFactors).toBe(snapshot.seasonal);
  });
});

describe('trait-factor products at full precision (pre-S3 if-chain order)', () => {
  it('covers the recorded cases', () => {
    expect(TRAIT_PRODUCT_CASES).toHaveLength(PRODUCTS.cases);
  });

  it('reproduces every unrounded product bit for bit', () => {
    const differing = TRAIT_PRODUCT_CASES.filter(
      c => !Object.is(traitFactorProduct(TABLES[c.table], c.traits, c), PRODUCTS.products[c.key]),
    ).map(c => c.key);
    expect(differing).toEqual([]);
  });
});
