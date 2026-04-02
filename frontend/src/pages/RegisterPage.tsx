/**
 * Registration Page — Celestial Night design
 *
 * Full-bleed atmospheric background matching the login page.
 * Glassmorphism card with all required registration fields.
 * Preserves all a11y attributes and test expectations.
 */

import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Check, X } from 'lucide-react';
import {
  registerSchema,
  calculatePasswordStrength,
  type RegisterFormData,
} from '../lib/validation-schemas';
import { useRegister } from '../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { PageBackground } from '@/components/layout/PageBackground';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { mutate: register, isPending, error } = useRegister();
  const [formData, setFormData] = useState<RegisterFormData>({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
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
    const result = registerSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) errors[issue.path[0] as string] = issue.message;
      });
      setValidationErrors(errors);
      return;
    }
    register(
      {
        email: result.data.email,
        username: result.data.username,
        password: result.data.password,
        firstName: result.data.firstName,
        lastName: result.data.lastName,
      },
      { onSuccess: () => navigate('/') }
    );
  };

  const RequirementCheck = ({ met, label }: { met: boolean; label: string }) => (
    <div className="flex items-center gap-1.5 text-xs">
      {met ? (
        <Check className="w-3 h-3 text-[rgb(37,99,235)]" />
      ) : (
        <X className="w-3 h-3 text-red-400" />
      )}
      <span className={met ? 'text-[rgb(37,99,235)]' : 'text-[rgb(148,163,184)]'}>{label}</span>
    </div>
  );

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden py-8">
      <PageBackground scene="auth" />

      {/* Content */}
      <div className="relative z-[var(--z-raised)] w-full max-w-sm px-4 flex flex-col items-center gap-6">
        {/* Title — h1 required by a11y tests */}
        <div className="text-center select-none">
          <h1 className="fantasy-title text-5xl tracking-widest">Equoria</h1>
        </div>

        {/* Glassmorphism card */}
        <div className="glass-panel w-full px-6 py-6 space-y-4">
          {/* Card heading — h2 required by a11y tests */}
          <div className="text-center space-y-1">
            <h2 className="fantasy-header text-xl" style={{ color: 'var(--gold-500)' }}>
              Join the Realm
            </h2>
            <p className="text-xs text-[rgb(148,163,184)]">
              Create your account and begin your journey
            </p>
          </div>

          {/* API error */}
          {error && (
            <p className="text-red-400 text-sm text-center">
              {error.message || 'Registration failed. Please try again.'}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* First + Last name — side by side */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label
                  htmlFor="firstName"
                  className="block text-xs text-[rgb(148,163,184)] uppercase tracking-wider"
                >
                  First Name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  placeholder="First"
                  value={formData.firstName}
                  onChange={handleChange}
                  autoComplete="given-name"
                  className="celestial-input"
                  style={{ paddingLeft: '0.875rem', borderRadius: '0.5rem' }}
                />
                {validationErrors.firstName && (
                  <p className="text-red-400 text-xs">{validationErrors.firstName}</p>
                )}
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="lastName"
                  className="block text-xs text-[rgb(148,163,184)] uppercase tracking-wider"
                >
                  Last Name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  placeholder="Last"
                  value={formData.lastName}
                  onChange={handleChange}
                  autoComplete="family-name"
                  className="celestial-input"
                  style={{ paddingLeft: '0.875rem', borderRadius: '0.5rem' }}
                />
                {validationErrors.lastName && (
                  <p className="text-red-400 text-xs">{validationErrors.lastName}</p>
                )}
              </div>
            </div>

            {/* Username */}
            <div className="space-y-1">
              <label
                htmlFor="username"
                className="block text-xs text-[rgb(148,163,184)] uppercase tracking-wider"
              >
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgb(100,130,165)] pointer-events-none" />
                <input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="Choose a username"
                  value={formData.username}
                  onChange={handleChange}
                  autoComplete="username"
                  className="celestial-input"
                  style={{ paddingLeft: '2.5rem' }}
                />
              </div>
              {validationErrors.username && (
                <p className="text-red-400 text-xs">{validationErrors.username}</p>
              )}
            </div>

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
                  value={formData.email}
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

            {/* Password */}
            <div className="space-y-1">
              <label
                htmlFor="password"
                className="block text-xs text-[rgb(148,163,184)] uppercase tracking-wider"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgb(100,130,165)] pointer-events-none" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a password"
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

              {/* Password strength indicator */}
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
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgb(100,130,165)] pointer-events-none" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
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
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {validationErrors.confirmPassword && (
                <p className="text-red-400 text-xs">{validationErrors.confirmPassword}</p>
              )}
            </div>

            {/* Submit */}
            <Button type="submit" disabled={isPending} className="w-full mt-1">
              {isPending ? 'Creating Account...' : 'Begin Your Journey'}
            </Button>
          </form>

          {/* Login link */}
          <p className="text-center text-xs text-[rgb(148,163,184)] pt-1 border-t border-[rgba(30,55,100,0.5)]">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-[rgb(212,168,67)] hover:text-white font-medium transition-colors"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
