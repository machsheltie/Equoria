/**
 * GlassTextarea — Vitest/RTL tests (Story 22-6)
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { GlassTextarea } from '../GlassTextarea';

describe('GlassTextarea', () => {
  it('(a) renders with the tokenised field recipe (glass surface tokens)', () => {
    render(<GlassTextarea data-testid="ta" placeholder="Notes" />);
    // Re-platformed onto fieldStyles BASE_FIELD_CLASSES (Equoria-o5hub):
    // glass background + border tokens replace the legacy .celestial-input class.
    const className = screen.getByTestId('ta').className;
    expect(className).toContain('bg-[var(--glass-bg)]');
    expect(className).toContain('border-[var(--glass-border)]');
    expect(className).not.toContain('celestial-input');
  });

  it('(b) accepts multiline input', async () => {
    const user = userEvent.setup();
    render(<GlassTextarea data-testid="ta" />);
    const ta = screen.getByTestId('ta');
    await user.type(ta, 'Line one{Enter}Line two');
    expect(ta).toHaveValue('Line one\nLine two');
  });
});
