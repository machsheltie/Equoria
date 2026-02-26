/**
 * ErrorCard — Consistent error display with optional retry button
 *
 * Used for useQuery failure states across all major pages.
 * Replaces one-off error displays with a unified pattern.
 *
 * Story 15-3: Loading & Error States Polish
 */

import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorCardProps {
  /** Heading shown above the message */
  title?: string;
  /** Descriptive error message */
  message?: string;
  /** When provided, shows a "Try Again" button that calls this */
  onRetry?: () => void;
  /** Extra wrapper class — useful to constrain padding in tight contexts */
  className?: string;
}

export const ErrorCard: React.FC<ErrorCardProps> = ({
  title = 'Unable to Load Data',
  message = 'Something went wrong. Please check your connection and try again.',
  onRetry,
  className,
}) => (
  <div className={`flex items-center justify-center p-12 ${className ?? ''}`}>
    <div className="text-center space-y-4 max-w-md">
      <AlertCircle className="w-12 h-12 mx-auto" style={{ color: 'var(--status-error)' }} />
      <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h3>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ background: 'var(--celestial-primary)' }}
          onMouseOver={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '0.85')}
          onMouseOut={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
        >
          Try Again
        </button>
      )}
    </div>
  </div>
);

export default ErrorCard;
