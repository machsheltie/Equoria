/**
 * NumberInput — stepper + clamp tests (Equoria-o5hub.12)
 */
import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { NumberInput } from '../NumberInput';

function Controlled({ initial = 5, min = 0, max = 10, step = 1 }) {
  const [val, setVal] = useState<number | string>(initial);
  return (
    <NumberInput
      value={val}
      onChange={setVal}
      min={min}
      max={max}
      step={step}
      showSteppers
      data-testid="num"
    />
  );
}

describe('NumberInput', () => {
  it('renders an <input type=number>', () => {
    render(<NumberInput data-testid="num" />);
    expect(screen.getByTestId('num')).toHaveAttribute('type', 'number');
  });

  it('carries glass-bg recipe', () => {
    render(<NumberInput data-testid="num" />);
    expect(screen.getByTestId('num').className).toContain('bg-[var(--glass-bg)]');
  });

  it('showSteppers renders increment/decrement buttons', () => {
    render(<NumberInput showSteppers data-testid="num" />);
    expect(screen.getByRole('button', { name: 'Increment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decrement' })).toBeInTheDocument();
  });

  it('increment button increases value by step', async () => {
    const user = userEvent.setup();
    render(<Controlled initial={5} step={1} />);
    await user.click(screen.getByRole('button', { name: 'Increment' }));
    expect(screen.getByTestId('num')).toHaveValue(6);
  });

  it('decrement button decreases value by step', async () => {
    const user = userEvent.setup();
    render(<Controlled initial={5} step={1} />);
    await user.click(screen.getByRole('button', { name: 'Decrement' }));
    expect(screen.getByTestId('num')).toHaveValue(4);
  });

  it('increment is disabled at max', () => {
    render(<Controlled initial={10} max={10} />);
    expect(screen.getByRole('button', { name: 'Increment' })).toBeDisabled();
  });

  it('decrement is disabled at min', () => {
    render(<Controlled initial={0} min={0} />);
    expect(screen.getByRole('button', { name: 'Decrement' })).toBeDisabled();
  });

  it('clamps value above max on blur', async () => {
    const user = userEvent.setup();
    render(<Controlled initial={5} max={10} />);
    const inp = screen.getByTestId('num');
    await user.clear(inp);
    await user.type(inp, '99');
    await user.tab(); // trigger blur
    expect(inp).toHaveValue(10);
  });

  it('clamps value below min on blur', async () => {
    const user = userEvent.setup();
    render(<Controlled initial={5} min={0} />);
    const inp = screen.getByTestId('num');
    await user.clear(inp);
    await user.type(inp, '-5');
    await user.tab();
    expect(inp).toHaveValue(0);
  });

  it('no steppers rendered without showSteppers prop', () => {
    render(<NumberInput data-testid="num" />);
    expect(screen.queryByRole('button', { name: 'Increment' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Decrement' })).toBeNull();
  });
});
