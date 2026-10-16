/**
 * Dynamic compatibility characterization (Equoria-q4uem.7 S6, real DB).
 *
 * helpers/dynamicCompatibility.golden.json holds a sha256 per case of every
 * compatibility output over the fixtures and calls in
 * helpers/dynamicCompatibilityGrid.mjs: 7 grooms (4 personalities, an expert, a novice,
 * an unknown type) x 7 horses, missing ids included; compatibility under 5
 * contexts (3- to 5-factor environmental products, an unsupported task),
 * predictions, factor breakdowns, trends, and recommendations for every horse.
 * It was recorded from the pre-S6 per-function API (17b969738).
 *
 * This test drives the same grid through the loaded-input API and requires
 * every case digest to match, at the real clock and at three frozen instants
 * where the UTC date and the Eastern game date differ (births are @db.Date).
 * Scores are unrounded, so a changed number, product order, text, key or error
 * fails here.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import {
  analyzeCompatibilityFactors,
  compatibilityTrends,
  loadCompatibilityInputs,
  predictInteraction,
  rankGrooms,
  scoreCompatibility,
} from '../services/dynamicCompatibilityScoring.mjs';
import {
  buildCompatibilityFixtures,
  caseDigests,
  cleanupCompatibilityFixtures,
  runCompatibilityGrid,
} from './helpers/dynamicCompatibilityGrid.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN = JSON.parse(readFileSync(resolve(HERE, 'helpers/dynamicCompatibility.golden.json'), 'utf8'));

const pair = (h, g) => loadCompatibilityInputs(h, { groomIds: [g] });
const API = {
  compatibility: async (g, h, ctx) => scoreCompatibility(await pair(h, g), g, ctx),
  factors: (g, h) => analyzeCompatibilityFactors(g, h),
  prediction: async (g, h, ctx) => predictInteraction(await pair(h, g), g, ctx),
  recommendations: async (h, ctx) => rankGrooms(await loadCompatibilityInputs(h, { ownerGrooms: true }), ctx),
  trends: async (g, h) => compatibilityTrends(await pair(h, g), g),
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

async function digestsAt(instant) {
  if (instant) {
    jest.useFakeTimers({ now: new Date(instant), doNotFake: REAL_EXCEPT_DATE });
  }
  const fx = await buildCompatibilityFixtures(prisma, randomBytes(6).toString('hex'), fixtureColor);
  try {
    return caseDigests(await runCompatibilityGrid(API, fx));
  } finally {
    await cleanupCompatibilityFixtures(prisma, fx);
    if (instant) {
      jest.useRealTimers();
    }
  }
}

describe('dynamic compatibility characterization (golden digests from the pre-S6 API)', () => {
  for (const instant of [null, '2025-07-15T04:30:00.000Z', '2025-07-15T05:30:00.000Z', '2025-12-15T05:30:00.000Z']) {
    it(`reproduces every case digest (clock: ${instant ?? 'real'})`, async () => {
      const digests = await digestsAt(instant);
      expect(Object.keys(digests).sort()).toEqual(Object.keys(GOLDEN.cases).sort());
      const mismatched = Object.keys(GOLDEN.cases).filter(k => digests[k] !== GOLDEN.cases[k]);
      expect(mismatched).toEqual([]);
    }, 300000);
  }
});
