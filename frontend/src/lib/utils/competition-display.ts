/**
 * Shared display utilities for competition components.
 * Prevents duplication of formatCurrency, formatDate, and PlacementBadge logic.
 */

/**
 * Format a number as USD currency string, e.g. "$1,234"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format an ISO date string to a readable date, e.g. "Mar 15, 2026"
 */
export function formatCompetitionDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Return placement label: "1st", "2nd", "3rd", or ordinal
 */
export function formatPlacement(placement: number): string {
  if (placement === 1) return '1st';
  if (placement === 2) return '2nd';
  if (placement === 3) return '3rd';
  const suffix =
    placement % 10 === 1 ? 'st' : placement % 10 === 2 ? 'nd' : placement % 10 === 3 ? 'rd' : 'th';
  return `${placement}${suffix}`;
}

/**
 * Return Tailwind color class for placement badge
 */
export function placementColorClass(placement: number): string {
  if (placement === 1) return 'bg-yellow-500 text-yellow-900';
  if (placement === 2) return 'bg-gray-400 text-gray-900';
  if (placement === 3) return 'bg-amber-600 text-amber-100';
  return 'bg-gray-200 text-gray-700';
}
