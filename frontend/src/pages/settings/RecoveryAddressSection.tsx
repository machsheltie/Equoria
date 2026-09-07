/**
 * RecoveryAddressSection — "the way back in" (Finding 9, Equoria-6p398.11).
 *
 * Finding 5 (Equoria-6p398.5) made the email address what it always really was:
 * the account's recovery identity. Both ordinary write paths now answer 403, and
 * the address moves only through a staged request/confirm flow that had no
 * surface at all — while Settings still showed an editable Email input wired to
 * `useUpdateProfile`, a control that could no longer succeed.
 *
 * This is that surface, and it is deliberately NOT another form row. The
 * subject is the promise the flow keeps: *this is where Equoria writes to if you
 * are ever locked out, and it stays yours until a new one is confirmed*. So the
 * confirmed address stands as a fact first; changing it is a separate,
 * deliberate act behind a quiet disclosure — the same grammar the sibling
 * "Change Password" block in this panel already uses, so the Account panel keeps
 * one voice instead of gaining a second.
 *
 * Design notes:
 *  - The submit is a supporting action, not gold. `Save Changes` owns the
 *    Account panel's single gold primary (DESIGN.md, The One Gold Action Rule).
 *  - Feedback is Surface-Owned: failure is `InlineError` at the control, success
 *    is this section changing into its waiting state. No toast, no overlay
 *    (FRONTEND_ASYNC_STATE_DOCTRINE §3).
 *  - Whether to ask for a code is READ from `GET /auth/email-change/status`, not
 *    guessed: the backend refuses a wrong password and a missing code with the
 *    same bare 401, so a failed attempt cannot tell them apart.
 *  - No jargon reaches the player: the words MFA, TOTP and two-factor appear
 *    nowhere in the copy.
 */

import React, { useState } from 'react';
import { Mail, ShieldCheck, ShieldAlert, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, PasswordInput, FormField } from '@/components/ui/form';
import { InlineError, SectionLoading, ErrorState } from '@/components/ui/state';
import { useEmailChangeStatus, useRequestEmailChange } from '@/hooks/useAuth';
import { recoveryAddressMessage } from '@/lib/http/authErrorMessages';
import { emailSchema } from '@/lib/validation-schemas';

const CODE_LENGTH = 6;

/** Honest rendering of a server timestamp; never a plausible-looking guess. */
function formatLapses(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(parsed));
}

export const RecoveryAddressSection: React.FC = () => {
  const { data: status, isPending, isError, refetch } = useEmailChangeStatus();
  const {
    mutate: requestChange,
    data: staged,
    isPending: isSending,
    error: requestError,
  } = useRequestEmailChange();

  const [isChanging, setIsChanging] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errorDismissed, setErrorDismissed] = useState(false);

  /**
   * Clear a field's error the moment the player starts correcting it, the way
   * `SecondFactorForm` does — leaving it up while she retypes reads as though
   * the correction were being rejected too.
   */
  const clearFieldError = (field: string) =>
    setFieldErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });

  const secondFactorRequired = status?.secondFactorRequired ?? false;

  /**
   * A locally staged change wins over the server read: the read may race the
   * mutation, and a surface that forgot what the player just did would be
   * lying about the state of her own account.
   */
  const waiting = staged
    ? {
        // The player just typed this address, so showing it back to her in full
        // tells her nothing she does not already know.
        email: staged.pendingEmail,
        expiresAt: staged.expiresAt,
        // The cooldown is not in the staging response, so it is read from the
        // status query — which `useRequestEmailChange` invalidates on success.
        // Because `waiting` is derived during render rather than captured at
        // staging time, the sentence appears as soon as that refetch lands,
        // instead of only after the player happens to reload the page.
        resendAvailableAt: status?.pending?.resendAvailableAt ?? null,
        noticeDelivered: staged.noticeDelivered,
      }
    : status?.pending
      ? {
          // A later read reports it MASKED, and the surface must not try to
          // reconstruct it — recognition is all this state needs.
          email: status.pending.maskedEmail,
          expiresAt: status.pending.expiresAt,
          resendAvailableAt: status.pending.resendAvailableAt,
          noticeDelivered: true,
        }
      : null;

  /** Clear the typed values and put the form away. */
  const clearForm = () => {
    setIsChanging(false);
    setNewEmail('');
    setPassword('');
    setCode('');
    setFieldErrors({});
  };

  /**
   * Opening or cancelling the form hides the previous attempt's failure without
   * calling the mutation's `reset()`: reset would also drop `data`, and `data`
   * is the only record that a change was just staged while the status refetch
   * is still in flight. Dismissing is a view concern, so it lives in view state.
   */
  const cancelForm = () => {
    clearForm();
    setErrorDismissed(true);
  };

  /** Success: put the form away and keep what the mutation reported. */
  const finishForm = () => clearForm();

  const openForm = () => {
    setErrorDismissed(true);
    setFieldErrors({});
    setIsChanging(true);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isSending) return; // one submit costs exactly one request

    const errors: Record<string, string> = {};
    const parsedEmail = emailSchema.safeParse(newEmail);
    if (!parsedEmail.success) {
      errors.email = parsedEmail.error.issues[0]?.message ?? 'Enter a valid email address.';
    } else if (status && parsedEmail.data === status.email.toLowerCase()) {
      errors.email = 'That is already the address on this account.';
    }
    if (password.length === 0) {
      errors.password = 'Enter your current Equoria password.';
    }
    if (secondFactorRequired && !new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code.trim())) {
      errors.code = `Enter the ${CODE_LENGTH} digits showing in your authenticator app.`;
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setErrorDismissed(false);
    requestChange(
      {
        email: parsedEmail.success ? parsedEmail.data : newEmail,
        password,
        // The code stays a STRING end to end so a leading zero survives.
        ...(secondFactorRequired ? { totpToken: code.trim() } : {}),
      },
      { onSuccess: finishForm }
    );
  };

  const body = () => {
    if (isPending) {
      return <SectionLoading label="Reading your recovery address" />;
    }

    if (isError || !status) {
      return (
        <ErrorState
          title="Could not read your recovery address"
          message="We could not reach the stable just now. Nothing has changed."
          retry={{ label: 'Try Again', onClick: () => refetch() }}
        />
      );
    }

    return (
      <div className="space-y-4">
        {/* The standing fact, not a form row. */}
        <div className="flex items-start gap-2.5">
          <Mail
            className="w-4 h-4 mt-0.5 flex-shrink-0 text-[var(--icon-accent)]"
            aria-hidden="true"
          />
          <div className="min-w-0 space-y-1">
            <p className="text-sm text-role-primary break-words">{status.email}</p>
            {/* Never colour alone — icon and word together. */}
            <p className="inline-flex items-center gap-1.5 text-xs text-role-secondary">
              {status.emailVerified ? (
                <>
                  <ShieldCheck
                    className="w-3.5 h-3.5 text-[var(--status-success)]"
                    aria-hidden="true"
                  />
                  <span>Verified</span>
                </>
              ) : (
                <>
                  <ShieldAlert
                    className="w-3.5 h-3.5 text-[var(--status-warning)]"
                    aria-hidden="true"
                  />
                  <span>Not yet verified</span>
                </>
              )}
            </p>
          </div>
        </div>

        {waiting && (
          <div
            role="status"
            data-testid="recovery-address-waiting"
            className="rounded-[var(--radius-md)] border border-[var(--role-accent-border)] bg-[var(--role-accent-bg)] px-3 py-2.5 space-y-1"
          >
            <p className="inline-flex items-center gap-1.5 text-sm text-[var(--role-accent-text)]">
              <Clock className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
              <span>
                A letter is waiting at <strong className="break-words">{waiting.email}</strong>.
              </span>
            </p>
            <p className="text-xs text-role-secondary">
              Open it from that inbox to finish the move. Until you do,{' '}
              <span className="break-words">{status.email}</span> is still your way back in.
            </p>
            <p className="text-xs text-role-secondary">
              The link lapses on {formatLapses(waiting.expiresAt)}.
            </p>
            {/* Both of these are real consequences the backend enforces, and a
                player only ever met them by accident before: the password paths
                revoke pending changes (`revokePendingEmailChanges`), and a
                second request inside the cooldown answers 429. Saying them here
                is the difference between a warning and a surprise. */}
            <p className="text-xs text-role-secondary">
              Changing your password cancels this move — do that instead if you did not ask for it.
            </p>
            {waiting.resendAvailableAt && (
              <p className="text-xs text-role-secondary">
                Need a new link? You can send one from {formatLapses(waiting.resendAvailableAt)}.
              </p>
            )}
            {!waiting.noticeDelivered && (
              <p className="text-xs text-role-secondary">
                We couldn&rsquo;t send the heads-up to your current address, but the change is
                waiting all the same.
              </p>
            )}
          </div>
        )}

        {!isChanging ? (
          <Button type="button" variant="secondary" onClick={openForm}>
            {waiting ? 'Choose a different address' : 'Use a different address'}
          </Button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <FormField
              label="New Email Address"
              htmlFor="recovery-new-email"
              description="We will send a confirmation there. Nothing moves until you open it."
              error={fieldErrors.email}
            >
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  name="newEmail"
                  type="email"
                  value={newEmail}
                  onChange={(event) => {
                    setNewEmail(event.target.value);
                    clearFieldError('email');
                  }}
                  disabled={isSending}
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              )}
            </FormField>

            <FormField
              label="Current Password"
              htmlFor="recovery-password"
              description="Proving it is you, right now — not just that you are signed in."
              error={fieldErrors.password}
            >
              {(fieldProps) => (
                <PasswordInput
                  {...fieldProps}
                  name="recoveryPassword"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    clearFieldError('password');
                  }}
                  disabled={isSending}
                  autoComplete="current-password"
                />
              )}
            </FormField>

            {secondFactorRequired && (
              <FormField
                label="Six-Digit Code"
                htmlFor="recovery-code"
                description="The code changes every 30 seconds — use the one showing now."
                error={fieldErrors.code}
              >
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    name="recoveryCode"
                    type="text"
                    value={code}
                    onChange={(event) => {
                      setCode(event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH));
                      clearFieldError('code');
                    }}
                    disabled={isSending}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={CODE_LENGTH}
                    placeholder="000000"
                    className="tracking-widest"
                  />
                )}
              </FormField>
            )}

            {requestError && !errorDismissed && (
              <InlineError
                message={
                  recoveryAddressMessage(requestError, { secondFactorRequired }) ??
                  'That did not work. Check your details and try again.'
                }
                className="w-full"
              />
            )}

            {/* Dismissive first, affirmative last — the panel's own order. */}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" onClick={cancelForm} disabled={isSending}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="secondary"
                pending={isSending}
                data-testid="recovery-address-submit"
              >
                Send the Confirmation
              </Button>
            </div>
          </form>
        )}
      </div>
    );
  };

  return (
    <section
      aria-labelledby="recovery-address-heading"
      data-testid="settings-recovery-address"
      className="space-y-3"
    >
      <div className="space-y-1">
        <h3 id="recovery-address-heading" className="type-label">
          The Way Back In
        </h3>
        <p className="text-xs text-role-secondary">
          If you are ever locked out, this is the address Equoria writes to. It stays yours until a
          new one is confirmed.
        </p>
      </div>
      {body()}
    </section>
  );
};

export default RecoveryAddressSection;
