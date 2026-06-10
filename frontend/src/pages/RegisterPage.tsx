/**
 * Registration Page — Celestial Night design
 *
 * Migrated to AuthLayout shell (Equoria-o5hub.16):
 * - Background, wordmark h1, glass card, and footer are owned by AuthLayout.
 * - All validation logic, password strength, and RequirementCheck preserved exactly.
 * - API error uses <AuthError> (renders role="alert" with text-role-danger token).
 * - RequirementCheck uses --status-success / --text-muted tokens (D-11 compliant).
 */

import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, Check, X } from 'lucide-react';
import {
  registerSchema,
  calculatePasswordStrength,
  type RegisterFormData,
} from '../lib/validation-schemas';
import { useRegister } from '../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { FormField, Input, PasswordInput } from '@/components/ui/form';
import { AuthLayout, AuthError } from '@/components/auth/AuthLayout';

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
    dateOfBirth: '',
  });
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
      hasSpecialChar: /[@$!%*?&]/.test(p),
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
        dateOfBirth: result.data.dateOfBirth,
      },
      {
        onSuccess: () => navigate('/verify-email'),
        onError: (err) => {
          // Story 21S-9: flattened branches. Server returns one of several
          // duplicate phrasings ("already exists", "already in use",
          // "already taken"/"is taken") — treat any of them as a duplicate
          // signal, then route to the right inline field by which identifier
          // the message mentions. Non-duplicate errors fall through to the
          // top-level error banner.
          const message = (err.message ?? '').toLowerCase();
          const isDuplicate =
            message.includes('already exists') ||
            message.includes('already in use') ||
            message.includes('taken');

          if (isDuplicate && message.includes('email')) {
            setValidationErrors({ email: 'This email address is already registered.' });
          } else if (isDuplicate && message.includes('username')) {
            setValidationErrors({ username: 'This username is already taken.' });
          }
        },
      }
    );
  };

  // RequirementCheck — met: --status-success token; unmet: --text-muted token (D-11 compliant)
  const RequirementCheck = ({ met, label }: { met: boolean; label: string }) => (
    <div className="flex items-center gap-1.5 text-xs" data-testid="password-requirement-row">
      {met ? (
        <Check className="w-3 h-3 text-[var(--status-success)]" />
      ) : (
        <X className="w-3 h-3 text-[var(--text-muted)]" />
      )}
      <span className={met ? 'text-[var(--status-success)]' : 'text-[var(--text-muted)]'}>
        {label}
      </span>
    </div>
  );

  return (
    <AuthLayout title="Join the Realm" subtitle="Create your account and begin your journey">
      {/* API error — AuthError renders role="alert" with text-role-danger token */}
      <AuthError error={error} fallbackMessage="Registration failed. Please try again." />

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* First + Last name — side by side (FormField + Input, Equoria-o5hub.12) */}
        <div className="grid grid-cols-2 gap-2">
          <FormField label="First Name" htmlFor="firstName" error={validationErrors.firstName}>
            {({ id, ...ariaProps }) => (
              <Input
                id={id}
                name="firstName"
                type="text"
                placeholder="First"
                value={formData.firstName}
                onChange={handleChange}
                autoComplete="given-name"
                {...ariaProps}
              />
            )}
          </FormField>
          <FormField label="Last Name" htmlFor="lastName" error={validationErrors.lastName}>
            {({ id, ...ariaProps }) => (
              <Input
                id={id}
                name="lastName"
                type="text"
                placeholder="Last"
                value={formData.lastName}
                onChange={handleChange}
                autoComplete="family-name"
                {...ariaProps}
              />
            )}
          </FormField>
        </div>

        {/* Username */}
        <FormField label="Username" htmlFor="username" error={validationErrors.username}>
          {({ id, ...ariaProps }) => (
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--icon-accent)] pointer-events-none" />
              <Input
                id={id}
                name="username"
                type="text"
                placeholder="Choose a username"
                value={formData.username}
                onChange={handleChange}
                autoComplete="username"
                className="pl-10"
                {...ariaProps}
              />
            </div>
          )}
        </FormField>

        {/* Date of Birth — Equoria-iqzn / Equoria-9tlha: required for the
            server-authoritative COPPA age gate. */}
        <FormField label="Date of Birth" htmlFor="dateOfBirth" error={validationErrors.dateOfBirth}>
          {({ id, ...ariaProps }) => (
            <Input
              id={id}
              name="dateOfBirth"
              type="date"
              value={formData.dateOfBirth}
              onChange={handleChange}
              autoComplete="bday"
              max={new Date().toISOString().slice(0, 10)}
              {...ariaProps}
            />
          )}
        </FormField>

        {/* Email */}
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

        {/* Password — PasswordInput owns the show/hide toggle */}
        <div className="space-y-1">
          <FormField label="Password" htmlFor="password" error={validationErrors.password}>
            {({ id, ...ariaProps }) => (
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--icon-accent)] pointer-events-none z-10" />
                <PasswordInput
                  id={id}
                  name="password"
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  className="pl-10"
                  {...ariaProps}
                />
              </div>
            )}
          </FormField>

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
                <RequirementCheck
                  met={passwordRequirements.hasSpecialChar}
                  label="Special character (@$!%*?&)"
                />
              </div>
            </div>
          )}
        </div>

        {/* Confirm Password — PasswordInput owns the show/hide toggle */}
        <FormField
          label="Confirm Password"
          htmlFor="confirmPassword"
          error={validationErrors.confirmPassword}
        >
          {({ id, ...ariaProps }) => (
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--icon-accent)] pointer-events-none z-10" />
              <PasswordInput
                id={id}
                name="confirmPassword"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
                className="pl-10"
                {...ariaProps}
              />
            </div>
          )}
        </FormField>

        {/* Submit */}
        <Button type="submit" disabled={isPending} className="w-full mt-1">
          {isPending ? 'Creating Account...' : 'Begin Your Journey'}
        </Button>
      </form>

      {/* Login link */}
      <p className="text-center text-xs text-[var(--text-secondary)] pt-1 border-t border-[rgba(30,55,100,0.5)]">
        Already have an account?{' '}
        <Link
          to="/login"
          className="text-[var(--link-gold)] hover:text-white font-medium transition-colors"
        >
          Sign In
        </Link>
      </p>
    </AuthLayout>
  );
};

export default RegisterPage;
