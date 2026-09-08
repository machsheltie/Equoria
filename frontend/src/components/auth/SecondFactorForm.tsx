/**
 * SecondFactorForm — the "one more key" step of an authenticated arrival.
 *
 * Finding 7 (Equoria-6p398.7). A player whose account carries a second factor
 * gets her password verified and NO session; the backend hands back a
 * short-lived challenge and waits for the code she is carrying. This form is
 * that wait: one field, one gold primary, and a quiet way through if her phone
 * is not to hand.
 *
 * It is deliberately surface-agnostic — it owns the mode switch, the pending
 * state and the inline failure, and knows nothing about login, the challenge
 * token, routing, or the endpoint. The caller supplies the copy and receives
 * `{ token }` or `{ recoveryCode }`.
 *
 * The six-digit field itself is NOT owned here: it is `OneTimeCodeField`, which
 * the recovery-address step-up in Settings renders too. This form is not shared
 * with that surface — it carries its own `<form>`, its own gold primary and a
 * recovery-code path the email-change endpoint refuses — so the field is the
 * shared thing and the form is not (Equoria-6p398.11).
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
import { OneTimeCodeField, ONE_TIME_CODE_LENGTH } from './OneTimeCodeField';

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

  /**
   * The correction clears the complaint. Leaving it up while she retypes reads
   * as though the correction were being rejected too.
   */
  const accept = (next: string) => {
    setValue(next);
    if (fieldError) setFieldError(null);
  };

  const handleRecoveryChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    accept(event.target.value);

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

    if (!new RegExp(`^\\d{${ONE_TIME_CODE_LENGTH}}$`).test(trimmed)) {
      setFieldError(`Enter the ${ONE_TIME_CODE_LENGTH} digits shown in your authenticator app.`);
      fieldRef.current?.focus();
      return;
    }
    onSubmit({ token: trimmed });
  };

  return (
    <form onSubmit={handleSubmit} className={className} noValidate>
      <div className="space-y-3">
        {isRecovery ? (
          <FormField
            label="Recovery Code"
            description="Each recovery code works once."
            error={fieldError}
          >
            {({ id, ...ariaProps }) => (
              <Input
                id={id}
                ref={fieldRef}
                name="recoveryCode"
                type="text"
                value={value}
                onChange={handleRecoveryChange}
                disabled={isPending}
                placeholder="Your saved code"
                inputMode="text"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={64}
                {...ariaProps}
              />
            )}
          </FormField>
        ) : (
          /* The digits themselves are the shared field; this form still owns the
             submit, the failure copy and where focus goes. */
          <OneTimeCodeField
            ref={fieldRef}
            value={value}
            onChange={accept}
            disabled={isPending}
            error={fieldError}
            className="text-center"
          />
        )}

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
