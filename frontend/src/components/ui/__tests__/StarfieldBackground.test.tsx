/**
 * StarfieldBackground Component Tests (Equoria-9x4w, Spec 11.3.1)
 *
 * The global atmospheric layer. Pure CSS, zero JS animation. Must:
 *   - render an aria-hidden, non-interactive root layer
 *   - support sparse + dense density variants
 *   - sit behind all content at a negative z-index
 *   - render no <canvas> (CSS-only requirement)
 *   - be a no-op for keyboard (no focusable descendants)
 *
 * Reduced-motion behaviour is enforced by a media query in index.css
 * (`@media (prefers-reduced-motion: reduce)`) — asserted via a source check
 * since jsdom does not evaluate the twinkle keyframes.
 */

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import StarfieldBackground from '../StarfieldBackground';

const indexCssPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../index.css'
);

describe('StarfieldBackground', () => {
  it('renders a decorative, aria-hidden root layer', () => {
    const { container } = render(<StarfieldBackground />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toBeTruthy();
    expect(root.getAttribute('aria-hidden')).toBe('true');
  });

  it('contains no <canvas> (CSS-only requirement)', () => {
    const { container } = render(<StarfieldBackground />);
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('has no focusable / interactive descendants', () => {
    const { container } = render(<StarfieldBackground />);
    expect(
      container.querySelectorAll('a, button, input, select, textarea, [tabindex]')
    ).toHaveLength(0);
  });

  it('renders the dense variant by default', () => {
    const { container } = render(<StarfieldBackground />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('data-density')).toBe('dense');
  });

  it('supports the sparse density variant', () => {
    const { container } = render(<StarfieldBackground density="sparse" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('data-density')).toBe('sparse');
  });

  it('sits behind content via the starfield z token', () => {
    const { container } = render(<StarfieldBackground />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/starfield-bg/);
  });

  it('disables the twinkle animation under prefers-reduced-motion (index.css)', () => {
    const css = readFileSync(indexCssPath, 'utf8');
    // The reduced-motion block must neutralise the star twinkle animation.
    const reducedMotionBlocks = css.match(
      /@media \(prefers-reduced-motion: reduce\)[^@]*\{[\s\S]*?\}\s*\}/g
    );
    expect(reducedMotionBlocks).toBeTruthy();
    const joined = (reducedMotionBlocks ?? []).join('\n');
    expect(joined).toMatch(/starfield/i);
    expect(joined).toMatch(/animation:\s*none/i);
  });
});
