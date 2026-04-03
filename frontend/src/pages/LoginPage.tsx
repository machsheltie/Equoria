/**
 * Login Page — Celestial Night design
 *
 * Full-bleed atmospheric background (responsive webp) with a
 * glassmorphism login card. Matches the design samples exactly.
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { loginSchema, type LoginFormData } from '../lib/validation-schemas';
import { useLogin } from '../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { usePageBackground } from '@/components/layout/PageBackground';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
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
    login(result.data, { onSuccess: () => navigate('/') });
  };

  const bgStyle = usePageBackground({ scene: 'auth' });

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden"
      style={bgStyle}
    >
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

            {/* Forgot password */}
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

        {/* Social icons */}
        <div className="flex items-center gap-5">
          {[
            {
              label: 'Facebook',
              icon: (
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                </svg>
              ),
            },
            {
              label: 'Google',
              icon: (
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              ),
            },
            {
              label: 'Twitter',
              icon: (
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                  <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
                </svg>
              ),
            },
          ].map(({ label, icon }) => (
            <button
              key={label}
              disabled
              aria-label={`Sign in with ${label} (coming soon)`}
              title="Coming soon"
              className="w-9 h-9 rounded-full flex items-center justify-center text-[rgb(148,163,184)] opacity-50 cursor-not-allowed transition-colors"
              style={{
                background: 'rgba(10,22,40,0.6)',
                border: '1px solid rgba(37,99,235,0.3)',
              }}
            >
              {icon}
            </button>
          ))}
        </div>

        {/* Version */}
        <p className="text-xs text-[rgb(100,130,165)] select-none">Version 1.0</p>
      </div>
    </div>
  );
};

export default LoginPage;
