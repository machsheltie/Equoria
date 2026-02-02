/**
 * Registration Page
 *
 * Provides user registration with form validation.
 * Uses fantasy-themed components and Zod validation.
 * Includes password strength indicator.
 */

import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Sparkles, Check, X } from 'lucide-react';
import { FantasyInput } from '../components/FantasyForm';
import FantasyButton from '../components/FantasyButton';
import {
  registerSchema,
  calculatePasswordStrength,
  type RegisterFormData,
} from '../lib/validation-schemas';
import { useRegister } from '../hooks/useAuth';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { mutate: register, isPending, error } = useRegister();

  // Form state
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
    const result = registerSchema.safeParse(formData);
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
    register(
      {
        email: result.data.email,
        username: result.data.username,
        password: result.data.password,
        firstName: result.data.firstName,
        lastName: result.data.lastName,
      },
      {
        onSuccess: () => {
          navigate('/');
        },
      }
    );
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
      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-md">
          {/* Registration Card */}
          <div className="bg-parchment parchment-texture rounded-lg border-2 border-aged-bronze shadow-xl p-6 space-y-6">
            {/* Title */}
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-gradient-to-br from-burnished-gold to-aged-bronze rounded-full border-2 border-aged-bronze flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-parchment" />
                </div>
              </div>
              <h2 className="fantasy-header text-2xl text-midnight-ink">Join the Realm</h2>
              <p className="fantasy-body text-aged-bronze text-sm">
                Create your account and begin your journey
              </p>
            </div>

            {/* API Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm text-center">
                  {error.message || 'Registration failed. Please try again.'}
                </p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name Fields (side by side) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="firstName"
                    className="fantasy-body text-sm text-midnight-ink font-medium"
                  >
                    First Name
                  </label>
                  <FantasyInput
                    id="firstName"
                    name="firstName"
                    type="text"
                    placeholder="First name"
                    value={formData.firstName}
                    onChange={handleChange}
                    autoComplete="given-name"
                  />
                  {validationErrors.firstName && (
                    <p className="text-red-600 text-xs">{validationErrors.firstName}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="lastName"
                    className="fantasy-body text-sm text-midnight-ink font-medium"
                  >
                    Last Name
                  </label>
                  <FantasyInput
                    id="lastName"
                    name="lastName"
                    type="text"
                    placeholder="Last name"
                    value={formData.lastName}
                    onChange={handleChange}
                    autoComplete="family-name"
                  />
                  {validationErrors.lastName && (
                    <p className="text-red-600 text-xs">{validationErrors.lastName}</p>
                  )}
                </div>
              </div>

              {/* Username Field */}
              <div className="space-y-1">
                <label
                  htmlFor="username"
                  className="fantasy-body text-sm text-midnight-ink font-medium"
                >
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-aged-bronze" />
                  <FantasyInput
                    id="username"
                    name="username"
                    type="text"
                    placeholder="Choose a username"
                    value={formData.username}
                    onChange={handleChange}
                    className="pl-10"
                    autoComplete="username"
                  />
                </div>
                {validationErrors.username && (
                  <p className="text-red-600 text-xs">{validationErrors.username}</p>
                )}
              </div>

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
                  <p className="text-red-600 text-xs">{validationErrors.email}</p>
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
                    placeholder="Create a password"
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
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
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
                      <RequirementCheck met={passwordRequirements.hasLowercase} label="Lowercase" />
                      <RequirementCheck met={passwordRequirements.hasUppercase} label="Uppercase" />
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
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-aged-bronze" />
                  <FantasyInput
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
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
                {isPending ? 'Creating Account...' : 'Begin Your Journey'}
              </FantasyButton>
            </form>

            {/* Login Link */}
            <div className="text-center pt-4 border-t border-aged-bronze">
              <p className="fantasy-body text-sm text-aged-bronze">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="text-burnished-gold hover:text-midnight-ink font-medium transition-colors"
                >
                  Sign In
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

export default RegisterPage;
