/**
 * Currency Display Component
 *
 * Displays user's in-game currency with fantasy-themed styling.
 * Shows balance with coin icon, supports compact mode and size variants.
 *
 * Story 2.3: Currency Management - AC-1 through AC-5
 */

import React from 'react';
import { Coins } from 'lucide-react';
import { formatCurrency, formatCompactCurrency } from '../lib/currency-utils';

interface CurrencyDisplayProps {
  /** Currency amount to display */
  amount?: number;
  /** Show loading skeleton */
  isLoading?: boolean;
  /** Use compact notation (K, M, B) */
  compact?: boolean;
  /** Optional label above the amount */
  label?: string;
  /** Component size variant */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Loading skeleton for the currency display
 */
const CurrencyLoadingSkeleton: React.FC<{ size: 'sm' | 'md' | 'lg' }> = ({ size }) => {
  const sizeClasses = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-10',
  };

  return (
    <div
      data-testid="currency-loading-skeleton"
      className={`animate-pulse ${sizeClasses[size]} flex items-center gap-2`}
    >
      {/* Coin icon skeleton */}
      <div className="w-6 h-6 rounded-full bg-aged-bronze/30" />
      {/* Amount skeleton */}
      <div className="h-4 w-16 bg-aged-bronze/30 rounded" />
    </div>
  );
};

/**
 * Currency Display Component
 */
const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({
  amount = 0,
  isLoading = false,
  compact = false,
  label,
  size = 'md',
}) => {
  // Format the amount
  const displayAmount = compact ? formatCompactCurrency(amount ?? 0) : formatCurrency(amount ?? 0);

  // Size-based styling
  const sizeClasses = {
    sm: 'currency-display-sm gap-1 text-sm',
    md: 'currency-display-md gap-2 text-base',
    lg: 'currency-display-lg gap-3 text-lg',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const labelSizes = {
    sm: 'text-xs',
    md: 'text-xs',
    lg: 'text-sm',
  };

  // Loading state
  if (isLoading) {
    return <CurrencyLoadingSkeleton size={size} />;
  }

  return (
    <div
      data-testid="currency-display"
      className={`currency-display flex items-center ${sizeClasses[size]}`}
      aria-label={`Currency balance: ${displayAmount}`}
    >
      {/* Label (optional) */}
      {label && (
        <span
          className={`fantasy-body ${labelSizes[size]} text-aged-bronze uppercase tracking-wide mr-2`}
        >
          {label}
        </span>
      )}

      {/* Coin Icon */}
      <Coins data-testid="currency-icon" className={`${iconSizes[size]} text-burnished-gold`} />

      {/* Amount */}
      <span className="font-bold text-midnight-ink">{displayAmount}</span>
    </div>
  );
};

export default CurrencyDisplay;
