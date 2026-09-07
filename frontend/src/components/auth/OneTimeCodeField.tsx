/**
 * OneTimeCodeField — the six digits, and nothing else (Equoria-6p398.7 / .11).
 *
 * Two surfaces ask a player for the code her authenticator is showing: the
 * login second factor (`SecondFactorForm`) and the recovery-address step-up
 * (`RecoveryAddressSection`). What they genuinely share is the FIELD — its
 * label, its digit-only editing, the platform hints that make a phone offer the
 * code, the six-character ceiling, and the aria wiring that announces a
 * failure. What they do not share is the form: each surface owns its own
 * `<form>`, its own single primary action, its own submit semantics and its own
 * error mapping (FRONTEND_ASYNC_STATE_DOCTRINE §3 — the surface owns its
 * feedback). So the field is shared and the form is not.
 *
 * Contract notes:
 *  - The value is a STRING end to end. A code of `012345` is six digits, not
 *    the number 12345; nothing here may coerce it.
 *  - `onChange` receives the already-cleaned string, so a caller never has to
 *    remember to strip. Anything that is not a digit is dropped as it is typed
 *    rather than rejected after the fact.
 *  - Purely presentational: no submit, no network call, no recovery-code
 *    concept, no notion of which flow it is standing in. Copy, name, control id
 *    and failure text all come from the caller.
 *  - `ref` reaches the input, so a caller can return focus to it after a failed
 *    submit without this component knowing what a submit is.
 */

import React, { useEffect, useRef } from 'react';
import { FormField, Input } from '@/components/ui/form';
import { cn } from '@/lib/utils';

/** A TOTP code is six digits. Both surfaces validate against this same length. */
export const ONE_TIME_CODE_LENGTH = 6;

const DEFAULT_LABEL = 'Six-Digit Code';
const DEFAULT_DESCRIPTION = 'The code changes every 30 seconds — use the one showing now.';

export interface OneTimeCodeFieldProps {
  /** The current code, always a string so a leading zero survives. */
  value: string;
  /** Called with the cleaned digits-only string. */
  onChange: (value: string) => void;
  /** True while the caller's submit is in flight — the field goes honestly inert. */
  disabled?: boolean;
  /** User-safe failure copy from the caller; wires aria-invalid + role="alert". */
  error?: string | null;
  /** Field label. Defaults to the copy both current surfaces use. */
  label?: string;
  /** Helper copy under the label. */
  description?: string;
  /** Form control name, since the two surfaces post different keys. */
  name?: string;
  /** Overrides the generated control id (and the label's `for`). */
  htmlFor?: string;
  /** Move focus here on arrival. Off by default — focus is the caller's call. */
  autoFocus?: boolean;
  /** Extra classes for the input, merged after the field's own tracking. */
  className?: string;
}

const OneTimeCodeField = React.forwardRef<HTMLInputElement, OneTimeCodeFieldProps>(
  (
    {
      value,
      onChange,
      disabled = false,
      error,
      label = DEFAULT_LABEL,
      description = DEFAULT_DESCRIPTION,
      name = 'mfaCode',
      htmlFor,
      autoFocus = false,
      className,
    },
    forwardedRef
  ) => {
    const innerRef = useRef<HTMLInputElement | null>(null);

    // Keep our own handle on the input (for autoFocus) without taking the
    // caller's away.
    const attachRef = (node: HTMLInputElement | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    };

    useEffect(() => {
      if (autoFocus) innerRef.current?.focus();
    }, [autoFocus]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      // Authenticator codes are digits; strip anything else rather than failing
      // the player after the fact. Still a string — leading zeros stay.
      onChange(event.target.value.replace(/\D/g, '').slice(0, ONE_TIME_CODE_LENGTH));
    };

    return (
      <FormField label={label} htmlFor={htmlFor} description={description} error={error}>
        {({ id, ...ariaProps }) => (
          <Input
            id={id}
            ref={attachRef}
            name={name}
            type="text"
            value={value}
            onChange={handleChange}
            disabled={disabled}
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoCorrect="off"
            spellCheck={false}
            maxLength={ONE_TIME_CODE_LENGTH}
            className={cn('tracking-widest', className)}
            {...ariaProps}
          />
        )}
      </FormField>
    );
  }
);

OneTimeCodeField.displayName = 'OneTimeCodeField';

export { OneTimeCodeField };
export default OneTimeCodeField;
