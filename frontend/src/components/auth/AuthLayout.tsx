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
  <header className="bg-parchment parchment-texture border-b-2 border-aged-bronze shadow-lg relative">
    <div className="flex items-center justify-center p-4">
      <h1 className="fantasy-title text-3xl text-midnight-ink">Equoria</h1>
    </div>
    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-aged-bronze via-burnished-gold to-aged-bronze" />
  </header>
);

/**
 * Authentication page footer
 */
export const AuthFooter: React.FC = () => (
  <footer className="bg-parchment border-t border-aged-bronze p-4 text-center">
    <p className="fantasy-body text-xs text-aged-bronze">
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
      <div className="w-16 h-16 bg-gradient-to-br from-burnished-gold to-aged-bronze rounded-full border-2 border-aged-bronze flex items-center justify-center">
        {icon || <Sparkles className="w-8 h-8 text-parchment" aria-hidden="true" />}
      </div>
    </div>
    <h2 className="fantasy-header text-2xl text-midnight-ink">{title}</h2>
    <p className="fantasy-body text-aged-bronze text-sm">{subtitle}</p>
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
  // Using regular anchor since we want to use with React Router
  // Parent component should wrap with Link from react-router-dom
  return (
    <div className="text-center pt-4 border-t border-aged-bronze">
      <p className="fantasy-body text-sm text-aged-bronze">
        {prompt}{' '}
        <a
          href={linkTo}
          className="text-burnished-gold hover:text-midnight-ink font-medium transition-colors"
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
          <div
            className={`bg-parchment parchment-texture rounded-lg border-2 border-aged-bronze shadow-xl p-6 space-y-6 ${cardClassName}`}
          >
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
