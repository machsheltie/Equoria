/**
 * Login Page — Celestial Night design
 *
 * Migrated to AuthLayout shell (Equoria-o5hub.16):
 * - Background, wordmark h1, glass card, and footer are owned by AuthLayout.
 * - D-08 fix: one gold primary CTA ("Enter"); "Create an Account" uses variant="secondary".
 * - Form validation and API-error display preserved exactly.
 * - Fields migrated to FormField + Input/PasswordInput (Finding 2, Equoria-o5hub.16 review).
 *
 * Finding 7 (Equoria-6p398.7) — second factor before entering the game:
 * `POST /auth/login` answers an MFA-enrolled account with a short-lived
 * challenge and NO session (authController.login). The page branches on that
 * union and swaps the credentials form for the second-factor step IN PLACE,
 * inside the same auth card: one arrival, two moments, no dialog, no new shell,
 * no navigation until a real session exists. The challenge token lives in
 * component state only — never storage, a URL, or a log — and is dropped on the
 * way back to the credentials form, on a lockout, and on every new attempt.
 */

import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';
import { loginSchema, type LoginFormData } from '../lib/validation-schemas';
import { useLogin, useMfaChallenge } from '../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { safeRedirectTarget } from '../lib/safeRedirect';
import { AuthLayout, AuthError } from '@/components/auth/AuthLayout';
import { SecondFactorForm, type SecondFactorSubmission } from '@/components/auth/SecondFactorForm';
import { FormField, Input, PasswordInput } from '@/components/ui/form';
import { credentialsMessage, secondFactorMessage } from '@/lib/http/authErrorMessages';
import type { MfaChallengeCredentials } from '@/lib/api-client';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { mutate: login, isPending, error } = useLogin();
  const {
    mutate: submitSecondFactor,
    isPending: isVerifying,
    error: secondFactorError,
    reset: resetSecondFactor,
  } = useMfaChallenge();
  const [formData, setFormData] = useState<LoginFormData>({ email: '', password: '' });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  /** Transient only. Never persisted, never rendered, never logged. */
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null);
  /** Set when a lockout revoked the challenge and we sent the player back. */
  const [challengeRevokedMessage, setChallengeRevokedMessage] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  /**
   * The single session-finalization path. Cookies are already set by the
   * server, the user-bound CSRF token was seeded by the API layer, and the
   * profile query was invalidated by the hook — all that is left is the safe
   * redirect. Ordinary login and a completed second factor both land here.
   */
  const enterTheGame = () => {
    const rawFrom = (location.state as { from?: string })?.from;
    // CWE-601: validate redirect target before navigating (Equoria-rxkna).
    navigate(safeRedirectTarget(rawFrom, '/'), { replace: true });
  };

  /** Drop any challenge in flight and return to the credentials form. */
  const returnToCredentials = (revokedMessage: string | null = null) => {
    setMfaChallengeToken(null);
    setChallengeRevokedMessage(revokedMessage);
    resetSecondFactor();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;
    const result = loginSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) errors[issue.path[0] as string] = issue.message;
      });
      setValidationErrors(errors);
      return;
    }
    // A new attempt always starts clean — a challenge issued for a previous
    // account must never be carried into this one.
    setMfaChallengeToken(null);
    setChallengeRevokedMessage(null);
    resetSecondFactor();

    login(result.data, {
      onSuccess: (outcome) => {
        if (outcome.status === 'mfa_required') {
          // Explicit branch: a challenge is not a session. Stay on the login
          // surface, hold the token in memory, and ask for the second factor.
          setMfaChallengeToken(outcome.mfaChallengeToken);
          return;
        }
        enterTheGame();
      },
    });
  };

  const handleSecondFactor = (submission: SecondFactorSubmission) => {
    if (!mfaChallengeToken || isVerifying) return;
    // Explicit branch rather than a spread cast: the endpoint takes a TOTP or a
    // recovery code, never both, and the union must stay provable.
    const credentials: MfaChallengeCredentials =
      'token' in submission
        ? { mfaChallengeToken, token: submission.token }
        : { mfaChallengeToken, recoveryCode: submission.recoveryCode };

    submitSecondFactor(credentials, {
      onSuccess: enterTheGame,
      onError: (challengeError) => {
        // 429 is the backend's lockout: it says the challenge has been revoked
        // and the player must log in again (mfaLockoutService, Equoria-kg7i2).
        // Honour that instead of leaving a dead form up.
        if (challengeError?.statusCode === 429) {
          returnToCredentials('Too many attempts. Wait a few minutes, then sign in again.');
        }
      },
    });
  };

  if (mfaChallengeToken) {
    return (
      <AuthLayout title="One More Key" subtitle="Your stable is expecting the code you carry.">
        <SecondFactorForm
          onSubmit={handleSecondFactor}
          isPending={isVerifying}
          errorMessage={secondFactorMessage(secondFactorError)}
          onCancel={() => returnToCredentials()}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Welcome Back" subtitle="Enter your credentials to continue playing">
      {/* API error — AuthError renders role="alert" with text-role-danger token.
          FRONTEND_ASYNC_STATE_DOCTRINE §4: AuthError prints `error.message`
          verbatim, so the transport error is classified here first and the raw
          server string never reaches the player. */}
      <AuthError
        error={
          challengeRevokedMessage
            ? { message: challengeRevokedMessage }
            : error
              ? { message: credentialsMessage(error) as string }
              : null
        }
        fallbackMessage="Login failed. Please try again."
      />

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Email — FormField + Input (Finding 2 migration) */}
        <FormField label="Email Address" htmlFor="email" error={validationErrors.email}>
          {({ id, ...ariaProps }) => (
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--icon-accent)] pointer-events-none" />
              <Input
                id={id}
                name="email"
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
                className="pl-10"
                {...ariaProps}
              />
            </div>
          )}
        </FormField>

        {/* Password — FormField + PasswordInput (Finding 2 migration) */}
        <FormField label="Password" htmlFor="password" error={validationErrors.password}>
          {({ id, ...ariaProps }) => (
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--icon-accent)] pointer-events-none" />
              <PasswordInput
                id={id}
                name="password"
                placeholder="Your password"
                value={formData.password}
                onChange={handleChange}
                autoComplete="current-password"
                className="pl-10"
                {...ariaProps}
              />
            </div>
          )}
        </FormField>

        <div className="text-right">
          <Link
            to="/forgot-password"
            className="text-xs text-[var(--text-secondary)] hover:text-white transition-colors"
          >
            Forgot Your Password?
          </Link>
        </div>

        {/* Primary CTA — D-08: one gold primary per surface */}
        <Button type="submit" disabled={isPending} size="default" className="w-full">
          {isPending ? 'Entering…' : 'Enter'}
        </Button>
      </form>

      {/* Secondary CTA — D-08: register link is secondary, not a competing gold primary */}
      <Button asChild variant="secondary" size="default" className="w-full">
        <Link to="/register">Create an Account</Link>
      </Button>
    </AuthLayout>
  );
};

export default LoginPage;
