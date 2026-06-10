/**
 * IconBox — Vitest/RTL tests (Equoria-o5hub.8)
 *
 * Covers:
 *  - all 6 variant token classes (neutral, accent, success, warning, danger, info)
 *  - size set (sm/md/lg)
 *  - decorative by default: aria-hidden="true", no accessible text
 *  - label prop: sr-only text present, aria-hidden removed
 *  - radius from the semantic scale (--radius-md)
 *  - zero raw palette classes in the component source
 */

import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import { Star } from 'lucide-react';
import { IconBox } from '../IconBox';

const VARIANT_CLASSES: Record<string, string[]> = {
  neutral: ['bg-[var(--glass-surface-subtle-bg)]', 'text-[var(--text-secondary)]'],
  accent: ['bg-[var(--btn-gold-bg)]', 'text-[var(--gold-light)]'],
  success: ['bg-[var(--badge-success-bg)]', 'text-[var(--status-success)]'],
  warning: ['bg-[var(--badge-warning-bg)]', 'text-[var(--status-warning)]'],
  danger: ['bg-[var(--badge-danger-bg)]', 'text-[var(--status-danger)]'],
  info: ['bg-[var(--badge-info-bg)]', 'text-[var(--status-info)]'],
};

describe('IconBox — variants', () => {
  for (const [variant, classes] of Object.entries(VARIANT_CLASSES)) {
    it(`${variant} variant applies its token classes`, () => {
      render(
        <IconBox variant={variant as keyof typeof VARIANT_CLASSES}>
          <Star />
        </IconBox>
      );
      const box = screen.getByTestId('icon-box');
      for (const cls of classes) {
        expect(box.className).toContain(cls);
      }
    });
  }

  it('defaults to neutral', () => {
    render(
      <IconBox>
        <Star />
      </IconBox>
    );
    expect(screen.getByTestId('icon-box').className).toContain(
      'bg-[var(--glass-surface-subtle-bg)]'
    );
  });
});

describe('IconBox — sizes', () => {
  it.each([
    ['sm', 'w-8 h-8'],
    ['md', 'w-10 h-10'],
    ['lg', 'w-12 h-12'],
  ] as const)('%s size applies %s', (size, expected) => {
    render(
      <IconBox size={size}>
        <Star />
      </IconBox>
    );
    const box = screen.getByTestId('icon-box');
    for (const cls of expected.split(' ')) {
      expect(box.className).toContain(cls);
    }
  });

  it('defaults to md', () => {
    render(
      <IconBox>
        <Star />
      </IconBox>
    );
    expect(screen.getByTestId('icon-box').className).toContain('w-10');
  });
});

describe('IconBox — accessibility contract', () => {
  it('is decorative by default (aria-hidden="true")', () => {
    render(
      <IconBox>
        <Star />
      </IconBox>
    );
    expect(screen.getByTestId('icon-box')).toHaveAttribute('aria-hidden', 'true');
  });

  it('with label: renders sr-only text and is NOT aria-hidden', () => {
    render(
      <IconBox label="Healthy">
        <Star />
      </IconBox>
    );
    const box = screen.getByTestId('icon-box');
    expect(box).not.toHaveAttribute('aria-hidden');
    expect(screen.getByText('Healthy')).toHaveClass('sr-only');
  });
});

describe('IconBox — shape and source hygiene', () => {
  it('uses the semantic radius token (--radius-md)', () => {
    render(
      <IconBox>
        <Star />
      </IconBox>
    );
    expect(screen.getByTestId('icon-box').className).toContain('rounded-[var(--radius-md)]');
  });

  it('component source contains no raw palette classes or rgba literals', () => {
    const source = readFileSync(join(__dirname, '../IconBox.tsx'), 'utf8');
    expect(source).not.toMatch(/rgba?\(/);
    expect(source).not.toMatch(/\b(?:text|bg)-(?:emerald|red|amber|blue|slate|white)-\d/);
  });
});
