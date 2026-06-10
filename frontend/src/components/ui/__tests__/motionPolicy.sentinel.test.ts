/**
 * Motion policy sentinel (Equoria-o5hub.9, docs/design-system/MOTION.md)
 *
 * Source-level checks that the global reduced-motion policy block in
 * index.css exists and covers the decorative/celebration animations it
 * claims to cover. Follows the StarfieldBackground.test.tsx pattern:
 * jsdom cannot evaluate media queries, so the contract is asserted
 * against the stylesheet source.
 *
 * Sentinel-positive: each assertion fails if the policy block (or a
 * class within it) is removed — not merely when nothing is wrong.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const css = readFileSync(join(__dirname, '../../../index.css'), 'utf8');

/** Extract all prefers-reduced-motion blocks (brace-balanced). */
function reducedMotionBlocks(source: string): string[] {
  const blocks: string[] = [];
  const re = /@media \(prefers-reduced-motion: reduce\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const i = source.indexOf('{', m.index);
    let depth = 0;
    let end = i;
    for (; end < source.length; end++) {
      if (source[end] === '{') depth++;
      if (source[end] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    blocks.push(source.slice(i, end + 1));
  }
  return blocks;
}

const allReduced = reducedMotionBlocks(css).join('\n');

describe('Motion policy — global reduced-motion rules (index.css)', () => {
  it('has at least one prefers-reduced-motion block', () => {
    expect(allReduced.length).toBeGreaterThan(0);
  });

  it.each([
    '.magical-pulse',
    '.sparkle-trail',
    '.shimmer-effect',
    '.scroll-entrance',
    '.animate-fade-in',
  ])('decorative/entrance class %s is de-animated under reduced motion', (cls) => {
    expect(allReduced).toContain(cls);
  });

  it.each(['.animate-pulse', '.animate-bounce', '.animate-ping'])(
    'Tailwind decorative utility %s is de-animated under reduced motion',
    (cls) => {
      expect(allReduced).toContain(cls);
    }
  );

  it('fence-jump celebration bounce is guarded', () => {
    expect(allReduced).toContain("[style*='fence-jump']");
  });

  it('animate-spin (essential loading feedback) is deliberately NOT disabled', () => {
    // Policy: spinners stay (MOTION.md classification table). A naive
    // "disable all animate-*" change would break this contract.
    expect(allReduced).not.toMatch(/\.animate-spin\b/);
  });

  it('focus-visible indicators are forced visible under reduced motion (WCAG 2.4.11)', () => {
    expect(allReduced).toContain(':focus-visible');
  });

  it('interactive lift transform is removed under reduced motion (D-05)', () => {
    expect(allReduced).toMatch(/glass-panel-interactive[\s\S]*?transform: none/);
  });
});

describe('Motion policy — duration tokens zero out (tokens.css)', () => {
  const tokens = readFileSync(join(__dirname, '../../../styles/tokens.css'), 'utf8');
  const reduced = reducedMotionBlocks(tokens).join('\n');

  it.each(['--duration-fast', '--duration-normal', '--duration-slow', '--duration-cinematic'])(
    '%s is zeroed under reduced motion',
    (token) => {
      expect(reduced).toMatch(new RegExp(`${token}: 0ms`));
    }
  );
});
