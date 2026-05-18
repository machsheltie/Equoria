/**
 * CelestialTabs migration sentinel (Equoria-1nlw).
 *
 * Equoria-1nlw retires the pre-Celestial component family (the old
 * Button/Form/Modal/Tabs/Accordion adapters that used the legacy prefix)
 * in favor of the Celestial Night game-native equivalents.
 *
 * The tabs adapter was the only one with production callers; it was already
 * a thin wrapper over GoldTabs. It is renamed to CelestialTabs and moved
 * into components/ui/game (the Celestial namespace barrel). The three
 * unused legacy files are deleted outright.
 *
 * Per OPTIMAL_FIX_DISCIPLINE.md §2 — sentinel-positive: this test plants
 * the post-migration contract and fails loudly if a Fantasy* import or
 * source file ever reappears under frontend/src.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CelestialTabs } from '../CelestialTabs';

const SRC = join(process.cwd(), 'src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(tsx?|ts)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('CelestialTabs adapter (Equoria-1nlw)', () => {
  it('renders tabs and switches content on trigger click', async () => {
    const user = userEvent.setup();
    render(
      <CelestialTabs
        tabs={[
          { value: 'a', label: 'Alpha', content: <p>alpha-body</p> },
          { value: 'b', label: 'Beta', content: <p>beta-body</p> },
        ]}
        defaultValue="a"
      />
    );
    expect(screen.getByText('alpha-body')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /beta/i }));
    expect(screen.getByText('beta-body')).toBeInTheDocument();
  });

  it('honors the controlled value/onValueChange API', async () => {
    const user = userEvent.setup();
    const seen: string[] = [];
    render(
      <CelestialTabs
        tabs={[
          { value: 'x', label: 'X', content: <p>x-body</p> },
          { value: 'y', label: 'Y', content: <p>y-body</p> },
        ]}
        value="y"
        onValueChange={(v) => seen.push(v)}
      />
    );
    expect(screen.getByText('y-body')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /^X$/i }));
    expect(seen).toContain('x');
  });

  it('is exported from the Celestial game barrel', async () => {
    const barrel = await import('../index');
    expect(barrel).toHaveProperty('CelestialTabs');
    expect(barrel).toHaveProperty('CelestialAccordion');
  });

  // Legacy prefix assembled at runtime so this sentinel file does not itself
  // contain a literal legacy component token (which would self-trip the
  // negative scan below).
  const LEGACY = ['Fan', 'tasy'].join('');
  const LEGACY_RE = new RegExp(`\\b${LEGACY}(Tabs|Button|Form|Modal|Accordion)\\b`);

  it('no legacy-prefixed source files remain under src/components', () => {
    const dir = join(SRC, 'components');
    for (const base of ['Tabs', 'Button', 'Form', 'Modal']) {
      expect(existsSync(join(dir, `${LEGACY}${base}.tsx`))).toBe(false);
    }
  });

  it('no source file under src references a legacy-prefixed component (negative sentinel)', () => {
    const selfPath = join(SRC, 'components', 'ui', 'game', '__tests__', 'CelestialTabs.test.tsx');
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      if (file === selfPath) continue; // this sentinel builds the pattern dynamically
      const text = readFileSync(file, 'utf8');
      if (LEGACY_RE.test(text)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
