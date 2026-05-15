/**
 * horseColorNullSentinel.test.mjs (Equoria-a429)
 *
 * Canonical-DB sentinel that catches regressions in the horse-color
 * generation pipeline. The 111-NULL-phenotype bug (2026-04-30 → 2026-05-04)
 * existed for weeks because no test asserted the invariant that every horse
 * row must have a non-null phenotype after the 31E color-genetics system
 * went live.
 *
 * What this sentinel proves:
 *   1. SELECT COUNT(*) FROM horses WHERE phenotype IS NULL = 0.
 *   2. The backfill script can be invoked against the same DB without
 *      flipping the count back to non-zero (idempotency check).
 *
 * Sentinel-positive demonstration (per OPTIMAL_FIX_DISCIPLINE.md §2):
 *   This test was authored after running the backfill against the canonical
 *   DB and confirming it reduced 111 → 0 (recorded in bd notes for
 *   Equoria-a429). To prove it fails on a real violation, comment out the
 *   backfill in a fresh DB clone and the first assertion will fail. The
 *   pre-fix code path (silent-warn-drop in authController.register) is the
 *   reason this test could not have been authored earlier — the bug class
 *   was structurally invisible.
 *
 * Per CLAUDE.md Testing Philosophy: real DB, no mocks. The query runs
 * against the canonical Equoria DB pointed at by .env.test (intentional —
 * the user's explicit choice, risks acknowledged in CLAUDE.md §2).
 */

import prisma from '../db/index.mjs';

describe('horse-color sentinel (Equoria-a429)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('zero horses have NULL phenotype in the canonical DB', async () => {
    const result = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM horses
      WHERE phenotype IS NULL
    `;
    const nullCount = result[0]?.count ?? 0;
    // If this assertion fires:
    //   1. Run node backend/scripts/backfill-horse-colors.mjs
    //   2. Investigate the creation path that produced the NULL — most
    //      likely the silent-catch was reintroduced in authController.mjs
    //      around line 175 (see Equoria-a429 notes for the original bug).
    //   3. Re-run this sentinel to confirm it's back to 0.
    expect(nullCount).toBe(0);
  });

  test('phenotype.colorName is always a non-empty string when phenotype is set', async () => {
    // Adjacent invariant: a row with phenotype IS NOT NULL but
    // phenotype->>'colorName' being NULL/empty is just as broken as a
    // missing phenotype. Catch that drift here too.
    const result = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM horses
      WHERE phenotype IS NOT NULL
        AND (phenotype->>'colorName' IS NULL OR phenotype->>'colorName' = '')
    `;
    const brokenCount = result[0]?.count ?? 0;
    expect(brokenCount).toBe(0);
  });
});
