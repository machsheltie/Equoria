/**
 * Currency Utilities
 *
 * Functions for formatting and parsing in-game currency.
 * Story 2.3: Currency Management - AC-1, AC-2
 */

/**
 * In-game currency symbol (gold coin)
 */
export const CURRENCY_SYMBOL = '\u{1F4B0}'; // Money bag emoji, or use custom icon

/**
 * Format currency with thousands separators
 *
 * @param amount - The currency amount to format
 * @returns Formatted string with commas (e.g., "1,234,567")
 */
export function formatCurrency(amount: number): string {
  // Handle edge cases
  if (amount === undefined || amount === null || Number.isNaN(amount)) {
    return '0';
  }

  // Truncate decimals (in-game currency is always whole numbers)
  const wholeAmount = Math.trunc(amount);

  // Use Intl.NumberFormat for locale-aware formatting
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(wholeAmount);
}

/**
 * Format currency in compact notation (K, M, B)
 *
 * @param amount - The currency amount to format
 * @returns Compact string (e.g., "1.5K", "2M", "1B")
 */
export function formatCompactCurrency(amount: number): string {
  // Handle edge cases
  if (amount === undefined || amount === null || Number.isNaN(amount)) {
    return '0';
  }

  const absAmount = Math.abs(amount);

  // Billions
  if (absAmount >= 1_000_000_000) {
    const value = amount / 1_000_000_000;
    return formatCompactValue(value) + 'B';
  }

  // Millions
  if (absAmount >= 1_000_000) {
    const value = amount / 1_000_000;
    return formatCompactValue(value) + 'M';
  }

  // Thousands
  if (absAmount >= 1_000) {
    const value = amount / 1_000;
    return formatCompactValue(value) + 'K';
  }

  // Under 1000, return as-is
  return String(Math.trunc(amount));
}

/**
 * Helper to format compact values with optional decimal
 */
function formatCompactValue(value: number): string {
  // Round to 1 decimal place
  const rounded = Math.round(value * 10) / 10;

  // If whole number, don't show decimal
  if (rounded === Math.floor(rounded)) {
    return String(Math.floor(rounded));
  }

  return rounded.toFixed(1);
}

/**
 * Get the currency symbol
 *
 * @returns The currency symbol string
 */
export function getCurrencySymbol(): string {
  return CURRENCY_SYMBOL;
}

/**
 * Parse a currency string back to a number
 *
 * @param value - The string to parse (may contain commas and symbol)
 * @returns The numeric value, or 0 if invalid
 */
export function parseCurrency(value: string): number {
  if (!value || typeof value !== 'string') {
    return 0;
  }

  // Remove currency symbol and commas
  const cleaned = value.replace(CURRENCY_SYMBOL, '').replace(/,/g, '').trim();

  // Parse as number
  const parsed = parseInt(cleaned, 10);

  // Return 0 if NaN
  return Number.isNaN(parsed) ? 0 : parsed;
}
