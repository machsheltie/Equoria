/**
 * GameLabel — Vitest/RTL tests (Story 22-6)
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GameLabel } from '../GameLabel';
// o5hub.44: deprecated GlassInput deleted — use the canonical form Input for
// the label/input-association test (intent preserved: htmlFor links to an input).
import { Input } from '@/components/ui/form';

describe('GameLabel', () => {
  it('(a) renders with cream text token by default', () => {
    render(<GameLabel data-testid="lbl">Horse Name</GameLabel>);
    const lbl = screen.getByTestId('lbl');
    expect(lbl.className).toContain('text-[var(--cream)]');
    expect(lbl.tagName).toBe('LABEL');
  });

  it('(a) smallCaps prop applies uppercase tracking class', () => {
    render(
      <GameLabel data-testid="lbl" smallCaps>
        Group Header
      </GameLabel>
    );
    const lbl = screen.getByTestId('lbl');
    expect(lbl.className).toContain('uppercase');
    expect(lbl.className).toContain('tracking-widest');
  });

  it('(a) required prop applies --gold-400 text token', () => {
    render(
      <GameLabel data-testid="lbl" required>
        Required Field
      </GameLabel>
    );
    expect(screen.getByTestId('lbl').className).toContain('text-[var(--gold-400)]');
  });

  it('(b) associates with input via htmlFor', () => {
    render(
      <>
        <GameLabel htmlFor="horse-name">Name</GameLabel>
        <Input id="horse-name" />
      </>
    );
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });
});
