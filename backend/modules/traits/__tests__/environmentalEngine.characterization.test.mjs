/**
 * Environmental engine characterization (Equoria-q4uem.7 S3).
 *
 * helpers/environmentalEngine.golden.json holds sha256 digests of every
 * engine output over the fixed grid in helpers/environmentalEngineGrid.mjs,
 * recorded from the pre-S3 engine (the per-function API at 439e793d6). This
 * test drives the same grid through the snapshot API and requires every group
 * digest to match, so any change to a number, its rounding, the order of a
 * floating-point product, a recommendation text or a key fails here.
 * A deliberate mechanics change (owner ruling) re-records the golden file and
 * says so in its commit.
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
  generateWeatherForecast,
  getEnvironmentalHistory,
  getSeasonalFactors,
} from '../services/environmentalFactorEngineService.mjs';
import { canonicalJson, groupDigests, groupOf, runGrid } from './helpers/environmentalEngineGrid.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN = JSON.parse(readFileSync(resolve(HERE, 'helpers/environmentalEngine.golden.json'), 'utf8'));

const assess = (d, l, h, w) => assessHorseEnvironment(buildEnvironmentalSnapshot(d, l, { weather: w }), h);

const API = {
  weather: (d, l) => calculateCurrentWeather(d, l),
  seasonal: d => getSeasonalFactors(d),
  comfort: h => calculateComfortZone(h),
  triggers: (d, l, h, w) => assess(d, l, h, w).triggers,
  impact: (d, l, h, w) => assess(d, l, h, w).impact,
  stress: (d, l, h, w) => assess(d, l, h, w).stress,
  forecast: (d, l, n) => generateWeatherForecast(d, l, n),
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
    const { triggers, impact, stress } = assessHorseEnvironment(snapshot, horse);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(triggers.weather).toBe(snapshot.weather);
    expect(impact.weather).toBe(snapshot.weather);
    expect(stress.weather).toBe(snapshot.weather);
    expect(triggers.seasonalFactors).toBe(snapshot.seasonal);
    expect(impact.seasonalFactors).toBe(snapshot.seasonal);
  });
});
