/**
 * GlassInput — Vitest/RTL tests (Story 22-6)
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { GlassInput } from '../GlassInput';

describe('GlassInput', () => {
  it('(a) renders with celestial-input token class', () => {
    render(<GlassInput data-testid="input" placeholder="Horse name" />);
    expect(screen.getByTestId('input').className).toContain('celestial-input');
  });

  it('(b) accepts typed text', async () => {
    const user = userEvent.setup();
    render(<GlassInput data-testid="input" />);
    const input = screen.getByTestId('input');
    await user.type(input, 'Midnight Star');
    expect(input).toHaveValue('Midnight Star');
  });

  it('(b) reachable via Tab', async () => {
    const user = userEvent.setup();
    render(<GlassInput data-testid="input" />);
    await user.tab();
    expect(screen.getByTestId('input')).toHaveFocus();
  });
});
