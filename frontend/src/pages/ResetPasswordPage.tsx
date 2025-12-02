/**
 * Reset Password Page
 *
 * Allows users to set a new password using a reset token.
 * Token is extracted from URL query parameter.
 */

import React, { useState, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, CheckCircle, XCircle, Sparkles, Check, X } from 'lucide-react';
import { FantasyInput } from '../components/FantasyForm';
import FantasyButton from '../components/FantasyButton';
import {
  resetPasswordSchema,
  calculatePasswordStrength,
  type ResetPasswordFormData,
} from '../lib/validations/auth';
import { useResetPassword } from '../hooks/useAuth';

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const { mutate: resetPassword, isPending, isSuccess, error } = useResetPassword();

  // Form state
  const [formData, setFormData] = useState<ResetPasswordFormData>({
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Password strength
  const passwordStrength = useMemo(
    () => calculatePasswordStrength(formData.password),
    [formData.password]
  );

  // Password requirements status
  const passwordRequirements = useMemo(() => {
    const password = formData.password;
    return {
      minLength: password.length >= 8,
      hasLowercase: /[a-z]/.test(password),
      hasUppercase: /[A-Z]/.test(password),
      hasNumber: /[0-9]/.test(password),
    };
  }, [formData.password]);

  // Handle input change
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

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) return;

    // Validate with Zod
    const result = resetPasswordSchema.safeParse(formData);
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
    resetPassword({ token, newPassword: result.data.password });
  };

  // Requirement check component
  const RequirementCheck = ({ met, label }: { met: boolean; label: string }) => (
    <div className="flex items-center gap-2 text-xs">
      {met ? (
        <Check className="w-3 h-3 text-forest-green" />
      ) : (
        <X className="w-3 h-3 text-red-500" />
      )}
      <span className={met ? 'text-forest-green' : 'text-aged-bronze'}>{label}</span>
    </div>
  );

  // No token state
  if (!token) {
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

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="bg-parchment parchment-texture rounded-lg border-2 border-aged-bronze shadow-xl p-6 space-y-6">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-700 rounded-full border-2 border-red-300 flex items-center justify-center">
                    <XCircle className="w-10 h-10 text-parchment" />
                  </div>
                </div>
                <h2 className="fantasy-header text-2xl text-midnight-ink">Invalid Reset Link</h2>
                <p className="fantasy-body text-aged-bronze">
                  This password reset link is invalid or has expired.
                </p>
                <div className="pt-4 space-y-3">
                  <Link to="/forgot-password">
                    <FantasyButton variant="primary" className="w-full">
                      Request New Reset Link
                    </FantasyButton>
                  </Link>
                  <Link to="/login">
                    <FantasyButton variant="secondary" className="w-full">
                      Return to Login
                    </FantasyButton>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </main>

        <footer className="bg-parchment border-t border-aged-bronze p-4 text-center">
          <p className="fantasy-body text-xs text-aged-bronze">
            &copy; 2025 Equoria. All rights reserved.
          </p>
        </footer>
      </div>
    );
  }

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
            {isSuccess ? (
              // Success State
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-forest-green to-emerald-700 rounded-full border-2 border-burnished-gold flex items-center justify-center magical-glow">
                    <CheckCircle className="w-10 h-10 text-parchment" />
                  </div>
                </div>
                <h2 className="fantasy-header text-2xl text-midnight-ink">Password Reset!</h2>
                <p className="fantasy-body text-aged-bronze">
                  Your password has been successfully changed. You can now log in with your new
                  password.
                </p>
                <div className="pt-4">
                  <FantasyButton
                    variant="primary"
                    size="large"
                    className="w-full"
                    onClick={() => navigate('/login')}
                  >
                    Go to Login
                  </FantasyButton>
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
                  <h2 className="fantasy-header text-2xl text-midnight-ink">Create New Password</h2>
                  <p className="fantasy-body text-aged-bronze text-sm">
                    Choose a strong password to secure your account.
                  </p>
                </div>

                {/* API Error */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-700 text-sm text-center">
                      {error.message || 'Failed to reset password. The link may have expired.'}
                    </p>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Password Field */}
                  <div className="space-y-1">
                    <label
                      htmlFor="password"
                      className="fantasy-body text-sm text-midnight-ink font-medium"
                    >
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-aged-bronze" />
                      <FantasyInput
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Create a new password"
                        value={formData.password}
                        onChange={handleChange}
                        className="pl-10 pr-10"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-aged-bronze hover:text-burnished-gold transition-colors"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    {validationErrors.password && (
                      <p className="text-red-600 text-xs">{validationErrors.password}</p>
                    )}

                    {/* Password Strength Indicator */}
                    {formData.password && (
                      <div className="space-y-2 pt-2">
                        {/* Strength Bar */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full transition-all duration-300 rounded-full"
                              style={{
                                width: `${(passwordStrength.score / 4) * 100}%`,
                                backgroundColor: passwordStrength.color,
                              }}
                            />
                          </div>
                          <span
                            className="text-xs font-medium capitalize"
                            style={{ color: passwordStrength.color }}
                          >
                            {passwordStrength.label}
                          </span>
                        </div>

                        {/* Requirements Checklist */}
                        <div className="grid grid-cols-2 gap-1">
                          <RequirementCheck
                            met={passwordRequirements.minLength}
                            label="8+ characters"
                          />
                          <RequirementCheck
                            met={passwordRequirements.hasLowercase}
                            label="Lowercase"
                          />
                          <RequirementCheck
                            met={passwordRequirements.hasUppercase}
                            label="Uppercase"
                          />
                          <RequirementCheck met={passwordRequirements.hasNumber} label="Number" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password Field */}
                  <div className="space-y-1">
                    <label
                      htmlFor="confirmPassword"
                      className="fantasy-body text-sm text-midnight-ink font-medium"
                    >
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-aged-bronze" />
                      <FantasyInput
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Confirm your new password"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className="pl-10 pr-10"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-aged-bronze hover:text-burnished-gold transition-colors"
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    {validationErrors.confirmPassword && (
                      <p className="text-red-600 text-xs">{validationErrors.confirmPassword}</p>
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
                    {isPending ? 'Resetting...' : 'Reset Password'}
                  </FantasyButton>
                </form>

                {/* Links */}
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

export default ResetPasswordPage;
