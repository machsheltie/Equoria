/**
 * GlassInput — Vitest/RTL tests (Story 22-6)
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { GlassInput } from '../GlassInput';

describe('GlassInput', () => {
  it('(a) renders with the tokenised field recipe (glass surface tokens)', () => {
    render(<GlassInput data-testid="input" placeholder="Horse name" />);
    // Re-platformed onto fieldStyles BASE_FIELD_CLASSES (Equoria-o5hub):
    // glass background + border tokens replace the legacy .celestial-input class.
    const className = screen.getByTestId('input').className;
    expect(className).toContain('bg-[var(--glass-bg)]');
    expect(className).toContain('border-[var(--glass-border)]');
    expect(className).not.toContain('celestial-input');
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
