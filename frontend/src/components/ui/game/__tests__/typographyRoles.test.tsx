/**
 * Typography roles — the code must match DESIGN.md's type roles
 * (Equoria-gr7ph, -ru830, -cunq3, -ely1r).
 *
 * Real components. Class assertions are the right level in jsdom: the role
 * classes resolve to faces through tokens.css / index.css.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FrostedPanel, FrostedPanelHeader, FrostedPanelTitle } from '../FrostedPanel';
import { GameDialog, GameDialogContent, GameDialogTitle } from '../GameDialog';
import CinematicMoment from '@/components/feedback/CinematicMoment';

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
  // Old case: TrainingResultModal's title used this voice. Owner ruling q173
  // (2026-10-28; Equoria-6v2rt) removed the training result popup.
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
