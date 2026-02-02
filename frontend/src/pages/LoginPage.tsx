/**
 * Login Page
 *
 * Provides user authentication with email/password.
 * Uses fantasy-themed components and Zod validation.
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, Sparkles } from 'lucide-react';
import { FantasyInput } from '../components/FantasyForm';
import FantasyButton from '../components/FantasyButton';
import { loginSchema, type LoginFormData } from '../lib/validation-schemas';
import { useLogin } from '../hooks/useAuth';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { mutate: login, isPending, error } = useLogin();

  // Form state
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear validation error when user types
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate with Zod
    const result = loginSchema.safeParse(formData);
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
    login(result.data, {
      onSuccess: () => {
        navigate('/');
      },
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-parchment parchment-texture border-b-2 border-aged-bronze shadow-lg relative">
        <div className="flex items-center justify-center p-4">
          <h1 className="fantasy-title text-3xl text-midnight-ink">Equoria</h1>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-aged-bronze via-burnished-gold to-aged-bronze" />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Login Card */}
          <div className="bg-parchment parchment-texture rounded-lg border-2 border-aged-bronze shadow-xl p-6 space-y-6">
            {/* Title */}
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-gradient-to-br from-burnished-gold to-aged-bronze rounded-full border-2 border-aged-bronze flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-parchment" />
                </div>
              </div>
              <h2 className="fantasy-header text-2xl text-midnight-ink">Welcome Back</h2>
              <p className="fantasy-body text-aged-bronze text-sm">
                Enter your credentials to access the realm
              </p>
            </div>

            {/* API Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm text-center">
                  Login failed: {error.message || 'Please try again.'}
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
                    value={formData.email}
                    onChange={handleChange}
                    className="pl-10"
                    autoComplete="email"
                  />
                </div>
                {validationErrors.email && (
                  <p className="text-red-600 text-xs mt-1">{validationErrors.email}</p>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-1">
                <label
                  htmlFor="password"
                  className="fantasy-body text-sm text-midnight-ink font-medium"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-aged-bronze" />
                  <FantasyInput
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                    className="pl-10 pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-aged-bronze hover:text-burnished-gold transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {validationErrors.password && (
                  <p className="text-red-600 text-xs mt-1">{validationErrors.password}</p>
                )}
              </div>

              {/* Forgot Password Link */}
              <div className="text-right">
                <Link
                  to="/forgot-password"
                  className="text-sm text-aged-bronze hover:text-burnished-gold transition-colors underline"
                >
                  Forgot your password?
                </Link>
              </div>

              {/* Submit Button */}
              <FantasyButton
                type="submit"
                variant="primary"
                size="large"
                className="w-full"
                disabled={isPending}
              >
                {isPending ? 'Entering the Realm...' : 'Enter the Realm'}
              </FantasyButton>
            </form>

            {/* Register Link */}
            <div className="text-center pt-4 border-t border-aged-bronze">
              <p className="fantasy-body text-sm text-aged-bronze">
                New to Equoria?{' '}
                <Link
                  to="/register"
                  className="text-burnished-gold hover:text-midnight-ink font-medium transition-colors"
                >
                  Create an Account
                </Link>
              </p>
            </div>
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

export default LoginPage;
