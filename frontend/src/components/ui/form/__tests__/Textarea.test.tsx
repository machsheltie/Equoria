/**
 * Textarea — canonical form control tests (Equoria-o5hub.12)
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { Textarea } from '../Textarea';

describe('Textarea', () => {
  it('renders a <textarea> element', () => {
    render(<Textarea data-testid="ta" />);
    expect(screen.getByTestId('ta').tagName).toBe('TEXTAREA');
  });

  it('carries glass-bg recipe', () => {
    render(<Textarea data-testid="ta" />);
    expect(screen.getByTestId('ta').className).toContain('bg-[var(--glass-bg)]');
  });

  it('carries glass-border recipe', () => {
    render(<Textarea data-testid="ta" />);
    expect(screen.getByTestId('ta').className).toContain('border-[var(--glass-border)]');
  });

  it('carries radius-md recipe', () => {
    render(<Textarea data-testid="ta" />);
    expect(screen.getByTestId('ta').className).toContain('rounded-[var(--radius-md)]');
  });

  it('has resize-y by default', () => {
    render(<Textarea data-testid="ta" />);
    expect(screen.getByTestId('ta').className).toContain('resize-y');
  });

  it('has min-height class', () => {
    render(<Textarea data-testid="ta" />);
    expect(screen.getByTestId('ta').className).toContain('min-h-[80px]');
  });

  it('accepts multiline text', async () => {
    const user = userEvent.setup();
    render(<Textarea data-testid="ta" />);
    await user.type(screen.getByTestId('ta'), 'Line one{Enter}Line two');
    expect(screen.getByTestId('ta')).toHaveValue('Line one\nLine two');
  });

  it('disabled has opacity-40 and cursor-not-allowed', () => {
    render(<Textarea data-testid="ta" disabled />);
    const cls = screen.getByTestId('ta').className;
    expect(cls).toContain('disabled:opacity-40');
    expect(cls).toContain('disabled:cursor-not-allowed');
  });
});
