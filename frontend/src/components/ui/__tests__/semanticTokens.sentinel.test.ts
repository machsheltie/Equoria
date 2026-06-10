/**
 * Equoria-o5hub.6 (P2.1) — Semantic tokens sentinel
 *
 * Asserts the presence of:
 *   (a) All --role-{success,warning,danger,info,accent,neutral}-{text,bg,border}
 *       tokens in tokens.css (DECISIONS.md §7 / Task A)
 *   (b) --radius-button resolves to var(--radius-md), not var(--radius-full)
 *       (DECISIONS.md §3 / Task C)
 *   (c) All 7 .text-role-* utility classes in index.css (Task B)
 *
 * Sentinel-positive proof: all three assertions were confirmed FAILING against
 * the original files before Tasks A–C were applied. See issue notes for raw
 * vitest output.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const TOKENS_PATH = resolve(__dirname, '../../../styles/tokens.css');
const INDEX_CSS_PATH = resolve(__dirname, '../../../index.css');

const tokensRaw = readFileSync(TOKENS_PATH, 'utf-8');
const indexRaw = readFileSync(INDEX_CSS_PATH, 'utf-8');

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Strip CSS block comments then collapse whitespace for pattern matching.
 * Keeps newlines so indexOf can still find multi-line rules approximately.
 */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

const tokensStripped = stripComments(tokensRaw);
const indexStripped = stripComments(indexRaw);

/** True if a custom-property declaration `--name: <value>` appears in src. */
function hasToken(src: string, name: string): boolean {
  // CSS custom properties always start with "--" (which is not a word character).
  // We match a declaration by requiring that the token name is preceded by
  // whitespace or the start of a block (not a word boundary, which would
  // not fire before "--").
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // escape regex special chars
  return new RegExp(`(?:^|[\\s{;])${escaped}\\s*:`).test(src);
}

/** True if a CSS class `.class-name` appears in src. */
function hasClass(src: string, className: string): boolean {
  // Escaped selector: `.text-role-primary`
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{`).test(src);
}

// ── (a) Role tokens ───────────────────────────────────────────────────────────

const ROLES = ['success', 'warning', 'danger', 'info', 'accent', 'neutral'] as const;
const SLOTS = ['text', 'bg', 'border'] as const;

describe('(a) --role-* tokens — all 18 tokens defined in tokens.css', () => {
  for (const role of ROLES) {
    for (const slot of SLOTS) {
      const token = `--role-${role}-${slot}`;
      it(`${token} is defined`, () => {
        expect(hasToken(tokensStripped, token)).toBe(true);
      });
    }
  }
});

// ── (b) --radius-button ───────────────────────────────────────────────────────

describe('(b) --radius-button resolves to var(--radius-md) — DECISIONS.md §3', () => {
  it('--radius-button value is var(--radius-md)', () => {
    // Match: --radius-button: var(--radius-md) with optional trailing semicolon/comment
    expect(tokensStripped).toMatch(/--radius-button\s*:\s*var\(--radius-md\)/);
  });

  it('--radius-button does NOT resolve to var(--radius-full)', () => {
    expect(tokensStripped).not.toMatch(/--radius-button\s*:\s*var\(--radius-full\)/);
  });
});

// ── (c) .text-role-* utility classes ─────────────────────────────────────────

const TEXT_ROLE_CLASSES = [
  '.text-role-primary',
  '.text-role-secondary',
  '.text-role-muted',
  '.text-role-disabled',
  '.text-role-inverse',
  '.text-role-link',
  '.text-role-danger',
] as const;

describe('(c) .text-role-* utility classes — all 7 defined in index.css', () => {
  for (const cls of TEXT_ROLE_CLASSES) {
    it(`${cls} is defined`, () => {
      expect(hasClass(indexStripped, cls)).toBe(true);
    });
  }
});
