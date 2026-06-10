/**
 * (Equoria-o5hub.7): D-05 regression sentinel — glass-panel static / interactive contract
 *
 * Asserts three things about index.css:
 *   (a) There is NO `.glass-panel:hover` rule containing `transform`
 *       (the global lift has been removed — static panels never move).
 *   (b) `.glass-panel-interactive:hover` DOES contain `translateY`
 *       (the affordance moved to the opt-in class, not vanished).
 *   (c) `.glass-panel-subtle` block contains no `backdrop-filter`
 *       (single-blur-layer rule — subtle must never blur).
 *
 * Sentinel-positive proof: assertion (a) was confirmed FAILING against the
 * original CSS (which contained `.glass-panel:hover { transform: translateY(-2px) }`)
 * before the D-05 fix was applied. See issue notes for the raw vitest output.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const CSS_PATH = resolve(__dirname, '../../../index.css');

/** Collapse whitespace, strip comments, return normalised string for pattern matching. */
function normalise(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // strip block comments
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract the body of a rule block matching a given selector substring.
 * Handles a single level of braces only — sufficient for flat @layer blocks.
 */
function extractRuleBody(css: string, selectorFragment: string): string | null {
  // Find the selector in the normalised string
  const idx = css.indexOf(selectorFragment);
  if (idx === -1) return null;

  const openBrace = css.indexOf('{', idx);
  if (openBrace === -1) return null;

  // Walk forward to find the matching closing brace
  let depth = 0;
  let pos = openBrace;
  while (pos < css.length) {
    if (css[pos] === '{') depth++;
    else if (css[pos] === '}') {
      depth--;
      if (depth === 0) return css.slice(openBrace + 1, pos);
    }
    pos++;
  }
  return null;
}

describe('D-05 sentinel — glass-panel static/interactive CSS contract', () => {
  const raw = readFileSync(CSS_PATH, 'utf-8');
  const css = normalise(raw);

  it('(a) .glass-panel:hover must NOT contain transform — global lift removed', () => {
    const body = extractRuleBody(css, '.glass-panel:hover');
    // If the rule no longer exists, body is null — that also satisfies the constraint.
    if (body === null) {
      // Rule was deleted entirely — assertion trivially passes.
      expect(body).toBeNull();
      return;
    }
    // Rule exists but must not contain 'transform'
    expect(body).not.toMatch(/transform/);
  });

  it('(b) .glass-panel-interactive:hover DOES contain translateY — affordance moved, not deleted', () => {
    const body = extractRuleBody(css, '.glass-panel-interactive:hover');
    expect(body).not.toBeNull();
    expect(body).toMatch(/translateY/);
  });

  it('(c) .glass-panel-subtle block must not contain backdrop-filter', () => {
    const body = extractRuleBody(css, '.glass-panel-subtle');
    expect(body).not.toBeNull();
    // The block should not declare backdrop-filter (single-blur-layer rule)
    expect(body).not.toMatch(/backdrop-filter/);
  });
});
