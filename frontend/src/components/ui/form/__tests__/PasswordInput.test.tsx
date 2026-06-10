/**
 * PasswordInput — show/hide toggle tests (Equoria-o5hub.12)
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { PasswordInput } from '../PasswordInput';

describe('PasswordInput', () => {
  it('renders a password input by default', () => {
    render(<PasswordInput data-testid="pw" />);
    expect(screen.getByTestId('pw')).toHaveAttribute('type', 'password');
  });

  it('renders a toggle button', () => {
    render(<PasswordInput />);
    expect(screen.getByRole('button', { name: /show password/i })).toBeInTheDocument();
  });

  it('toggle button has aria-pressed=false initially', () => {
    render(<PasswordInput />);
    expect(screen.getByRole('button', { name: /show password/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('clicking toggle switches type to text', async () => {
    const user = userEvent.setup();
    render(<PasswordInput data-testid="pw" />);
    await user.click(screen.getByRole('button', { name: /show password/i }));
    expect(screen.getByTestId('pw')).toHaveAttribute('type', 'text');
  });

  it('clicking toggle again switches back to password', async () => {
    const user = userEvent.setup();
    render(<PasswordInput data-testid="pw" />);
    await user.click(screen.getByRole('button', { name: /show password/i }));
    await user.click(screen.getByRole('button', { name: /hide password/i }));
    expect(screen.getByTestId('pw')).toHaveAttribute('type', 'password');
  });

  it('toggle has aria-pressed=true when showing', async () => {
    const user = userEvent.setup();
    render(<PasswordInput />);
    await user.click(screen.getByRole('button', { name: /show password/i }));
    expect(screen.getByRole('button', { name: /hide password/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('aria-label changes with state', async () => {
    const user = userEvent.setup();
    render(<PasswordInput />);
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();
  });

  it('carries glass-bg recipe from Input', () => {
    render(<PasswordInput data-testid="pw" />);
    expect(screen.getByTestId('pw').className).toContain('bg-[var(--glass-bg)]');
  });
});
