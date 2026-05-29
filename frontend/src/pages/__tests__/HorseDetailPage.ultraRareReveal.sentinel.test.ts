/**
 * Equoria-p30y1 — sentinel for the ultra-rare trait reveal logic.
 *
 * Adversarial audit 2026-05-28 finding #32 identified three defects in
 * HorseDetailPage's reveal effect:
 *   1. Dep array was `[ultraRareData]` — fired on every reference change,
 *      including refetch / window-focus refetch.
 *   2. "Seen" was marked on dismiss, not on display — navigating away
 *      mid-reveal made the modal re-pop on return.
 *   3. Reveal was setState-from-useEffect rather than a derived value.
 *
 * This sentinel is a SOURCE SCAN, not a render-time integration test:
 * the HorseDetailPage test harness mocks 9+ network endpoints, mounts
 * the React Query provider, and would be brittle for a logic-shape
 * assertion. Source-scan sentinels are the canonical pattern in this
 * repo (see sl48cJsonbGuardSentinel, advancedLineageAnalysisService
 * jsonbGuard sentinel, etc.) for asserting an antipattern stays absent.
 *
 * The scan asserts the THREE properties the fix mandates AND fires on a
 * planted regression, so a regex typo cannot make it vacuously green.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PAGE_PATH = resolve(__dirname, '..', 'HorseDetailPage.tsx');

function readSource(): string {
  return readFileSync(PAGE_PATH, 'utf8');
}

describe('Equoria-p30y1 — HorseDetailPage ultra-rare reveal sentinel', () => {
  it('does NOT mark seen inside dismissUltraRareReveal (must mark on display, AC #2)', () => {
    const source = readSource();
    const m = source.match(
      /const\s+dismissUltraRareReveal\s*=\s*useCallback\s*\(\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\n\s*\},\s*\[/
    );
    expect(m, 'dismissUltraRareReveal useCallback must exist').not.toBeNull();
    const body = m![1];
    expect(body).not.toMatch(/markEventSeen\s*\(/);
  });

  it('uses useMemo for the reveal (derived state, not setState-from-effect, AC #3)', () => {
    const source = readSource();
    expect(source).toMatch(/const\s+ultraRareReveal\s*=\s*useMemo\s*\(/);
  });

  it('does NOT use `[ultraRareData]` as the dep array for the reveal logic (AC #1)', () => {
    const source = readSource();
    const blocks = source.matchAll(
      /use(?:Memo|Effect|Callback)\s*\(\s*[^,]*?\bultraRareData\b[\s\S]*?\}\s*,\s*\[([^\]]*)\]/g
    );
    for (const m of blocks) {
      const depArrayContents = m[1].trim();
      expect(depArrayContents).not.toBe('ultraRareData');
    }
  });

  it('marks seen inside a display-side effect (AC #2 — mark on display, not dismiss)', () => {
    const source = readSource();
    expect(source).toMatch(/useEffect\s*\([\s\S]*?markEventSeen\s*\([\s\S]*?\.id\s*\)/);
  });

  it('SENTINEL-POSITIVE: scan correctly flags a planted dismiss-side markEventSeen', () => {
    const planted = `
      const dismissUltraRareReveal = useCallback(() => {
        if (ultraRareReveal) {
          markEventSeen(localStorage, ultraRareReveal.id);
        }
        setUltraRareReveal(null);
      }, [ultraRareReveal]);
    `;
    const m = planted.match(
      /const\s+dismissUltraRareReveal\s*=\s*useCallback\s*\(\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\n\s*\},\s*\[/
    );
    expect(m).not.toBeNull();
    expect(m![1]).toMatch(/markEventSeen\s*\(/);
  });

  it('SENTINEL-POSITIVE: scan correctly flags the old `[ultraRareData]` dep array', () => {
    const planted = `
      useEffect(() => {
        const events = ultraRareData?.recentEvents;
        if (!events) return;
        setUltraRareReveal({ id: events[0].id, traitName: events[0].traitName });
      }, [ultraRareData]);
    `;
    const blocks = [
      ...planted.matchAll(
        /use(?:Memo|Effect|Callback)\s*\(\s*[^,]*?\bultraRareData\b[\s\S]*?\}\s*,\s*\[([^\]]*)\]/g
      ),
    ];
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks[0][1].trim()).toBe('ultraRareData');
  });
});
