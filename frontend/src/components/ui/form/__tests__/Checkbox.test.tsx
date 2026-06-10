/**
 * Checkbox — Radix-backed checkbox tests (Equoria-o5hub.12)
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { Checkbox } from '../Checkbox';

describe('Checkbox', () => {
  it('renders with Radix role=checkbox', () => {
    render(<Checkbox data-testid="cb" />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('initial data-state is unchecked', () => {
    render(<Checkbox data-testid="cb" />);
    expect(screen.getByTestId('cb')).toHaveAttribute('data-state', 'unchecked');
  });

  it('carries glass-bg recipe class', () => {
    render(<Checkbox data-testid="cb" />);
    expect(screen.getByTestId('cb').className).toContain('bg-[var(--glass-bg)]');
  });

  it('carries glass-border recipe class', () => {
    render(<Checkbox data-testid="cb" />);
    expect(screen.getByTestId('cb').className).toContain('border-[var(--glass-border)]');
  });

  it('checked state class uses --gold-primary', () => {
    render(<Checkbox data-testid="cb" />);
    expect(screen.getByTestId('cb').className).toContain(
      'data-[state=checked]:bg-[var(--gold-primary)]'
    );
  });

  it('clicking sets data-state=checked', async () => {
    const user = userEvent.setup();
    render(<Checkbox data-testid="cb" />);
    await user.click(screen.getByTestId('cb'));
    expect(screen.getByTestId('cb')).toHaveAttribute('data-state', 'checked');
  });

  it('Space key toggles checked state', async () => {
    const user = userEvent.setup();
    render(<Checkbox data-testid="cb" />);
    const cb = screen.getByTestId('cb');
    cb.focus();
    await user.keyboard(' ');
    expect(cb).toHaveAttribute('data-state', 'checked');
    await user.keyboard(' ');
    expect(cb).toHaveAttribute('data-state', 'unchecked');
  });

  it('disabled state has opacity-40 class', () => {
    render(<Checkbox data-testid="cb" disabled />);
    expect(screen.getByTestId('cb').className).toContain('disabled:opacity-40');
  });

  it('gold focus ring class is present', () => {
    render(<Checkbox data-testid="cb" />);
    expect(screen.getByTestId('cb').className).toContain(
      'focus-visible:ring-[var(--gold-primary)]'
    );
  });
});
