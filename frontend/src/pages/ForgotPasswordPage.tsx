/**
 * Forgot Password Page
 *
 * Allows users to request a password reset email.
 * Uses fantasy-themed components.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle, Sparkles } from 'lucide-react';
import { FantasyInput } from '../components/FantasyForm';
import FantasyButton from '../components/FantasyButton';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '../lib/validations/auth';
import { useForgotPassword } from '../hooks/useAuth';

const ForgotPasswordPage: React.FC = () => {
  const { mutate: forgotPassword, isPending, isSuccess, error, reset } = useForgotPassword();

  // Form state
  const [email, setEmail] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (validationErrors.email) {
      setValidationErrors({});
    }
    // Reset mutation state when user starts typing again
    if (isSuccess || error) {
      reset();
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate with Zod
    const formData: ForgotPasswordFormData = { email };
    const result = forgotPasswordSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          errors[issue.path[0] as string] = issue.message;
        }
      });
      setValidationErrors(errors);
      return;
    }

    // Submit to API
    forgotPassword(result.data.email);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-parchment parchment-texture border-b-2 border-aged-bronze shadow-lg relative">
        <div className="flex items-center justify-center p-4">
          <Link
            to="/"
            className="fantasy-title text-3xl text-midnight-ink hover:text-burnished-gold transition-colors"
          >
            Equoria
          </Link>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-aged-bronze via-burnished-gold to-aged-bronze" />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-parchment parchment-texture rounded-lg border-2 border-aged-bronze shadow-xl p-6 space-y-6">
            {/* Back link */}
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-aged-bronze hover:text-burnished-gold transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>

            {isSuccess ? (
              // Success State
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-forest-green to-emerald-700 rounded-full border-2 border-burnished-gold flex items-center justify-center magical-glow">
                    <CheckCircle className="w-10 h-10 text-parchment" />
                  </div>
                </div>
                <h2 className="fantasy-header text-2xl text-midnight-ink">Check Your Inbox</h2>
                <p className="fantasy-body text-aged-bronze">
                  If an account exists with <strong>{email}</strong>, we've sent instructions to
                  reset your password.
                </p>
                <p className="fantasy-body text-sm text-aged-bronze">
                  The link will expire in 1 hour. Check your spam folder if you don't see it.
                </p>
                <div className="pt-4 space-y-3">
                  <FantasyButton
                    variant="secondary"
                    className="w-full"
                    onClick={() => {
                      reset();
                      setEmail('');
                    }}
                  >
                    Try Another Email
                  </FantasyButton>
                  <Link to="/login">
                    <FantasyButton variant="primary" className="w-full">
                      Return to Login
                    </FantasyButton>
                  </Link>
                </div>
              </div>
            ) : (
              // Form State
              <>
                {/* Title */}
                <div className="text-center space-y-2">
                  <div className="flex justify-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-burnished-gold to-aged-bronze rounded-full border-2 border-aged-bronze flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-parchment" />
                    </div>
                  </div>
                  <h2 className="fantasy-header text-2xl text-midnight-ink">Forgot Password?</h2>
                  <p className="fantasy-body text-aged-bronze text-sm">
                    No worries! Enter your email and we'll send you reset instructions.
                  </p>
                </div>

                {/* API Error */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-700 text-sm text-center">
                      {error.message || 'Something went wrong. Please try again.'}
                    </p>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Email Field */}
                  <div className="space-y-1">
                    <label
                      htmlFor="email"
                      className="fantasy-body text-sm text-midnight-ink font-medium"
                    >
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-aged-bronze" />
                      <FantasyInput
                        id="email"
                        name="email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={handleChange}
                        className="pl-10"
                        autoComplete="email"
                      />
                    </div>
                    {validationErrors.email && (
                      <p className="text-red-600 text-xs">{validationErrors.email}</p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <FantasyButton
                    type="submit"
                    variant="primary"
                    size="large"
                    className="w-full"
                    disabled={isPending}
                  >
                    {isPending ? 'Sending...' : 'Send Reset Link'}
                  </FantasyButton>
                </form>

                {/* Register Link */}
                <div className="text-center pt-4 border-t border-aged-bronze">
                  <p className="fantasy-body text-sm text-aged-bronze">
                    Remember your password?{' '}
                    <Link
                      to="/login"
                      className="text-burnished-gold hover:text-midnight-ink font-medium transition-colors"
                    >
                      Sign In
                    </Link>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-parchment border-t border-aged-bronze p-4 text-center">
        <p className="fantasy-body text-xs text-aged-bronze">
          &copy; 2025 Equoria. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default ForgotPasswordPage;
