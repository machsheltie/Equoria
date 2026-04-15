/**
 * Login Page — Celestial Night design
 *
 * Full-bleed atmospheric background (responsive webp) with a
 * glassmorphism login card. Matches the design samples exactly.
 */

import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { loginSchema, type LoginFormData } from '../lib/validation-schemas';
import { useLogin } from '../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { usePageBackground, PageBackground } from '@/components/layout/PageBackground';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { mutate: login, isPending, error } = useLogin();
  const [formData, setFormData] = useState<LoginFormData>({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = loginSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) errors[issue.path[0] as string] = issue.message;
      });
      setValidationErrors(errors);
      return;
    }
    login(result.data, {
      onSuccess: () => {
        const from = (location.state as { from?: string })?.from ?? '/';
        navigate(from, { replace: true });
      },
    });
  };

  const bgStyle = usePageBackground({ scene: 'auth' });

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden"
      style={bgStyle}
    >
      <PageBackground scene="auth" />
      {/* Content — sits above overlay */}
      <div className="relative z-[var(--z-raised)] w-full max-w-sm px-4 flex flex-col items-center gap-8">
        {/* Title */}
        <div className="text-center select-none">
          <h1 className="fantasy-title text-5xl tracking-widest">Equoria</h1>
        </div>

        {/* Glassmorphism card */}
        <div className="glass-panel w-full px-6 py-7 space-y-4">
          {/* Card heading */}
          <div className="text-center space-y-1">
            <h2 className="fantasy-header text-xl" style={{ color: 'var(--gold-500)' }}>
              Welcome Back
            </h2>
            <p className="text-xs text-[rgb(148,163,184)]">
              Enter your credentials to continue playing
            </p>
          </div>

          {/* API error */}
          {error && (
            <p className="text-red-400 text-sm text-center">
              {error.message || 'Login failed. Please try again.'}
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
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="email"
                  className="celestial-input"
                  style={{ paddingLeft: '2.5rem' }}
                />
              </div>
              {validationErrors.email && (
                <p className="text-red-400 text-xs px-1">{validationErrors.email}</p>
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
                  placeholder="Your password"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="current-password"
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
                <p className="text-red-400 text-xs px-1">{validationErrors.password}</p>
              )}
            </div>

            <div className="text-right">
              <Link
                to="/forgot-password"
                className="text-xs text-[rgb(148,163,184)] hover:text-white transition-colors"
              >
                Forgot Your Password?
              </Link>
            </div>

            {/* Login CTA */}
            <Button type="submit" disabled={isPending} size="default" className="w-full">
              {isPending ? 'Entering…' : 'Enter'}
            </Button>
          </form>

          {/* Register */}
          <Button asChild size="default" className="w-full">
            <Link to="/register">Create an Account</Link>
          </Button>
        </div>

        {/* Version */}
        <p className="text-xs text-[rgb(100,130,165)] select-none">Version 1.0</p>
      </div>
    </div>
  );
};

export default LoginPage;
