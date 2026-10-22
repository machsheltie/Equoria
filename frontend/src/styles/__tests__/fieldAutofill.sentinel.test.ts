/**
 * Autofilled fields keep the dark glass recipe (Equoria-hc2ok).
 *
 * Chromium paints a light-blue/white background and dark text over any field it
 * autofills (:-webkit-autofill), which overrides the canonical field recipe
 * (fieldStyles.ts: --glass-bg, --text-primary). The login card's email and
 * password boxes therefore turned white as soon as the browser filled them.
 * The standard override is an opaque inset box-shadow in the field colour plus
 * -webkit-text-fill-color; jsdom does not evaluate :autofill, so this pins the
 * stylesheet rule itself — Celestial tokens only, both prefixed and standard
 * pseudo-classes, and the text colour override (without it the dark text the
 * browser forces is unreadable on the dark field).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const css = readFileSync(join(__dirname, '../../index.css'), 'utf8');

function autofillRuleBodies(source: string): string[] {
  const bodies: string[] = [];
  const rule = /([^{}]*:(?:-webkit-)?autofill[^{}]*)\{([^{}]*)\}/g;
  for (let match = rule.exec(source); match; match = rule.exec(source)) {
    bodies.push(match[2]);
  }
  return bodies;
}

describe('autofilled form fields (Equoria-hc2ok)', () => {
  const bodies = autofillRuleBodies(css);
  const joined = bodies.join('\n');

  it('has an autofill rule for the prefixed and the standard pseudo-class', () => {
    expect(css).toMatch(/input:-webkit-autofill/);
    expect(css).toMatch(/input:autofill/);
  });

  it('paints the field colour back with an opaque inset shadow from a Celestial token', () => {
    expect(joined).toMatch(/box-shadow:\s*0 0 0 1000px var\(--bg-midnight\) inset/);
  });

  it('keeps the text and caret in the primary text colour', () => {
    expect(joined).toMatch(/-webkit-text-fill-color:\s*var\(--text-primary\)/);
    expect(joined).toMatch(/caret-color:\s*var\(--text-primary\)/);
  });

  it('uses no raw colour literals in the autofill rules', () => {
    expect(joined).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
});
