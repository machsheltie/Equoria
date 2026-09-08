/**
 * OneTimeCodeField — the shared six-digit field (Equoria-6p398.7 / .11).
 *
 * The field is the only thing the login second factor and the recovery-address
 * step-up actually had in common, so it is the only thing that is shared. These
 * tests pin the behaviour both surfaces depend on: the code stays a STRING so a
 * leading zero survives, anything that is not a digit never reaches the caller,
 * six is the ceiling, the control is honestly disabled while a submit is in
 * flight, and the failure is announced rather than merely coloured.
 */

import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import {
  OneTimeCodeField,
  ONE_TIME_CODE_LENGTH,
  type OneTimeCodeFieldProps,
} from './OneTimeCodeField';

/**
 * The field is controlled, so the test owns the value the way a real form does.
 * Typing through a stub `onChange` would only prove the stub was called.
 */
function Harness({
  onChange,
  ...rest
}: Partial<OneTimeCodeFieldProps> & { onChange?: (value: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <OneTimeCodeField
      {...rest}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

const codeInput = () => screen.getByLabelText(/six-digit code/i) as HTMLInputElement;

describe('OneTimeCodeField', () => {
  it('renders the six-digit label and the code-rotation helper copy by default', () => {
    render(<Harness />);
    expect(screen.getByText('Six-Digit Code')).toBeInTheDocument();
    expect(
      screen.getByText('The code changes every 30 seconds — use the one showing now.')
    ).toBeInTheDocument();
  });

  it('offers the platform the one-time-code affordances', () => {
    render(<Harness />);
    const input = codeInput();
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('autocomplete', 'one-time-code');
    expect(input).toHaveAttribute('maxlength', String(ONE_TIME_CODE_LENGTH));
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('placeholder', '000000');
  });

  it('strips anything that is not a digit instead of failing the player afterwards', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.type(codeInput(), 'a1b2-c3');

    expect(codeInput().value).toBe('123');
    expect(onChange).toHaveBeenLastCalledWith('123');
  });

  it('keeps the code a string so a leading zero survives', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.type(codeInput(), '012345');

    expect(codeInput().value).toBe('012345');
    const reported = onChange.mock.lastCall?.[0];
    expect(typeof reported).toBe('string');
    expect(reported).toBe('012345');
  });

  it('never reports more than six digits', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.type(codeInput(), '1234567890');

    expect(codeInput().value).toBe('123456');
    expect(onChange.mock.calls.every(([value]) => value.length <= ONE_TIME_CODE_LENGTH)).toBe(true);
  });

  it('is disabled while the caller reports the submit in flight', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness disabled onChange={onChange} />);

    const input = codeInput();
    expect(input).toBeDisabled();
    await user.type(input, '123456');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('announces a failure and points the control at it', () => {
    render(<Harness error="Enter the 6 digits showing in your authenticator app." />);

    const input = codeInput();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const errorEl = screen.getByRole('alert');
    expect(errorEl).toHaveTextContent('Enter the 6 digits showing in your authenticator app.');
    expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(errorEl.id);
  });

  it('is not marked invalid when the caller reports no failure', () => {
    render(<Harness />);
    expect(codeInput()).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('takes focus on arrival when the caller asks for it', () => {
    render(<Harness autoFocus />);
    expect(codeInput()).toHaveFocus();
  });

  it('leaves focus where it was when the caller does not ask for it', () => {
    render(<Harness />);
    expect(codeInput()).not.toHaveFocus();
  });

  it('lets the caller own the label, the helper copy, the field name and the control id', () => {
    render(
      <Harness
        label="Confirmation Code"
        description="Use the one showing now."
        name="recoveryCode"
        htmlFor="recovery-code"
      />
    );

    const input = screen.getByLabelText('Confirmation Code');
    expect(input).toHaveAttribute('name', 'recoveryCode');
    expect(input).toHaveAttribute('id', 'recovery-code');
    expect(screen.getByText('Use the one showing now.')).toBeInTheDocument();
    expect(screen.queryByText('Six-Digit Code')).not.toBeInTheDocument();
  });

  it('exposes the input through a forwarded ref so the caller can move focus', async () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<OneTimeCodeField ref={ref} value="" onChange={() => {}} />);

    expect(ref.current).toBe(codeInput());
    ref.current?.focus();
    expect(codeInput()).toHaveFocus();
  });
});
