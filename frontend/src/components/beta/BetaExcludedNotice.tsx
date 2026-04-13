/**
 * BetaExcludedNotice — Honest beta-excluded state component
 *
 * Renders a clear, honest message for routes or actions that are intentionally
 * unavailable in the current beta. Does NOT claim the feature is "coming soon" —
 * it is excluded from this beta for readiness reasons.
 *
 * Usage:
 *   <BetaExcludedNotice />                           // inline notice
 *   <BetaExcludedNotice fullPage />                  // full-page centered layout
 *   <BetaExcludedNotice message="Custom copy" />     // custom copy
 *   <BetaExcludedNotice redirectTo="/" />            // link back to another route
 *
 * Story 21R-2: Remove production frontend mocks from beta-facing code
 */

import React from 'react';
import { Link } from 'react-router-dom';

export interface BetaExcludedNoticeProps {
  /** Custom message to display. Defaults to generic beta-excluded copy. */
  message?: string;
  /** Renders as a full-page centered layout (for route-level exclusions). */
  fullPage?: boolean;
  /** Optional link target for a "Go back" / "Return home" link. */
  redirectTo?: string;
  /** Label for the redirect link. */
  redirectLabel?: string;
  /** data-testid for test targeting. */
  testId?: string;
}

/**
 * BetaExcludedNotice Component
 */
const BetaExcludedNotice: React.FC<BetaExcludedNoticeProps> = ({
  message = 'Not available in this beta.',
  fullPage = false,
  redirectTo,
  redirectLabel = 'Return to Home',
  testId = 'beta-excluded-notice',
}) => {
  const content = (
    <div
      data-testid={testId}
      className="rounded-lg border border-[var(--glass-border)] bg-[rgba(10,14,26,0.6)] p-6 text-center"
    >
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[rgba(200,168,78,0.1)] mb-4">
        <span className="text-2xl" aria-hidden="true">
          🔒
        </span>
      </div>
      <p
        className="text-[var(--text-primary)] font-medium mb-1"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        Not available in this beta
      </p>
      <p className="text-sm text-[var(--text-secondary)]">{message}</p>
      {redirectTo && (
        <Link
          to={redirectTo}
          className="inline-block mt-4 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium text-[var(--gold-primary)] border border-[var(--glass-border)] hover:border-[var(--glass-hover)] transition-colors"
          data-testid={`${testId}-link`}
        >
          {redirectLabel}
        </Link>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md">{content}</div>
      </div>
    );
  }

  return content;
};

export default BetaExcludedNotice;
