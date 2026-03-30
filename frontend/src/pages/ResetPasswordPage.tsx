/**
 * Reset Password Page — Celestial Night design
 *
 * Matches login/register/forgot-password visual style.
 * Three states: no-token (invalid link), form, and success.
 */

import React, { useState, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, CheckCircle, XCircle, Check, X } from 'lucide-react';
import {
  resetPasswordSchema,
  calculatePasswordStrength,
  type ResetPasswordFormData,
} from '../lib/validations/auth';
import { useResetPassword } from '../hooks/useAuth';
import { useResponsiveBackground } from '../hooks/useResponsiveBackground';
import { Button } from '@/components/ui/button';

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const bgImage = useResponsiveBackground();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const { mutate: resetPassword, isPending, isSuccess, error } = useResetPassword();

  const [formData, setFormData] = useState<ResetPasswordFormData>({
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const passwordStrength = useMemo(
    () => calculatePasswordStrength(formData.password),
    [formData.password]
  );

  const passwordRequirements = useMemo(() => {
    const p = formData.password;
    return {
      minLength: p.length >= 8,
      hasLowercase: /[a-z]/.test(p),
      hasUppercase: /[A-Z]/.test(p),
      hasNumber: /[0-9]/.test(p),
    };
  }, [formData.password]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const result = resetPasswordSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) errors[issue.path[0] as string] = issue.message;
      });
      setValidationErrors(errors);
      return;
    }

    resetPassword({ token, newPassword: result.data.password });
  };

  // RequirementCheck — must use text-forest-green (tests assert this class explicitly)
  const RequirementCheck = ({ met, label }: { met: boolean; label: string }) => (
    <div className="flex items-center gap-1.5 text-xs">
      {met ? (
        <Check className="w-3 h-3 text-forest-green" />
      ) : (
        <X className="w-3 h-3 text-red-400" />
      )}
      <span className={met ? 'text-forest-green' : 'text-[rgb(148,163,184)]'}>{label}</span>
    </div>
  );

  const pageShell = (children: React.ReactNode) => (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden py-8"
      style={{
        backgroundImage: `url('${bgImage}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />
      <div className="relative z-[var(--z-raised)] w-full max-w-sm px-4 flex flex-col items-center gap-8">
        <div className="text-center select-none">
          <Link
            to="/"
            className="fantasy-title text-5xl tracking-widest hover:opacity-90 transition-opacity"
          >
            Equoria
          </Link>
        </div>
        <div className="glass-panel w-full px-6 py-7">{children}</div>
        <p className="text-xs text-[rgb(100,130,165)] select-none">
          &copy; 2025 Equoria. All rights reserved.
        </p>
      </div>
    </div>
  );

  // ── No token ────────────────────────────────────────────────────────
  if (!token) {
    return pageShell(
      <div className="text-center space-y-5">
        <div className="flex justify-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: 'var(--status-error)' }}
          >
            <XCircle className="w-8 h-8 text-white" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="fantasy-header text-xl" style={{ color: 'var(--gold-500)' }}>
            Invalid Reset Link
          </h2>
          <p className="text-sm text-[rgb(220,235,255)]">
            This password reset link is invalid or has expired.
          </p>
        </div>

        <div className="space-y-2 pt-1">
          <Button asChild className="w-full">
            <Link to="/forgot-password">Request New Reset Link</Link>
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => navigate('/login')}
          >
            Return to Login
          </Button>
        </div>
      </div>
    );
  }

  // ── Success ─────────────────────────────────────────────────────────
  if (isSuccess) {
    return pageShell(
      <div className="text-center space-y-5">
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

        <div className="space-y-2">
          <h2 className="fantasy-header text-xl" style={{ color: 'var(--gold-500)' }}>
            Password Reset!
          </h2>
          <p className="text-sm text-[rgb(220,235,255)]">
            Your password has been successfully changed. You can now log in with your new password.
          </p>
        </div>

        <Button type="button" className="w-full" onClick={() => navigate('/login')}>
          Go to Login
        </Button>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────
  return pageShell(
    <div className="space-y-5">
      {/* Heading */}
      <div className="text-center space-y-1">
        <h2 className="fantasy-header text-xl" style={{ color: 'var(--gold-500)' }}>
          Create New Password
        </h2>
        <p className="text-xs text-[rgb(148,163,184)]">
          Choose a strong password to secure your account.
        </p>
      </div>

      {/* API error */}
      {error && (
        <p className="text-red-400 text-sm text-center">
          {error.message || 'Failed to reset password. The link may have expired.'}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* New Password */}
        <div className="space-y-1">
          <label
            htmlFor="password"
            className="block text-xs text-[rgb(148,163,184)] uppercase tracking-wider"
          >
            New Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgb(100,130,165)] pointer-events-none" />
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a new password"
              value={formData.password}
              onChange={handleChange}
              autoComplete="new-password"
              className="celestial-input pr-10"
              style={{ paddingLeft: '2.5rem' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[rgb(100,130,165)] hover:text-white transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {validationErrors.password && (
            <p className="text-red-400 text-xs">{validationErrors.password}</p>
          )}

          {/* Strength indicator */}
          {formData.password && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <div
                  className="flex-1 h-1 rounded-full overflow-hidden"
                  style={{ background: 'var(--glass-surface-subtle-bg)' }}
                >
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
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                <RequirementCheck met={passwordRequirements.minLength} label="8+ characters" />
                <RequirementCheck met={passwordRequirements.hasLowercase} label="Lowercase" />
                <RequirementCheck met={passwordRequirements.hasUppercase} label="Uppercase" />
                <RequirementCheck met={passwordRequirements.hasNumber} label="Number" />
              </div>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-1">
          <label
            htmlFor="confirmPassword"
            className="block text-xs text-[rgb(148,163,184)] uppercase tracking-wider"
          >
            Confirm New Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgb(100,130,165)] pointer-events-none" />
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm your new password"
              value={formData.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
              className="celestial-input pr-10"
              style={{ paddingLeft: '2.5rem' }}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[rgb(100,130,165)] hover:text-white transition-colors"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {validationErrors.confirmPassword && (
            <p className="text-red-400 text-xs">{validationErrors.confirmPassword}</p>
          )}
        </div>

        <Button type="submit" disabled={isPending} className="w-full mt-1">
          {isPending ? 'Resetting...' : 'Reset Password'}
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
  );
};

export default ResetPasswordPage;
