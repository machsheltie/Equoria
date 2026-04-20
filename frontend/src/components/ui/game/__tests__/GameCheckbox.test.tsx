/**
 * GameCheckbox — Vitest/RTL tests (Story 22-6)
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { GameCheckbox } from '../GameCheckbox';

describe('GameCheckbox', () => {
  it('(a) unchecked state has navy bg token', () => {
    render(<GameCheckbox data-testid="cb" />);
    expect(screen.getByTestId('cb').className).toContain('bg-[var(--celestial-navy-800)]');
  });

  it('(c) initial data-state is unchecked', () => {
    render(<GameCheckbox data-testid="cb" />);
    expect(screen.getByTestId('cb')).toHaveAttribute('data-state', 'unchecked');
  });

  it('(c) clicking checkbox sets data-state=checked', async () => {
    const user = userEvent.setup();
    render(<GameCheckbox data-testid="cb" />);
    await user.click(screen.getByTestId('cb'));
    expect(screen.getByTestId('cb')).toHaveAttribute('data-state', 'checked');
  });

  it('(b) Space key toggles checked state', async () => {
    const user = userEvent.setup();
    render(<GameCheckbox data-testid="cb" />);
    const cb = screen.getByTestId('cb');
    cb.focus();
    await user.keyboard(' ');
    expect(cb).toHaveAttribute('data-state', 'checked');
    await user.keyboard(' ');
    expect(cb).toHaveAttribute('data-state', 'unchecked');
  });

  it('(a) checked state class uses --gold-700 token', () => {
    render(<GameCheckbox data-testid="cb" />);
    expect(screen.getByTestId('cb').className).toContain(
      'data-[state=checked]:bg-[var(--gold-700)]'
    );
  });
});
