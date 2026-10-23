/**
 * Typography roles — the code must match DESIGN.md's type roles
 * (Equoria-gr7ph, -ru830, -cunq3, -ely1r).
 *
 * Real components, real token and CSS files, the real DESIGN.md front matter.
 * Class assertions are the right level in jsdom: the role classes resolve to
 * faces through tokens.css / index.css, which the contract tests below read
 * directly.
 */
import React from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FrostedPanel, FrostedPanelHeader, FrostedPanelTitle } from '../FrostedPanel';
import { GameDialog, GameDialogContent, GameDialogTitle } from '../GameDialog';
import CinematicMoment from '@/components/feedback/CinematicMoment';
import TrainingResultModal from '@/components/training/TrainingResultModal';

const FRONTEND = resolve(__dirname, '../../../../..');
const SRC = join(FRONTEND, 'src');
const read = (p: string) => readFileSync(p, 'utf8');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      sourceFiles(full, out);
    } else if (/\.(tsx?|css)$/.test(name) && !/\.(test|stories)\./.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe('DESIGN.md type roles <-> tokens.css', () => {
  const design = read(join(FRONTEND, '..', 'DESIGN.md'));
  const tokens = read(join(SRC, 'styles', 'tokens.css'));

  const firstFamily = (stack: string) => stack.split(',')[0].replace(/['"]/g, '').trim();
  const designFamily = (role: string): string => {
    const m = design.match(new RegExp(`\\n  ${role}:\\n    fontFamily: '([^']+)'`));
    if (!m) throw new Error(`DESIGN.md has no typography role ${role}`);
    return firstFamily(m[1]);
  };
  const tokenFamily = (token: string): string => {
    const m = tokens.match(new RegExp(`${token}:\\s*([^;]+);`));
    if (!m) throw new Error(`tokens.css has no ${token}`);
    return firstFamily(m[1]);
  };

  it.each([
    ['wordmark', '--font-wordmark'],
    ['announcer-major', '--font-announcer'],
    ['announcer-secondary', '--font-entity'],
    ['enchanted-accent', '--font-accent'],
    ['body', '--font-body'],
    ['ledger', '--font-mono'],
  ])('DESIGN.md role %s resolves through %s to the same first family', (role, token) => {
    expect(tokenFamily(token)).toBe(designFamily(role));
  });

  it('the deprecated --font-heading alias and the dead Tailwind aliases are gone', () => {
    const offenders = sourceFiles(SRC).filter((f) => /--font-heading|--font-display/.test(read(f)));
    expect(offenders).toEqual([]);
    const tailwind = read(join(FRONTEND, 'tailwind.config.ts'));
    expect(tailwind).not.toMatch(/heading:|display:|'fantasy-title'|'fantasy-header'/);
  });

  it('ceremonial role classes map to the DESIGN.md faces with synthesis off', () => {
    const css = read(join(SRC, 'index.css'));
    const rule = (cls: string) => {
      const m = css.match(new RegExp(`\\.${cls} \\{([^}]*)\\}`));
      if (!m) throw new Error(`index.css has no .${cls}`);
      return m[1];
    };
    expect(rule('type-ceremonial-title')).toContain('font-family: var(--font-entity)');
    expect(rule('type-announcer-title')).toContain('font-family: var(--font-announcer)');
    expect(rule('type-enchanted-accent')).toContain('font-family: var(--font-accent)');
    for (const cls of ['type-ceremonial-title', 'type-announcer-title', 'type-enchanted-accent']) {
      expect(rule(cls)).toContain('font-synthesis: none');
    }
    // Whisperleaf's proven readability floor is 20px (--text-xl).
    expect(rule('type-enchanted-accent')).toContain('font-size: var(--text-xl)');
  });
});

describe('GameDialogTitle / FrostedPanelTitle variants (Equoria-ru830)', () => {
  it('GameDialogTitle is functional Proda Sans by default', () => {
    render(
      <GameDialog defaultOpen>
        <GameDialogContent>
          <GameDialogTitle>Confirm</GameDialogTitle>
        </GameDialogContent>
      </GameDialog>
    );
    const title = screen.getByRole('heading', { name: 'Confirm' });
    expect(title).toHaveAttribute('data-title-variant', 'functional');
    expect(title.className).toContain('font-[var(--font-body)]');
    expect(title.className).not.toContain('type-ceremonial-title');
  });

  it('GameDialogTitle ceremonial renders Basteleur Moonlight and never a synthesized bold', () => {
    render(
      <GameDialog defaultOpen>
        <GameDialogContent>
          <GameDialogTitle variant="ceremonial">Victory</GameDialogTitle>
        </GameDialogContent>
      </GameDialog>
    );
    const title = screen.getByRole('heading', { name: 'Victory' });
    expect(title).toHaveAttribute('data-title-variant', 'ceremonial');
    expect(title.className).toContain('type-ceremonial-title');
    expect(title.className).not.toContain('font-semibold');
    expect(title.className).not.toContain('font-[var(--font-body)]');
  });

  it('FrostedPanelTitle is functional by default and ceremonial on opt-in', () => {
    render(
      <FrostedPanel>
        <FrostedPanelHeader>
          <FrostedPanelTitle data-testid="plain">Quick Info</FrostedPanelTitle>
          <FrostedPanelTitle data-testid="grand" variant="ceremonial">
            Celestial Stallion
          </FrostedPanelTitle>
        </FrostedPanelHeader>
      </FrostedPanel>
    );
    expect(screen.getByTestId('plain').className).toContain('font-[var(--font-body)]');
    expect(screen.getByTestId('plain').className).not.toContain('type-ceremonial-title');
    expect(screen.getByTestId('grand').className).toContain('type-ceremonial-title');
    expect(screen.getByTestId('grand').className).not.toContain('font-semibold');
  });
});

describe('ceremonial consumers', () => {
  it('TrainingResultModal result title is the ceremonial Moonlight voice, not bold', () => {
    render(
      <TrainingResultModal
        isOpen
        onClose={vi.fn()}
        disciplineName="Dressage"
        scoreGain={6}
        baseScoreGain={5}
        newScore={51}
        nextTrainingDate={new Date('2026-02-07')}
      />
    );
    const title = screen.getByRole('heading', { name: /training complete/i });
    expect(title.className).toContain('type-ceremonial-title');
    expect(title.className).not.toContain('font-bold');
  });

  it.each(['trait-discovery', 'foal-birth', 'cup-win'] as const)(
    'CinematicMoment %s title is the Major Announcer (Basteleur Bold) role',
    (variant) => {
      render(<CinematicMoment variant={variant} title="A Foal is Born!" onDismiss={vi.fn()} />);
      const title = screen.getByTestId('cinematic-moment-title');
      expect(title.className).toContain('type-announcer-title');
      expect(title.className).not.toContain('fantasy-header');
    }
  );
});
