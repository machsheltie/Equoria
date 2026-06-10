/**
 * Select — native styled select tests (Equoria-o5hub.12)
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { Select } from '../Select';

const options = [
  { value: 'dressage', label: 'Dressage' },
  { value: 'jumping', label: 'Show Jumping' },
  { value: 'racing', label: 'Racing' },
];

describe('Select', () => {
  it('renders a <select> element', () => {
    render(<Select data-testid="sel" options={options} />);
    expect(screen.getByTestId('sel').tagName).toBe('SELECT');
  });

  it('renders option children from options prop', () => {
    render(<Select data-testid="sel" options={options} />);
    expect(screen.getByRole('option', { name: 'Dressage' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Show Jumping' })).toBeInTheDocument();
  });

  it('renders placeholder as disabled first option', () => {
    render(<Select data-testid="sel" options={options} placeholder="Choose discipline" />);
    const placeholder = screen.getByRole('option', { name: 'Choose discipline' });
    expect(placeholder).toBeDisabled();
  });

  it('carries glass-bg recipe', () => {
    render(<Select data-testid="sel" options={options} />);
    expect(screen.getByTestId('sel').className).toContain('bg-[var(--glass-bg)]');
  });

  it('carries radius-md recipe', () => {
    render(<Select data-testid="sel" options={options} />);
    expect(screen.getByTestId('sel').className).toContain('rounded-[var(--radius-md)]');
  });

  it('can select an option', async () => {
    const user = userEvent.setup();
    render(<Select data-testid="sel" options={options} />);
    await user.selectOptions(screen.getByTestId('sel'), 'jumping');
    expect(screen.getByTestId('sel')).toHaveValue('jumping');
  });

  it('disabled select has opacity-40 class', () => {
    render(<Select data-testid="sel" options={options} disabled />);
    expect(screen.getByTestId('sel').className).toContain('disabled:opacity-40');
  });

  it('supports children instead of options prop', () => {
    render(
      <Select data-testid="sel">
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </Select>
    );
    expect(screen.getByRole('option', { name: 'Alpha' })).toBeInTheDocument();
  });
});
