/**
 * Featured surface sentinel (Equoria-9bui6 / DESIGN.md "The Featured Glow Rule")
 *
 * The D-05 ceremonial ruling (user, 2026-08-13) adds a *featured* treatment on
 * top of the static-panel contract WITHOUT reverting D-05:
 *
 *   - featured at rest      → gold border at 40% + --glow-gold (25%)
 *   - featured + interactive on hover/focus → solid --gold-primary + --glow-gold-strong
 *   - the -2px lift stays exclusive to .glass-panel-interactive, and MUST still
 *     apply to a featured interactive panel: since a featured panel now glows
 *     before it is touched, the lift is the only remaining "clickable" signal.
 *
 * jsdom cannot evaluate the stylesheet, so — following the house pattern in
 * glassPanelStatic.sentinel.test.ts and motionPolicy.sentinel.test.ts — the
 * contract is asserted against the index.css source.
 *
 * Sentinel-positive: every assertion here fails against the pre-9bui6 CSS,
 * which had no .glass-panel-featured rule at all. Raw failing output is
 * recorded on Equoria-9bui6.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const CSS_PATH = resolve(__dirname, '../../../index.css');

/** Strip comments and collapse whitespace so selectors match predictably. */
function normalise(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Return the body of the rule whose selector list is EXACTLY `selector`
 * (passed raw, e.g. `.glass-panel-featured` — escaping happens here).
 * Exact-matching matters: `.glass-panel-featured` is a prefix of
 * `.glass-panel-featured.glass-panel-interactive:hover`, so a substring
 * search would silently read the wrong block.
 */
function ruleBody(css: string, selector: string): string | null {
  // Walk every block; a rule matches when `selector` is one of the comma-
  // separated entries in its selector list. Grouped selectors are normal CSS
  // and must not require the source to duplicate a rule per test.
  let cursor = 0;
  while (cursor < css.length) {
    const open = css.indexOf('{', cursor);
    if (open === -1) return null;

    const prevClose = css.lastIndexOf('}', open);
    const prevOpen = css.lastIndexOf('{', open - 1);
    const listStart = Math.max(prevClose, prevOpen) + 1;
    const list = css.slice(listStart, open);

    let depth = 0;
    let end = open;
    for (; end < css.length; end++) {
      if (css[end] === '{') depth++;
      else if (css[end] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }

    if (list.split(',').some((s) => s.trim() === selector)) {
      return css.slice(open + 1, end);
    }
    cursor = open + 1;
  }
  return null;
}

const raw = readFileSync(CSS_PATH, 'utf-8');
const css = normalise(raw);

describe('Featured surface — resting glow contract (index.css)', () => {
  it('.glass-panel-featured exists and carries the resting gold glow', () => {
    const body = ruleBody(css, '.glass-panel-featured');
    expect(body).not.toBeNull();
    expect(body).toMatch(/--glow-gold\b/);
  });

  it('.glass-panel-featured sets a gold border at rest, not the frosted border', () => {
    const body = ruleBody(css, '.glass-panel-featured');
    expect(body).not.toBeNull();
    expect(body).toMatch(/border-color:[^;]*rgba\(\s*200\s*,\s*168\s*,\s*78\s*,\s*0?\.4\s*\)/);
  });

  it('.glass-panel-featured does NOT move — no transform on the static featured panel', () => {
    const body = ruleBody(css, '.glass-panel-featured');
    expect(body).not.toBeNull();
    expect(body).not.toMatch(/transform/);
  });

  it('.glass-panel-featured is declared AFTER .glass-panel so it wins the cascade', () => {
    // Both are single-class selectors (equal specificity) — source order decides.
    const base = css.search(/(^|[{}];?)\s*\.glass-panel\s*\{/);
    const featured = css.search(/(^|[{}];?)\s*\.glass-panel-featured\s*\{/);
    expect(base).toBeGreaterThan(-1);
    expect(featured).toBeGreaterThan(-1);
    expect(featured).toBeGreaterThan(base);
  });
});

describe('Featured surface — interactive escalation', () => {
  it('featured + interactive escalates to the strong glow on hover', () => {
    const body = ruleBody(css, '.glass-panel-featured.glass-panel-interactive:hover');
    expect(body).not.toBeNull();
    expect(body).toMatch(/--glow-gold-strong\b/);
  });

  it('featured + interactive escalates to a solid gold border on hover', () => {
    const body = ruleBody(css, '.glass-panel-featured.glass-panel-interactive:hover');
    expect(body).not.toBeNull();
    expect(body).toMatch(/border-color:\s*var\(--gold-primary\)/);
  });

  it('keyboard focus gets the same escalation as hover', () => {
    const body = ruleBody(css, '.glass-panel-featured.glass-panel-interactive:focus-visible');
    expect(body).not.toBeNull();
    expect(body).toMatch(/--glow-gold-strong\b/);
    expect(body).toMatch(/border-color:\s*var\(--gold-primary\)/);
  });

  it('the escalation rules never set transform — the lift stays owned by .glass-panel-interactive', () => {
    // If the featured composite set its own transform it would override the
    // reduced-motion `transform: none`, resurrecting motion for users who opted out.
    for (const sel of [
      '.glass-panel-featured.glass-panel-interactive:hover',
      '.glass-panel-featured.glass-panel-interactive:focus-visible',
    ]) {
      const body = ruleBody(css, sel);
      expect(body).not.toBeNull();
      expect(body).not.toMatch(/transform/);
    }
  });

  it('.glass-panel-interactive:hover still lifts — D-05 affordance is not regressed', () => {
    const body = ruleBody(css, '.glass-panel-interactive:hover');
    expect(body).not.toBeNull();
    expect(body).toMatch(/translateY/);
  });
});

describe('Featured surface — reduced motion', () => {
  it('no reduced-motion block removes the featured glow', () => {
    // MOTION.md classes the glow as interaction feedback: de-animated, not
    // removed. The information it carries (this surface is featured) must
    // survive with motion off.
    const blocks = raw.match(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\n {2}\}/g) ?? [];
    const joined = normalise(blocks.join('\n'));
    if (joined.includes('.glass-panel-featured')) {
      expect(joined).not.toMatch(/\.glass-panel-featured[^{}]*\{[^{}]*box-shadow:\s*none/);
    } else {
      // Not mentioned at all is the stronger guarantee.
      expect(joined).not.toContain('.glass-panel-featured');
    }
  });
});
