/**
 * GlassTextarea — Vitest/RTL tests (Story 22-6)
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { GlassTextarea } from '../GlassTextarea';

describe('GlassTextarea', () => {
  it('(a) renders with celestial-input token class', () => {
    render(<GlassTextarea data-testid="ta" placeholder="Notes" />);
    expect(screen.getByTestId('ta').className).toContain('celestial-input');
  });

  it('(b) accepts multiline input', async () => {
    const user = userEvent.setup();
    render(<GlassTextarea data-testid="ta" />);
    const ta = screen.getByTestId('ta');
    await user.type(ta, 'Line one{Enter}Line two');
    expect(ta).toHaveValue('Line one\nLine two');
  });
});
