/**
 * Sentinel: no hardcoded breed-count copy in Horse Trader surfaces (Equoria-5c5j)
 *
 * AC: No hardcoded "320 breeds" (or any other hardcoded breed-count number) may
 * remain in MarketplaceHubPage.tsx or HorseTraderPage.tsx. The breed count
 * must come from the live useBreeds() query so it stays in sync with the DB.
 *
 * This is a sentinel-positive test (OPTIMAL_FIX_DISCIPLINE §2). It will fail if
 * a future regression re-introduces a hardcoded count string of the form
 * `(\d+\s+breeds)` into either page source.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const PAGES_DIR = path.resolve(__dirname, '..');

const HARDCODED_COUNT_RE = /\b\d{2,4}\s+breeds\b/i;

describe('Horse Trader copy — no hardcoded breed count (Equoria-5c5j)', () => {
  it.each([['MarketplaceHubPage.tsx'], ['HorseTraderPage.tsx']])(
    '%s does not contain a hardcoded "<number> breeds" string',
    (filename) => {
      const filePath = path.join(PAGES_DIR, filename);
      const source = fs.readFileSync(filePath, 'utf8');
      const match = source.match(HARDCODED_COUNT_RE);
      expect(
        match,
        `Found hardcoded breed-count in ${filename}: "${match?.[0]}". ` +
          `Use breeds.length from useBreeds() instead — see Equoria-5c5j.`
      ).toBeNull();
    }
  );
});
