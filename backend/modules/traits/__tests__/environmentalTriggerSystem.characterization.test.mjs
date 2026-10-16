/**
 * Environmental trigger analysis characterization (Equoria-q4uem.7 S4, real DB).
 *
 * helpers/environmentalTriggerSystem.golden.json holds a sha256 per case of
 * every analysis output over the fixtures and calls in
 * helpers/environmentalTriggerGrid.mjs (12 foals of chosen age, stress, bond and
 * interaction history, plus a horse that does not exist; detection, thresholds,
 * 10 trait probabilities, exposure, critical periods and the full report),
 * recorded from the pre-S4 per-function API with Math.random pinned at 0.5 and
 * then 0.9 (the analysis draws unruled trigger factors at random; owner
 * question WS7-Q2). This test drives the same grid through the snapshot API and
 * requires every case digest to match. The outputs are mostly unrounded, so a
 * changed number, sum order or product order fails here, as does a changed
 * text, key or error.
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import {
  criticalPeriodSensitivity,
  cumulativeExposure,
  detectTriggers,
  environmentalReport,
  loadEnvironmentalTriggerSnapshot,
  traitExpressionProbability,
  triggerThresholds,
} from '../services/environmentalTriggerSystem.mjs';
import {
  buildTriggerFixtures,
  caseDigests,
  cleanupTriggerFixtures,
  runTriggerGrid,
} from './helpers/environmentalTriggerGrid.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN = JSON.parse(readFileSync(resolve(HERE, 'helpers/environmentalTriggerSystem.golden.json'), 'utf8'));

const load = id => loadEnvironmentalTriggerSnapshot(id);
const API = {
  detect: async id => detectTriggers(await load(id)),
  thresholds: async id => triggerThresholds(await load(id)),
  probability: async (id, trait) => traitExpressionProbability(await load(id), trait),
  exposure: async id => cumulativeExposure(await load(id)),
  critical: async id => criticalPeriodSensitivity(await load(id)),
  report: async id => environmentalReport(await load(id)),
};

let fx;

beforeAll(async () => {
  fx = await buildTriggerFixtures(prisma, randomBytes(6).toString('hex'), fixtureColor);
}, 60000);

afterAll(() => cleanupTriggerFixtures(prisma, fx), 60000);

describe('environmental trigger analysis characterization (golden digests from the pre-S4 API)', () => {
  it('reproduces every case digest with the random draw pinned at 0.5 and at 0.9', async () => {
    const digests = {};
    for (const draw of [0.5, 0.9]) {
      jest.spyOn(Math, 'random').mockReturnValue(draw);
      const outputs = await runTriggerGrid(API, fx);
      for (const [key, digest] of Object.entries(caseDigests(outputs))) {
        digests[`random=${draw}|${key}`] = digest;
      }
      jest.restoreAllMocks();
    }
    expect(Object.keys(digests).sort()).toEqual(Object.keys(GOLDEN.cases).sort());
    const mismatched = Object.keys(GOLDEN.cases).filter(k => digests[k] !== GOLDEN.cases[k]);
    expect(mismatched).toEqual([]);
  }, 120000);
});
