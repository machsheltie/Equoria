/**
 * Authentication Layout Component
 *
 * Shared layout for authentication pages (login, register, forgot password, etc.)
 * Provides consistent header, footer, and card styling.
 *
 * Story 1.1: User Registration — Task 2 Component Extraction
 * Equoria-o5hub.16: Auth pilot migration — owns background painting for all auth pages.
 */

import React, { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { usePageBackground, PageBackground } from '@/components/layout/PageBackground';

// =============================================================================
// Types
// =============================================================================

export interface AuthLayoutProps {
  /** Page content */
  children: ReactNode;
  /**
   * Title displayed in the card header via AuthCardHeader.
   * Omit when the page manages its own headings (e.g. multi-state pages like
   * ForgotPassword / ResetPassword / VerifyEmail that switch h2 text by state).
   */
  title?: string;
  /**
   * Subtitle displayed below the title via AuthCardHeader.
   * Only rendered when title is also provided.
   */
  subtitle?: string;
  /** Optional icon component to override the default Sparkles icon */
  icon?: ReactNode;
  /** Optional className for the card container */
  cardClassName?: string;
  /** Optional test ID */
  testId?: string;
}

export interface AuthCardHeaderProps {
  title: string;
  subtitle: string;
  icon?: ReactNode;
}

export interface AuthErrorProps {
  /** Any error-like object with a message property, or a native Error, or null. */
  error: { message: string } | null;
  fallbackMessage?: string;
}

export interface AuthFooterLinkProps {
  prompt: string;
  linkText: string;
  linkTo: string;
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Authentication page header with logo wordmark.
 * Renders the Equoria h1 wordmark. AuthLayout renders this once — pages must NOT
 * render their own wordmark h1 (DECISIONS.md §2, Equoria-o5hub.16).
 * text-5xl matches the pages' existing design; font-display is the correct brand token.
 */
export const AuthHeader: React.FC = () => (
  <div className="text-center select-none">
    <h1
      className="fantasy-title text-5xl tracking-widest"
      style={{ fontFamily: 'var(--font-display)' }}
    >
      Equoria
    </h1>
  </div>
);

/**
 * Authentication page footer
 */
export const AuthFooter: React.FC = () => (
  <footer className="p-4 text-center border-t" style={{ borderColor: 'var(--border-muted)' }}>
    <p className="text-xs text-[var(--text-muted)]">
      &copy; {new Date().getFullYear()} Equoria. All rights reserved.
    </p>
  </footer>
);

/**
 * Card header with icon, title, and subtitle
 */
export const AuthCardHeader: React.FC<AuthCardHeaderProps> = ({ title, subtitle, icon }) => (
  <div className="text-center space-y-2">
    <div className="flex justify-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center magical-glow"
        style={{
          background: 'linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-dim) 100%)',
        }}
      >
        {icon || <Sparkles className="w-8 h-8 text-[var(--text-primary)]" aria-hidden="true" />}
      </div>
    </div>
    <h2 className="fantasy-header text-2xl text-[var(--gold-primary)]">{title}</h2>
    <p className="text-sm text-[var(--text-secondary)]">{subtitle}</p>
  </div>
);

/**
 * API error display box.
 * Uses --role-danger-* tokens per DECISIONS.md §7 (Equoria-o5hub.16 token migration).
 * role="alert" enables accessible querying via screen.getByRole('alert').
 */
export const AuthError: React.FC<AuthErrorProps> = ({
  error,
  fallbackMessage = 'An error occurred. Please try again.',
}) => {
  if (!error) return null;

  return (
    <div
      className="rounded-lg p-3"
      style={{
        background: 'var(--badge-danger-bg, rgba(239,68,68,0.1))',
        border: '1px solid var(--role-danger-border, rgba(239,68,68,0.3))',
      }}
      role="alert"
    >
      <p className="text-role-danger text-sm text-center">{error.message || fallbackMessage}</p>
    </div>
  );
};

/**
 * Footer link section (e.g., "Already have an account? Sign In")
 * Uses react-router Link for SPA navigation.
 */
export const AuthFooterLink: React.FC<AuthFooterLinkProps> = ({ prompt, linkText, linkTo }) => {
  return (
    <div className="text-center pt-4 border-t" style={{ borderColor: 'var(--border-muted)' }}>
      <p className="text-sm text-[var(--text-secondary)]">
        {prompt}{' '}
        <Link
          to={linkTo}
          className="text-[var(--gold-primary)] hover:text-[var(--text-primary)] font-medium transition-colors"
        >
          {linkText}
        </Link>
      </p>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

/**
 * Authentication Layout
 *
 * Provides consistent structure for all auth pages:
 * - Header with Equoria logo
 * - Centered card with icon, title, subtitle
 * - Footer with copyright
 *
 * @example
 * ```tsx
 * <AuthLayout title="Welcome Back" subtitle="Sign in to continue">
 *   <form onSubmit={handleSubmit}>
 *     ...form fields...
 *   </form>
 * </AuthLayout>
 * ```
 */
export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  subtitle,
  icon,
  cardClassName = '',
  testId = 'auth-layout',
}) => {
  // Background painting — AuthLayout owns the background for all auth pages.
  // usePageBackground on the root div satisfies the iOS Safari fixed-attachment
  // workaround; <PageBackground> renders the fixed layered overlay behind content.
  // Pages must NOT call usePageBackground or render <PageBackground> themselves.
  const bgStyle = usePageBackground({ scene: 'auth' });

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden py-8"
      style={bgStyle}
      data-testid={testId}
    >
      <PageBackground scene="auth" />

      {/* Content sits above the fixed overlay */}
      <div className="relative z-[var(--z-raised)] w-full max-w-sm px-4 flex flex-col items-center gap-8">
        <AuthHeader />

        {/* Auth Card — max-w-sm matches all five auth pages (Equoria-o5hub.16) */}
        <div className={`glass-panel w-full px-6 py-7 space-y-4 ${cardClassName}`}>
          {/* AuthCardHeader only when title provided; multi-state pages omit it and render their own h2 */}
          {title && <AuthCardHeader title={title} subtitle={subtitle ?? ''} icon={icon} />}
          {children}
        </div>

        <AuthFooter />
      </div>
    </div>
  );
};

// =============================================================================
// Exports
// =============================================================================

export default AuthLayout;
