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
const REPO_ROOT = path.resolve(HERE, '..', '..');
const SHOW_CONTROLLER = path.join(
  REPO_ROOT,
  'backend',
  'modules',
  'competition',
  'shows',
  'showController.mjs',
);
const ENV_ROUTES = path.join(
  REPO_ROOT,
  'backend',
  'modules',
  'labs',
  'routes',
  'environmentalRoutes.mjs',
);
const FOAL_MODEL = path.join(REPO_ROOT, 'backend', 'models', 'foalModel.mjs');

const TARGET_COLUMNS = [
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
  'stressLevel',
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
        AND column_name = ANY(${TARGET_COLUMNS}::text[])
      ORDER BY column_name
    `;
    expect(rows).toHaveLength(TARGET_COLUMNS.length);
    for (const r of rows) {
      expect(r.is_nullable).toBe('NO');
    }
  });

  it('SENTINEL: showController base-score formula no longer carries `?? 50` fallback', () => {
    const src = fs.readFileSync(SHOW_CONTROLLER, 'utf8');
    // Match the exact pre-fix shape (h.<stat> ?? 50) anywhere in the file.
    expect(src).not.toMatch(/h\.speed\s*\?\?\s*50/);
    expect(src).not.toMatch(/h\.stamina\s*\?\?\s*50/);
    expect(src).not.toMatch(/h\.agility\s*\?\?\s*50/);
    expect(src).not.toMatch(/h\.precision\s*\?\?\s*50/);
    expect(src).not.toMatch(/h\.boldness\s*\?\?\s*50/);
    // Positive: the post-fix shape is present.
    expect(src).toMatch(/h\.speed\s*\+\s*h\.stamina\s*\+\s*h\.agility\s*\+\s*h\.precision\s*\+\s*h\.boldness/);
  });

  it('SENTINEL: environmentalRoutes no longer carries `horse.<stat> ?? 50`', () => {
    const src = fs.readFileSync(ENV_ROUTES, 'utf8');
    expect(src).not.toMatch(/horse\.speed\s*\?\?\s*50/);
    expect(src).not.toMatch(/horse\.stamina\s*\?\?\s*50/);
    expect(src).not.toMatch(/horse\.agility\s*\?\?\s*50/);
    expect(src).not.toMatch(/horse\.intelligence\s*\?\?\s*50/);
  });

  it('SENTINEL: foalModel.bondScore reader no longer carries `?? 50`', () => {
    const src = fs.readFileSync(FOAL_MODEL, 'utf8');
    expect(src).not.toMatch(/foal\.bondScore\s*\?\?\s*50/);
  });
});
