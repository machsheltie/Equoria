/**
 * Forgot Password Page — Celestial Night design
 *
 * Migrated to AuthLayout shell (Equoria-o5hub.16):
 * - Background, wordmark h1, glass card, and footer owned by AuthLayout.
 * - Multi-state page (form / success): manages its own card headings as children.
 * - Raw rgb() colour literals replaced with CSS variable tokens.
 * - Fields migrated to FormField + Input (Equoria-o5hub.12); API error uses
 *   text-role-danger with role="alert".
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '../lib/validation-schemas';
import { useForgotPassword } from '../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form';
import { AuthLayout } from '@/components/auth/AuthLayout';

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { mutate: forgotPassword, isPending, isSuccess, error, reset } = useForgotPassword();
  const [email, setEmail] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (validationErrors.email) setValidationErrors({});
    if (isSuccess || error) reset();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData: ForgotPasswordFormData = { email };
    const result = forgotPasswordSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) errors[issue.path[0] as string] = issue.message;
      });
      setValidationErrors(errors);
      return;
    }
    forgotPassword(result.data.email);
  };

  if (isSuccess) {
    /* ── Success state ─────────────────────────────────── */
    return (
      <AuthLayout>
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center magical-glow"
              style={{
                background: 'linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-dim) 100%)',
              }}
            >
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
          </div>

          <h2 className="fantasy-header text-xl" style={{ color: 'var(--gold-500)' }}>
            Check Your Inbox
          </h2>

          <p className="text-sm text-[var(--text-primary)]">
            If an account exists with <strong className="text-white">{email}</strong>, we've sent
            instructions to reset your password.
          </p>

          <p className="text-xs text-[var(--text-muted)]">
            The link will expire in 1 hour. Check your spam folder if you don't see it.
          </p>

          <div className="space-y-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => {
                reset();
                setEmail('');
              }}
            >
              Try Another Email
            </Button>
            <Button type="button" className="w-full" onClick={() => navigate('/login')}>
              Return to Login
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  /* ── Form state ────────────────────────────────────── */
  return (
    <AuthLayout>
      <div className="space-y-5">
        {/* Back link */}
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Login
        </Link>

        {/* Heading */}
        <div className="text-center space-y-1">
          <h2 className="fantasy-header text-xl" style={{ color: 'var(--gold-500)' }}>
            Forgot Password?
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            No worries! Enter your email and we'll send you reset instructions.
          </p>
        </div>

        {/* API error */}
        {error && (
          <p className="text-role-danger text-sm text-center" role="alert">
            {error.message || 'Something went wrong. Please try again.'}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Email — FormField + Input (Equoria-o5hub.12) */}
          <FormField label="Email Address" htmlFor="email" error={validationErrors.email}>
            {({ id, ...ariaProps }) => (
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--icon-accent)] pointer-events-none" />
                <Input
                  id={id}
                  name="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={handleChange}
                  autoComplete="email"
                  className="pl-10"
                  {...ariaProps}
                />
              </div>
            )}
          </FormField>

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? 'Sending...' : 'Send Reset Link'}
          </Button>
        </form>

        {/* Sign in link */}
        <p className="text-center text-xs text-[var(--text-muted)] pt-1 border-t border-[rgba(30,55,100,0.5)]">
          Remember your password?{' '}
          <Link
            to="/login"
            className="text-[var(--link-gold)] hover:text-white font-medium transition-colors"
          >
            Sign In
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
