/**
 * Equoria-7aeso — sentinel for HorseEquipPage TACK_IMAGES asset rendering
 * (recovers the intent of the deleted Equoria-r3sj vi.mock-based test
 * removed in afd435473 / Equoria-ruycn).
 *
 * The original test was a vi.mock-of-hooks unit test that asserted:
 *   - `all-purpose-saddle` → <img src="/images/tack/allpurposesaddle.png">
 *   - `dressage-saddle`    → <img src="/images/tack/dressage-saddle.png">
 *   - tack NOT in TACK_IMAGES (e.g. `all-purpose-bridle`) → Wrench fallback
 *
 * Per CLAUDE.md §3 ("Why mocks aren't part of Equoria's toolkit"), the
 * vi.mock approach is not the right tool. The render-time integration
 * surface is covered by the MSW-based HorseEquipPage.test.tsx in the
 * same directory. What that suite does NOT cover — and what the deleted
 * test was uniquely guarding — is the bundle-time concern: do the
 * TACK_IMAGES dictionary's `src` paths resolve to real assets on disk,
 * and does the conditional render block actually read TACK_IMAGES?
 *
 * This is a SOURCE-SCAN + ON-DISK sentinel (canonical repo pattern; see
 * HorseDetailPage.ultraRareReveal.sentinel.test.ts and the JSONB-guard
 * sentinels). It asserts:
 *
 *   1. TACK_IMAGES dict exists in HorseEquipPage.tsx and contains entries.
 *   2. Every TACK_IMAGES path resolves to a real file under
 *      frontend/public/images/tack/ — guards against drift where a
 *      contributor renames an asset on disk but forgets the dict (or
 *      vice-versa), which the bundle would silently accept and the
 *      production page would silently 404 on the <img>.
 *   3. The conditional render block reads `TACK_IMAGES[item.itemId]` and
 *      branches to <img src={TACK_IMAGES[item.itemId]} alt={item.name} />
 *      on hit, falling through to a Wrench-icon block on miss. Guards
 *      against a refactor that drops the dict lookup or the alt-text
 *      (a11y regression).
 *
 * Sentinel-positive coverage: each on-disk assertion fires per-key, so a
 * deleted asset OR a typo in the dict produces a precise failing test —
 * never a vacuously-green pass.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PAGE_PATH = resolve(__dirname, '..', 'horses', 'HorseEquipPage.tsx');
// public/ is at frontend/public/ — five levels up from this test file.
const PUBLIC_DIR = resolve(__dirname, '..', '..', '..', 'public');

function readSource(): string {
  return readFileSync(PAGE_PATH, 'utf8');
}

/**
 * Parse the TACK_IMAGES Record literal from the page source.
 *
 * Format guarded:
 *   const TACK_IMAGES: Record<string, string> = {
 *     'dressage-saddle': '/images/tack/dressage-saddle.png',
 *     ...
 *   };
 *
 * Returns a Map of itemId → src path. Throws if the dict is missing or
 * malformed — that itself is a sentinel failure.
 */
function parseTackImages(source: string): Map<string, string> {
  const dictMatch = source.match(
    /const\s+TACK_IMAGES\s*:\s*Record<string,\s*string>\s*=\s*\{([\s\S]*?)\n\}\s*;/
  );
  if (!dictMatch) {
    throw new Error(
      'TACK_IMAGES Record<string, string> literal not found in HorseEquipPage.tsx — refactor or rename has broken this sentinel'
    );
  }
  const body = dictMatch[1];
  const entries = new Map<string, string>();
  const entryRe = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(body)) !== null) {
    entries.set(m[1], m[2]);
  }
  return entries;
}

describe('Equoria-7aeso — HorseEquipPage TACK_IMAGES asset-render sentinel', () => {
  it('TACK_IMAGES dict parses and is non-empty', () => {
    const source = readSource();
    const entries = parseTackImages(source);
    expect(entries.size).toBeGreaterThan(0);
  });

  it('every TACK_IMAGES src path resolves to a real on-disk asset under frontend/public/', () => {
    const source = readSource();
    const entries = parseTackImages(source);

    // Per-key assertions so a single missing asset surfaces its own
    // failure message rather than a generic "0 of N" summary.
    for (const [itemId, srcPath] of entries) {
      // Every dict entry must point at a /images/tack/ public asset.
      // Anything else (e.g. an absolute http URL, a /assets/ bundle path,
      // an unprefixed name) is a refactor smell that should not silently
      // pass through.
      expect(
        srcPath.startsWith('/images/tack/'),
        `TACK_IMAGES['${itemId}'] = '${srcPath}' must live under /images/tack/`
      ).toBe(true);

      // /images/tack/foo.png → frontend/public/images/tack/foo.png
      const onDiskPath = resolve(PUBLIC_DIR, srcPath.replace(/^\//, ''));
      expect(
        existsSync(onDiskPath),
        `TACK_IMAGES['${itemId}'] = '${srcPath}' is not on disk at ${onDiskPath} — the <img> would 404 in production`
      ).toBe(true);
    }
  });

  it('conditional render reads TACK_IMAGES[item.itemId] and falls through to a Wrench fallback (AC #1, #2)', () => {
    const source = readSource();

    // The hit-branch <img> must read the dict by item.itemId AND set alt
    // to item.name (a11y — alt-text is the recovered AC from the deleted
    // suite). Order of attributes is not pinned; we assert presence.
    const imgMatch = source.match(
      /TACK_IMAGES\[\s*item\.itemId\s*\][\s\S]*?<img[\s\S]*?src=\{\s*TACK_IMAGES\[\s*item\.itemId\s*\]\s*\}[\s\S]*?alt=\{\s*item\.name\s*\}/
    );
    expect(
      imgMatch,
      'Conditional render must use TACK_IMAGES[item.itemId] for <img src> AND item.name for <img alt> — a11y regression guard'
    ).not.toBeNull();

    // The miss-branch must render the lucide-react Wrench icon. The
    // import is the only stable cross-version reference (the JSX is
    // tied to whatever wrapper styling lives around it).
    expect(source).toMatch(/import\s*\{[^}]*\bWrench\b[^}]*\}\s*from\s*['"]lucide-react['"]/);
    expect(source).toMatch(/<Wrench\b/);
  });
});
