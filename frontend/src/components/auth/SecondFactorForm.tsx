/**
 * SecondFactorForm — the "one more key" step of an authenticated arrival.
 *
 * Finding 7 (Equoria-6p398.7). A player whose account carries a second factor
 * gets her password verified and NO session; the backend hands back a
 * short-lived challenge and waits for the code she is carrying. This form is
 * that wait: one field, one gold primary, and a quiet way through if her phone
 * is not to hand.
 *
 * It is deliberately surface-agnostic — it owns the field, the mode switch, the
 * pending state and the inline failure, and knows nothing about login, the
 * challenge token, routing, or the endpoint. The caller supplies the copy and
 * receives `{ token }` or `{ recoveryCode }`. A later step-up flow (the email
 * change already has a TOTP gate on the backend) can reuse it unchanged.
 *
 * Contract notes:
 *  - The code stays a STRING end to end so a leading zero survives.
 *  - Failure is `InlineError` at the control, per the frontend async-state
 *    doctrine. `errorMessage` must already be user-safe copy; this component
 *    never sees a raw server string.
 *  - The caller is responsible for never logging or storing the challenge.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form';
import { InlineError } from '@/components/ui/state';

/** What the player proved. Exactly one of the two, never both. */
export type SecondFactorSubmission = { token: string } | { recoveryCode: string };

export interface SecondFactorFormProps {
  /** Called with a trimmed, validated submission. Never called while pending. */
  onSubmit: (submission: SecondFactorSubmission) => void;
  /** True while the submission is in flight — blocks a duplicate submit. */
  isPending?: boolean;
  /** User-safe failure copy from the caller's error mapping. */
  errorMessage?: string | null;
  /** Optional way back (login uses it to return to the credentials step). */
  onCancel?: () => void;
  cancelLabel?: string;
  /** Label of the single gold primary. */
  submitLabel?: string;
  /** Extra class for the form element. */
  className?: string;
}

type Mode = 'authenticator' | 'recovery';

const CODE_LENGTH = 6;

export const SecondFactorForm: React.FC<SecondFactorFormProps> = ({
  onSubmit,
  isPending = false,
  errorMessage,
  onCancel,
  cancelLabel = 'Back to sign in',
  submitLabel = 'Enter',
  className,
}) => {
  const [mode, setMode] = useState<Mode>('authenticator');
  const [value, setValue] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const fieldRef = useRef<HTMLInputElement>(null);

  const isRecovery = mode === 'recovery';

  // Move focus to the field on arrival and whenever the player switches modes,
  // so the keyboard is already where the next keystroke belongs.
  useEffect(() => {
    fieldRef.current?.focus();
  }, [mode]);

  const switchMode = () => {
    setMode((current) => (current === 'recovery' ? 'authenticator' : 'recovery'));
    setValue('');
    setFieldError(null);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = isRecovery
      ? event.target.value
      : // Authenticator codes are digits; strip anything else rather than
        // failing the player after the fact. Still a string — leading zeros stay.
        event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setValue(next);
    if (fieldError) setFieldError(null);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isPending) return; // duplicate-submit guard

    const trimmed = value.trim();
    if (isRecovery) {
      if (trimmed.length === 0) {
        setFieldError('Enter one of your saved recovery codes.');
        fieldRef.current?.focus();
        return;
      }
      onSubmit({ recoveryCode: trimmed });
      return;
    }

    if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(trimmed)) {
      setFieldError(`Enter the ${CODE_LENGTH} digits shown in your authenticator app.`);
      fieldRef.current?.focus();
      return;
    }
    onSubmit({ token: trimmed });
  };

  return (
    <form onSubmit={handleSubmit} className={className} noValidate>
      <div className="space-y-3">
        <FormField
          label={isRecovery ? 'Recovery Code' : 'Six-Digit Code'}
          description={
            isRecovery
              ? 'Each recovery code works once.'
              : 'The code changes every 30 seconds — use the one showing now.'
          }
          error={fieldError}
        >
          {({ id, ...ariaProps }) => (
            <Input
              id={id}
              ref={fieldRef}
              name={isRecovery ? 'recoveryCode' : 'mfaCode'}
              type="text"
              value={value}
              onChange={handleChange}
              disabled={isPending}
              placeholder={isRecovery ? 'Your saved code' : '000000'}
              inputMode={isRecovery ? 'text' : 'numeric'}
              autoComplete={isRecovery ? 'off' : 'one-time-code'}
              autoCorrect="off"
              spellCheck={false}
              maxLength={isRecovery ? 64 : CODE_LENGTH}
              className={isRecovery ? undefined : 'tracking-widest text-center'}
              {...ariaProps}
            />
          )}
        </FormField>

        {errorMessage && <InlineError message={errorMessage} className="w-full" />}

        <Button type="submit" pending={isPending} size="default" className="w-full">
          {submitLabel}
        </Button>

        <div className="flex flex-col items-center gap-1 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={switchMode} disabled={isPending}>
            {isRecovery ? 'Use your authenticator code instead' : 'Use a recovery code instead'}
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
              {cancelLabel}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
};

export default SecondFactorForm;
