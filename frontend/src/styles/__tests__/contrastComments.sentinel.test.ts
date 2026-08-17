/**
 * Contrast-comment drift sentinel (Equoria-ygx4c, split from Equoria-kcau0).
 *
 * Every inline contrast comment in tokens.css ("N.NN:1 on --<ground>") is
 * recomputed from the ACTUAL token hex values with a WCAG relative-luminance
 * implementation, and the test fails on any mismatch > 0.005 — so a future
 * token value change (like the Equoria-205em re-points) cannot silently
 * strand the comments again. The kcau0 incident: every ratio in the file was
 * understated by 1.3–1.5× for months, and DESIGN.md rules were derived from
 * the wrong figures (the retracted 4.2:1 gold-text ban).
 *
 * The WCAG implementation is itself validated against the published
 * reference pairs before it is trusted to judge the file:
 *   #000 on #fff = 21.00     #767676 on #fff = 4.54
 *   #949494 on #fff = 3.03   #fff on #00f    = 8.59
 *
 * Sentinel-positive (OPTIMAL_FIX §2): a synthetic stylesheet with a planted
 * WRONG ratio is proven to FIRE, and a planted CORRECT ratio is proven to
 * pass — the validator detects drift, not merely the absence of it.
 *
 * Exemption (kcau0 decision): translucent/rgba tokens intentionally carry no
 * ratio comments — alpha compositing makes a single contrast figure
 * meaningless. If a ratio comment ever appears on a non-opaque token, this
 * test fails it as unvalidatable rather than skipping it.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const TOKENS_PATH = join(__dirname, '../tokens.css');
const tokensCss = readFileSync(TOKENS_PATH, 'utf8');

// ── WCAG 2.x contrast implementation ─────────────────────────────────────────

/** Parse #rgb / #rrggbb into [r, g, b] (0–255). Returns null for non-hex. */
function parseHex(value: string): [number, number, number] | null {
  const m = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** WCAG relative luminance of an sRGB color. */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c8: number): number => {
    const c = c8 / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two hex colors (order-independent). */
function contrastRatio(hexA: string, hexB: string): number {
  const a = parseHex(hexA);
  const b = parseHex(hexB);
  if (!a || !b) throw new Error(`contrastRatio: non-hex input (${hexA}, ${hexB})`);
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// ── tokens.css parsing ───────────────────────────────────────────────────────

interface RatioComment {
  token: string;
  value: string; // raw declared value (may be a hex, var(), rgba(), …)
  stated: number; // the N.NN figure from the comment
  ground: string; // the --token named after "on"
  line: number;
}

/** All simple `--name: value;` declarations (single-line), for resolution. */
function parseDeclarations(css: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of css.matchAll(/(?<![-\w])(--[\w-]+)\s*:\s*([^;{}]+);/g)) {
    map.set(m[1], m[2].split('/*')[0].trim());
  }
  return map;
}

/** Resolve a token to a concrete value, following var() chains (cycle-safe). */
function resolveToken(name: string, decls: Map<string, string>, depth = 0): string | null {
  if (depth > 10) return null;
  const value = decls.get(name);
  if (value === undefined) return null;
  const varRef = value.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  if (varRef) return resolveToken(varRef[1], decls, depth + 1);
  return value;
}

/**
 * Extract every inline ratio comment: a declaration line whose trailing
 * comment contains "N.NN:1 on --ground".
 */
function parseRatioComments(css: string): RatioComment[] {
  const out: RatioComment[] = [];
  css.split('\n').forEach((line, i) => {
    const decl = line.match(/(--[\w-]+)\s*:\s*([^;]+);\s*\/\*(.*)$/);
    if (!decl) return;
    const ratio = decl[3].match(/(\d+(?:\.\d+)?):1 on (--[\w-]+)/);
    if (!ratio) return;
    out.push({
      token: decl[1],
      value: decl[2].trim(),
      stated: Number.parseFloat(ratio[1]),
      ground: ratio[2],
      line: i + 1,
    });
  });
  return out;
}

/**
 * Validate a stylesheet's ratio comments. Returns a list of human-readable
 * failures (empty = all comments agree with the recomputed truth).
 * Tolerance 0.005: a correctly-rounded 2-decimal figure always passes.
 */
function validateRatioComments(css: string): { failures: string[]; checked: number } {
  const decls = parseDeclarations(css);
  const comments = parseRatioComments(css);
  const failures: string[] = [];
  for (const c of comments) {
    const fg = parseHex(c.value) ? c.value.trim() : null;
    if (!fg) {
      failures.push(
        `${c.token} (line ${c.line}): ratio comment on non-opaque-hex value "${c.value}" — ` +
          'translucent tokens carry no ratios (kcau0); move or delete the comment'
      );
      continue;
    }
    const groundValue = resolveToken(c.ground, decls);
    const bg = groundValue && parseHex(groundValue) ? groundValue : null;
    if (!bg) {
      failures.push(
        `${c.token} (line ${c.line}): ground ${c.ground} does not resolve to an opaque hex ` +
          `(got "${groundValue}")`
      );
      continue;
    }
    const computed = contrastRatio(fg, bg);
    if (Math.abs(computed - c.stated) > 0.005) {
      failures.push(
        `${c.token} (line ${c.line}): comment says ${c.stated.toFixed(2)}:1 on ${c.ground}, ` +
          `recomputed ${computed.toFixed(2)}:1 (${fg} on ${bg}) — the comment has drifted ` +
          'from the token value (Equoria-kcau0 class); update the figure'
      );
    }
  }
  return { failures, checked: comments.length };
}

// ── (a) The WCAG implementation is trusted only after passing the references ─

describe('WCAG contrast implementation — published reference pairs', () => {
  it.each([
    ['#000000', '#ffffff', 21.0],
    ['#767676', '#ffffff', 4.54],
    ['#949494', '#ffffff', 3.03],
    ['#ffffff', '#0000ff', 8.59],
  ])('%s on %s = %d:1', (fg, bg, expected) => {
    expect(Math.abs(contrastRatio(fg, bg) - expected)).toBeLessThanOrEqual(0.005);
  });
});

// ── (b) tokens.css — every inline ratio comment agrees with the recomputation ─

describe('tokens.css inline contrast comments (Equoria-ygx4c)', () => {
  const { failures, checked } = validateRatioComments(tokensCss);

  it('parses the ratio comments (anti-vacuous guard: the file has at least 8)', () => {
    // 8 as of 2026-08-17: --gold-primary/light/dim/bright, --text-primary/
    // secondary/muted/gold. If this drops below 8 the PARSER has rotted (or
    // comments were deleted) — either way a human must look.
    expect(checked).toBeGreaterThanOrEqual(8);
  });

  it('every stated ratio matches the value recomputed from the actual hexes (±0.005)', () => {
    expect(failures).toEqual([]);
  });
});

// ── (c) Sentinel-positive: the validator FIRES on planted drift ──────────────

describe('sentinel-positive: planted drift is detected (OPTIMAL_FIX §2)', () => {
  const ground = ':root {\n  --bg-night-sky: #0a1628;\n';

  it('FIRES on a planted WRONG ratio', () => {
    // #c8a84e on #0a1628 is ~7.91:1 — the planted comment lies (4.20:1, the
    // exact retracted kcau0 figure DESIGN.md says never to cite).
    const planted = `${ground}  --gold-primary: #c8a84e; /* 4.20:1 on --bg-night-sky */\n}\n`;
    const { failures, checked } = validateRatioComments(planted);
    expect(checked).toBe(1);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('--gold-primary');
    expect(failures[0]).toContain('drifted');
  });

  it('FIRES on a ratio comment attached to a translucent (rgba) token', () => {
    const planted = `${ground}  --glass-border: rgba(148, 163, 184, 0.2); /* 1.30:1 on --bg-night-sky */\n}\n`;
    const { failures } = validateRatioComments(planted);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('non-opaque-hex');
  });

  it('FIRES when the named ground does not resolve to an opaque hex', () => {
    const planted = ':root {\n  --gold-primary: #c8a84e; /* 7.91:1 on --nonexistent-ground */\n}\n';
    const { failures } = validateRatioComments(planted);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('--nonexistent-ground');
  });

  it('NEGATIVE CONTROL: a planted CORRECT ratio passes, including via a var() ground chain', () => {
    const planted =
      ':root {\n' +
      '  --bg-night-sky: #0a1628;\n' +
      '  --bg-page: var(--bg-night-sky);\n' +
      '  --gold-primary: #c8a84e; /* 7.91:1 on --bg-page — via alias chain */\n' +
      '}\n';
    const { failures, checked } = validateRatioComments(planted);
    expect(checked).toBe(1);
    expect(failures).toEqual([]);
  });
});
