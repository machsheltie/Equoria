/**
 * Forgot Password Page — Celestial Night design
 *
 * Matches login/register visual style: full-bleed atmospheric
 * background with glassmorphism card. Two states: form and success.
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '../lib/validation-schemas';
import { useForgotPassword } from '../hooks/useAuth';
import { useResponsiveBackground } from '../hooks/useResponsiveBackground';
import { Button } from '@/components/ui/button';

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { mutate: forgotPassword, isPending, isSuccess, error, reset } = useForgotPassword();
  const bgImage = useResponsiveBackground();

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

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        backgroundImage: `url('${bgImage}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />

      {/* Content */}
      <div className="relative z-[var(--z-raised)] w-full max-w-sm px-4 flex flex-col items-center gap-8">
        {/* Title — must be a link per tests */}
        <div className="text-center select-none">
          <Link
            to="/"
            className="fantasy-title text-5xl tracking-widest hover:opacity-90 transition-opacity"
          >
            Equoria
          </Link>
        </div>

        {/* Glassmorphism card */}
        <div className="glass-panel w-full px-6 py-7">
          {isSuccess ? (
            /* ── Success state ─────────────────────────────────── */
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center magical-glow"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-dim) 100%)',
                  }}
                >
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
              </div>

              <h2 className="fantasy-header text-xl" style={{ color: 'var(--gold-500)' }}>
                Check Your Inbox
              </h2>

              <p className="text-sm text-[rgb(220,235,255)]">
                If an account exists with <strong className="text-white">{email}</strong>, we've
                sent instructions to reset your password.
              </p>

              <p className="text-xs text-[rgb(148,163,184)]">
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
          ) : (
            /* ── Form state ────────────────────────────────────── */
            <div className="space-y-5">
              {/* Back link */}
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs text-[rgb(148,163,184)] hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Login
              </Link>

              {/* Heading */}
              <div className="text-center space-y-1">
                <h2 className="fantasy-header text-xl" style={{ color: 'var(--gold-500)' }}>
                  Forgot Password?
                </h2>
                <p className="text-xs text-[rgb(148,163,184)]">
                  No worries! Enter your email and we'll send you reset instructions.
                </p>
              </div>

              {/* API error */}
              {error && (
                <p className="text-red-400 text-sm text-center">
                  {error.message || 'Something went wrong. Please try again.'}
                </p>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Email */}
                <div className="space-y-1">
                  <label
                    htmlFor="email"
                    className="block text-xs text-[rgb(148,163,184)] uppercase tracking-wider"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgb(100,130,165)] pointer-events-none" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={handleChange}
                      autoComplete="email"
                      className="celestial-input"
                      style={{ paddingLeft: '2.5rem' }}
                    />
                  </div>
                  {validationErrors.email && (
                    <p className="text-red-400 text-xs">{validationErrors.email}</p>
                  )}
                </div>

                <Button type="submit" disabled={isPending} className="w-full">
                  {isPending ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </form>

              {/* Sign in link */}
              <p className="text-center text-xs text-[rgb(148,163,184)] pt-1 border-t border-[rgba(30,55,100,0.5)]">
                Remember your password?{' '}
                <Link
                  to="/login"
                  className="text-[rgb(212,168,67)] hover:text-white font-medium transition-colors"
                >
                  Sign In
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-xs text-[rgb(100,130,165)] select-none">
          &copy; 2025 Equoria. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
