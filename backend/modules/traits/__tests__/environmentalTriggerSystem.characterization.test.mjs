/**
 * Environmental trigger analysis characterization (Equoria-q4uem.7 S4, real DB).
 *
 * helpers/environmentalTriggerSystem.golden.json holds a sha256 per case of
 * every analysis output over the fixtures and calls in
 * helpers/environmentalTriggerGrid.mjs: 13 foals of chosen age, stress, bond
 * and interaction history (one with three interactions sharing a timestamp),
 * plus a horse that does not exist; detection, thresholds, 10 trait
 * probabilities, exposure and the full report. It was
 * recorded from the pre-S4 per-function API (git show b69fd4af4) with
 * Math.random pinned at 0.5 and then 0.9 (the analysis draws unruled trigger
 * factors at random; owner question WS7-Q2).
 *
 * This test drives the same grid through the snapshot API and requires every
 * case digest to match, at the real clock and at three frozen instants where
 * the UTC date and the Eastern game date differ (birth dates are @db.Date,
 * ages are counted on the Eastern calendar). Outputs are mostly unrounded, so
 * a changed number, sum order or product order fails here, as does a changed
 * text, key, error, interaction date or tied-timestamp order.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import {
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
  report: async id => environmentalReport(await load(id)),
};

// Only Date is faked (timers, I/O and Prisma run normally).
const REAL_EXCEPT_DATE = [
  'hrtime',
  'nextTick',
  'performance',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
];

// Build fresh fixtures and run the grid (random draw 0.5, then 0.9) with the
// clock frozen at `instant` (or the real clock when null).
async function digestsAt(instant) {
  if (instant) {
    jest.useFakeTimers({ now: new Date(instant), doNotFake: REAL_EXCEPT_DATE });
  }
  const fx = await buildTriggerFixtures(prisma, randomBytes(6).toString('hex'), fixtureColor);
  try {
    const digests = {};
    for (const draw of [0.5, 0.9]) {
      const spy = jest.spyOn(Math, 'random').mockReturnValue(draw);
      const outputs = await runTriggerGrid(API, fx);
      for (const [key, digest] of Object.entries(caseDigests(outputs))) {
        digests[`random=${draw}|${key}`] = digest;
      }
      spy.mockRestore();
    }
    return digests;
  } finally {
    await cleanupTriggerFixtures(prisma, fx);
    if (instant) {
      jest.useRealTimers();
    }
  }
}

describe('environmental trigger analysis characterization (golden digests from the pre-S4 API)', () => {
  // The real clock, then instants where the UTC date and the Eastern game date
  // differ (00:30 and 01:30 EDT in July, 00:30 EST in December): a horse's
  // @db.Date birth date and its Eastern age must agree at every one.
  for (const instant of [null, '2025-07-15T04:30:00.000Z', '2025-07-15T05:30:00.000Z', '2025-12-15T05:30:00.000Z']) {
    it(`reproduces every case digest (clock: ${instant ?? 'real'})`, async () => {
      const digests = await digestsAt(instant);
      expect(Object.keys(digests).sort()).toEqual(Object.keys(GOLDEN.cases).sort());
      const mismatched = Object.keys(GOLDEN.cases).filter(k => digests[k] !== GOLDEN.cases[k]);
      expect(mismatched).toEqual([]);
    }, 120000);
  }
});
