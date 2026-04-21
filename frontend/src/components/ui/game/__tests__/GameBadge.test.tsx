/**
 * GameBadge — Vitest/RTL tests (Story 22-6)
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GameBadge } from '../GameBadge';

describe('GameBadge', () => {
  it('(a) default variant has gold bg and gold-light text tokens', () => {
    render(<GameBadge data-testid="badge">Champion</GameBadge>);
    const badge = screen.getByTestId('badge');
    expect(badge.className).toContain('bg-[var(--badge-gold-bg)]');
    expect(badge.className).toContain('text-[var(--gold-light)]');
    expect(screen.getByText('Champion')).toBeInTheDocument();
  });

  it('(a) rare variant uses --status-rare text token', () => {
    render(
      <GameBadge data-testid="badge" variant="rare">
        Rare
      </GameBadge>
    );
    expect(screen.getByTestId('badge').className).toContain('text-[var(--status-rare)]');
  });

  it('(a) legendary variant uses --status-legendary token', () => {
    render(
      <GameBadge data-testid="badge" variant="legendary">
        Legendary
      </GameBadge>
    );
    expect(screen.getByTestId('badge').className).toContain('text-[var(--status-legendary)]');
  });

  it('(a) common variant uses --rarity-common token', () => {
    render(
      <GameBadge data-testid="badge" variant="common">
        Common
      </GameBadge>
    );
    expect(screen.getByTestId('badge').className).toContain('text-[var(--rarity-common)]');
  });

  it('(a) destructive variant uses --status-danger token', () => {
    render(
      <GameBadge data-testid="badge" variant="destructive">
        Error
      </GameBadge>
    );
    expect(screen.getByTestId('badge').className).toContain('text-[var(--status-danger)]');
  });

  it('(a) ultra-rare variant uses --gold-bright text token', () => {
    render(
      <GameBadge data-testid="badge" variant="ultra-rare">
        Ultra Rare
      </GameBadge>
    );
    expect(screen.getByTestId('badge').className).toContain('text-[var(--gold-bright)]');
  });
});
