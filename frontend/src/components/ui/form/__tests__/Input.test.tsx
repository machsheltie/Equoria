/**
 * Input — canonical form control tests (Equoria-o5hub.12)
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { Input } from '../Input';

describe('Input', () => {
  it('renders an <input> element', () => {
    render(<Input data-testid="inp" />);
    expect(screen.getByTestId('inp').tagName).toBe('INPUT');
  });

  it('carries glass-bg recipe class', () => {
    render(<Input data-testid="inp" />);
    const cls = screen.getByTestId('inp').className;
    expect(cls).toContain('bg-[var(--glass-bg)]');
  });

  it('carries glass-border recipe class', () => {
    render(<Input data-testid="inp" />);
    expect(screen.getByTestId('inp').className).toContain('border-[var(--glass-border)]');
  });

  it('carries radius-md recipe class', () => {
    render(<Input data-testid="inp" />);
    expect(screen.getByTestId('inp').className).toContain('rounded-[var(--radius-md)]');
  });

  it('carries text-primary recipe class', () => {
    render(<Input data-testid="inp" />);
    expect(screen.getByTestId('inp').className).toContain('text-[var(--text-primary)]');
  });

  it('accepts typed text', async () => {
    const user = userEvent.setup();
    render(<Input data-testid="inp" />);
    const inp = screen.getByTestId('inp');
    await user.type(inp, 'Midnight Star');
    expect(inp).toHaveValue('Midnight Star');
  });

  it('is focusable via Tab', async () => {
    const user = userEvent.setup();
    render(<Input data-testid="inp" />);
    await user.tab();
    expect(screen.getByTestId('inp')).toHaveFocus();
  });

  it('disabled state has opacity-40 and cursor-not-allowed', () => {
    render(<Input data-testid="inp" disabled />);
    const cls = screen.getByTestId('inp').className;
    expect(cls).toContain('disabled:opacity-40');
    expect(cls).toContain('disabled:cursor-not-allowed');
  });

  it('aria-invalid renders the invalid state class', () => {
    render(<Input data-testid="inp" aria-invalid="true" />);
    expect(screen.getByTestId('inp').getAttribute('aria-invalid')).toBe('true');
    // The Tailwind variant is declared in the class string
    expect(screen.getByTestId('inp').className).toContain(
      'aria-[invalid=true]:border-[var(--role-danger-border)]'
    );
  });

  it('forwards className prop', () => {
    render(<Input data-testid="inp" className="custom-cls" />);
    expect(screen.getByTestId('inp').className).toContain('custom-cls');
  });
});
