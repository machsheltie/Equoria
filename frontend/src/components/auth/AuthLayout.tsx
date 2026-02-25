/**
 * Authentication Layout Component
 *
 * Shared layout for authentication pages (login, register, forgot password, etc.)
 * Provides consistent header, footer, and card styling.
 *
 * Story 1.1: User Registration - Task 2 Component Extraction
 */

import React, { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface AuthLayoutProps {
  /** Page content */
  children: ReactNode;
  /** Title displayed in the card header */
  title: string;
  /** Subtitle displayed below the title */
  subtitle: string;
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
  error: Error | null;
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
 * Authentication page header with logo
 */
export const AuthHeader: React.FC = () => (
  <header
    className="border-b relative"
    style={{ background: 'var(--glass-surface-heavy-bg)', borderColor: 'var(--border-default)' }}
  >
    <div className="flex items-center justify-center p-4">
      <h1 className="fantasy-title text-3xl">Equoria</h1>
    </div>
  </header>
);

/**
 * Authentication page footer
 */
export const AuthFooter: React.FC = () => (
  <footer className="p-4 text-center border-t" style={{ borderColor: 'var(--border-muted)' }}>
    <p className="text-xs text-[rgb(100,130,165)]">
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
          background:
            'linear-gradient(135deg, var(--electric-blue-500) 0%, var(--electric-blue-700) 100%)',
        }}
      >
        {icon || <Sparkles className="w-8 h-8 text-white" aria-hidden="true" />}
      </div>
    </div>
    <h2 className="fantasy-header text-2xl text-[rgb(212,168,67)]">{title}</h2>
    <p className="text-sm text-[rgb(148,163,184)]">{subtitle}</p>
  </div>
);

/**
 * API error display box
 */
export const AuthError: React.FC<AuthErrorProps> = ({
  error,
  fallbackMessage = 'An error occurred. Please try again.',
}) => {
  if (!error) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-3" role="alert">
      <p className="text-red-700 text-sm text-center">{error.message || fallbackMessage}</p>
    </div>
  );
};

/**
 * Footer link section (e.g., "Already have an account? Sign In")
 */
export const AuthFooterLink: React.FC<AuthFooterLinkProps> = ({ prompt, linkText, linkTo }) => {
  return (
    <div className="text-center pt-4 border-t" style={{ borderColor: 'var(--border-muted)' }}>
      <p className="text-sm text-[rgb(148,163,184)]">
        {prompt}{' '}
        <a
          href={linkTo}
          className="text-[rgb(212,168,67)] hover:text-white font-medium transition-colors"
        >
          {linkText}
        </a>
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
  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid={testId}>
      <AuthHeader />

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-md">
          {/* Auth Card */}
          <div className={`glass-panel p-6 space-y-6 ${cardClassName}`}>
            <AuthCardHeader title={title} subtitle={subtitle} icon={icon} />
            {children}
          </div>
        </div>
      </main>

      <AuthFooter />
    </div>
  );
};

// =============================================================================
// Exports
// =============================================================================

export default AuthLayout;
