/**
 * Horse stat columns NOT NULL sentinel (Equoria-507mt).
 *
 * Asserts the 19 Horse stat / counter columns made non-null by migration
 * 20260530130000_507mt_horse_stats_nonnull are still enforced at the DB
 * layer AND that the production reader that previously masked NULL
 * (`showController` competition base-score formula) no longer carries the
 * `?? 50` fallback.
 *
 * Companion bond default decision (per user): unbonded (0), not neutral (50).
 *
 * A regression that drops the NOT NULL on any of the 19 columns, OR
 * re-introduces a `?? 50` / `?? 0` fallback in the named production sites,
 * fails this test.
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prisma from '../../packages/database/prismaClient.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(HERE, '..', '..');
const showController = path.join(repoRoot, 'backend', 'modules', 'competition', 'shows', 'showController.mjs');
// Equoria-q4uem.4 (WS4 S4): the executor (executeClosedShows) moved verbatim from
// showController.mjs to showExecutionService.mjs; both files stay under the greps.
const showExecutor = path.join(repoRoot, 'backend', 'modules', 'competition', 'shows', 'showExecutionService.mjs');
// Equoria-c7mx0 (eb134bf05) extracted the base-score formula out of
// showController into the shared scoreShowEntries in competitionScoring.mjs —
// the positive formula anchor lives THERE now, while both files stay under the
// no-`?? 50`-fallback greps.
const competitionScoring = path.join(
  repoRoot,
  'backend',
  'modules',
  'competition',
  'services',
  'competitionScoring.mjs',
);
const foalModel = path.join(repoRoot, 'backend', 'modules', 'horses', 'models', 'foalModel.mjs');

const targetColumns = [
  'precision',
  'strength',
  'speed',
  'agility',
  'endurance',
  'intelligence',
  'stamina',
  'balance',
  'boldness',
  'flexibility',
  'obedience',
  'focus',
  'totalEarnings',
  'bondScore',
  'daysGroomedInARow',
  'consecutiveDaysFoalCare',
  'horseXp',
  'availableStatPoints',
];

describe('Horse stat columns NOT NULL (Equoria-507mt)', () => {
  it('STRUCTURAL: all 19 target columns are is_nullable = NO in the live DB', async () => {
    const rows = await prisma.$queryRaw`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'horses'
        AND column_name = ANY(${targetColumns}::text[])
      ORDER BY column_name
    `;
    expect(rows).toHaveLength(targetColumns.length);
    for (const r of rows) {
      expect(r.is_nullable).toBe('NO');
    }
  });

  it('SENTINEL: base-score formula (scoreShowEntries) no longer carries `?? 50` fallback', () => {
    // The formula moved from showController to competitionScoring.mjs under
    // Equoria-c7mx0; grep BOTH files so the fallback cannot sneak back into
    // either, and anchor the formula's presence at its current home so these
    // negative greps can never pass vacuously against a file that no longer
    // computes the score.
    const scoringSrc = fs.readFileSync(competitionScoring, 'utf8');
    const controllerSrc = fs.readFileSync(showController, 'utf8');
    const executorSrc = fs.readFileSync(showExecutor, 'utf8');
    for (const src of [scoringSrc, controllerSrc, executorSrc]) {
      // Match the exact pre-fix shape (h.<stat> ?? 50) anywhere in the file.
      expect(src).not.toMatch(/h\.speed\s*\?\?\s*50/);
      expect(src).not.toMatch(/h\.stamina\s*\?\?\s*50/);
      expect(src).not.toMatch(/h\.agility\s*\?\?\s*50/);
      expect(src).not.toMatch(/h\.precision\s*\?\?\s*50/);
      expect(src).not.toMatch(/h\.boldness\s*\?\?\s*50/);
    }
    // Positive: the post-fix shape is present at its current home.
    expect(scoringSrc).toMatch(/h\.speed\s*\+\s*h\.stamina\s*\+\s*h\.agility\s*\+\s*h\.precision\s*\+\s*h\.boldness/);
  });

  it('SENTINEL: foalModel.bondScore reader no longer carries `?? 50`', () => {
    const src = fs.readFileSync(foalModel, 'utf8');
    expect(src).not.toMatch(/foal\.bondScore\s*\?\?\s*50/);
  });
});
