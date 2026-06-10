/**
 * Currency — Equoria coin display component (DECISIONS.md §9 / Equoria-o5hub.14)
 *
 * Renders a coin icon + formatted number for all in-game currency contexts.
 * A pre-existing `currency-utils.ts` in `src/lib/` already pins `Intl.NumberFormat`
 * to `'en-US'` locale for environment stability; we follow that same constant
 * here and use the same helpers where they align. Locale-awareness (per-user
 * locale setting) is noted in DECISIONS.md §9 as the future mechanism — when
 * an i18n layer is added, replace the `CURRENCY_LOCALE` constant below.
 *
 * Variants:
 *   standard  — full grouped digits, e.g. "12,345"                   (default)
 *   compact   — Intl compact notation for ≥ 10,000 (1.2K), full below
 *   signed    — explicit +/− prefix, success/danger role colour
 *   balance   — standard + font-semibold + stat-size + gold text
 *
 * Non-finite input (NaN, ±Infinity, null, undefined cast): renders an em-dash
 * with aria-label "unknown amount" rather than silently showing "0". This is
 * intentional — see spec note in Equoria-o5hub.14.
 */

import React from 'react';
import { Coins } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Locale constant — mirrors the 'en-US' choice in src/lib/currency-utils.ts.
// Replace with a runtime locale resolver when Equoria adds an i18n layer.
// ---------------------------------------------------------------------------
const CURRENCY_LOCALE = 'en-US';

// ---------------------------------------------------------------------------
// Intl formatter instances — created once at module level for perf.
// ---------------------------------------------------------------------------
const standardFormatter = new Intl.NumberFormat(CURRENCY_LOCALE, {
  maximumFractionDigits: 0,
});

const compactFormatter = new Intl.NumberFormat(CURRENCY_LOCALE, {
  notation: 'compact',
  maximumFractionDigits: 1,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type CurrencyVariant = 'standard' | 'compact' | 'signed' | 'balance';

export interface CurrencyProps {
  /** The coin amount to display. Non-finite values render as "—". */
  amount: number;
  /**
   * Display variant:
   *  - `standard`  full grouped digits (12,345)
   *  - `compact`   compact notation for ≥ 10,000 only; full below (9,999 / 10K)
   *  - `signed`    explicit +/− prefix with success/danger role colouring
   *  - `balance`   standard + font-semibold + --text-stat size + gold colour
   */
  variant?: CurrencyVariant;
  /** Show the Coins icon to the left of the number. Defaults to true. */
  showIcon?: boolean;
  /** Extra classes appended to the root span. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/**
 * Format `amount` per the requested variant.
 * Returns `{ text, signed }` where `signed` is the +/− prefix for the signed
 * variant (empty string for others).
 */
function formatAmount(
  amount: number,
  variant: CurrencyVariant
): { formatted: string; prefix: string } {
  // Both standard/balance use the same full formatter
  if (variant === 'standard' || variant === 'balance') {
    return { formatted: standardFormatter.format(Math.trunc(amount)), prefix: '' };
  }

  if (variant === 'compact') {
    const abs = Math.abs(amount);
    const trunced = Math.trunc(amount);
    if (abs >= 10_000) {
      // Compact uses the raw value so the K/M suffix stays correct for negatives
      return { formatted: compactFormatter.format(trunced), prefix: '' };
    }
    // Below the compact threshold, use full formatting
    return { formatted: standardFormatter.format(trunced), prefix: '' };
  }

  // signed variant
  if (variant === 'signed') {
    const trunced = Math.trunc(amount);
    const prefix = trunced >= 0 ? '+' : ''; // minus is part of the Intl output
    return { formatted: standardFormatter.format(trunced), prefix };
  }

  // fallback (should never reach)
  return { formatted: standardFormatter.format(Math.trunc(amount)), prefix: '' };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Inline coin-icon + formatted number.
 *
 * @example
 *   <Currency amount={12345} />
 *   <Currency amount={balance} variant="balance" />
 *   <Currency amount={delta} variant="signed" />
 *   <Currency amount={bigNumber} variant="compact" />
 *   <Currency amount={price} showIcon={false} />
 */
const Currency: React.FC<CurrencyProps> = ({
  amount,
  variant = 'standard',
  showIcon = true,
  className,
}) => {
  // --- Non-finite guard -----------------------------------------------------
  if (!Number.isFinite(amount)) {
    return (
      <span
        className={cn('inline-flex items-center gap-[0.25em]', className)}
        aria-label="unknown amount"
        data-testid="currency"
      >
        {showIcon && (
          <Coins
            className="inline-block w-[1em] h-[1em] shrink-0"
            aria-hidden="true"
            style={{ color: 'var(--gold-primary)' }}
          />
        )}
        <span>—</span>
      </span>
    );
  }

  const { formatted, prefix } = formatAmount(amount, variant);

  // --- aria-label text ------------------------------------------------------
  // Use the full (standard) formatted number regardless of variant so the
  // screen-reader reads a coherent value. Terminology per DECISIONS.md §9:
  // "coins" in prose.
  const ariaLabel = `${standardFormatter.format(Math.trunc(amount))} coins`;

  // --- Variant-specific classes ---------------------------------------------
  const variantClasses: Record<CurrencyVariant, string> = {
    standard: '',
    compact: '',
    signed: amount >= 0 ? 'text-[var(--role-success-text)]' : 'text-[var(--role-danger-text)]',
    balance: 'font-semibold text-[length:var(--text-stat)] text-[var(--gold-light)]',
  };

  return (
    <span
      className={cn('inline-flex items-center gap-[0.25em]', variantClasses[variant], className)}
      aria-label={ariaLabel}
      data-testid="currency"
    >
      {showIcon && (
        <Coins
          className="inline-block w-[1em] h-[1em] shrink-0"
          aria-hidden="true"
          style={{ color: 'var(--gold-primary)' }}
        />
      )}
      <span>
        {prefix}
        {formatted}
      </span>
    </span>
  );
};

export default Currency;
