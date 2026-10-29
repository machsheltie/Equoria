/**
 * Login Page — Celestial Night design
 *
 * Migrated to AuthLayout shell (Equoria-o5hub.16):
 * - Background, wordmark h1, glass card, and footer are owned by AuthLayout.
 * - D-08 fix: one gold primary CTA ("Enter"); "Create an Account" uses variant="secondary".
 * - Form validation and API-error display preserved exactly.
 * - Fields migrated to FormField + Input/PasswordInput (Finding 2, Equoria-o5hub.16 review).
 *
 * Authenticator-app (TOTP) sign-in and its second-factor step were removed by the
 * owner's 2026-10-29 ruling (q305); a correct password opens the session.
 */

import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router';
import { Mail, Lock } from 'lucide-react';
import { loginSchema, type LoginFormData } from '../lib/validation-schemas';
import { useLogin } from '../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { safeRedirectTarget } from '../lib/safeRedirect';
import { AuthLayout, AuthError } from '@/components/auth/AuthLayout';
import { FormField, Input, PasswordInput } from '@/components/ui/form';
import { credentialsMessage } from '@/lib/http/authErrorMessages';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { mutate: login, isPending, error } = useLogin();
  const [formData, setFormData] = useState<LoginFormData>({ email: '', password: '' });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

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
   * redirect.
   */
  const enterTheGame = () => {
    const rawFrom = (location.state as { from?: string })?.from;
    // CWE-601: validate redirect target before navigating (Equoria-rxkna).
    navigate(safeRedirectTarget(rawFrom, '/'), { replace: true });
  };

  /**
   * Equoria-nqky1: sign-up created the account but could not open its session,
   * so registration sent the player here. Say so, so she simply signs in.
   */
  const accountReady = (location.state as { accountReady?: boolean } | null)?.accountReady === true;

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
    login(result.data, { onSuccess: enterTheGame });
  };

  return (
    <AuthLayout title="Welcome Back" subtitle="Enter your credentials to continue playing">
      {/* API error — AuthError renders role="alert" with text-role-danger token.
          FRONTEND_ASYNC_STATE_DOCTRINE §4: AuthError prints `error.message`
          verbatim, so the transport error is classified here first and the raw
          server string never reaches the player. */}
      <AuthError
        error={error ? { message: credentialsMessage(error) as string } : null}
        fallbackMessage="Login failed. Please try again."
      />

      {accountReady && !error && (
        <p role="status" className="text-role-secondary" data-testid="login-account-ready">
          Your account is ready. Sign in to continue.
        </p>
      )}

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
