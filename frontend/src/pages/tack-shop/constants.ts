/**
 * TackShop constants (extracted from TackShopPage — Equoria-f5xni)
 *
 * Category display-name fallbacks, category emoji icons, the discipline
 * filter option list, and tack tier styling. Extracted verbatim so the
 * page composition and its sub-components share one source of truth.
 */

import { DISCIPLINE_VALUES } from '@/constants/disciplines';

/** Fallback display names if backend doesn't provide them */
export const DEFAULT_CATEGORY_NAMES: Record<string, string> = {
  saddle: 'Saddles',
  bridle: 'Bridles',
  halter: 'Halters',
  saddle_pad: 'Saddle Pads',
  leg_wraps: 'Leg Wraps & Boots',
  reins: 'Reins',
  girth: 'Girths',
  breastplate: 'Breastplates',
};

/** Fallback emoji icons per category */
export const CATEGORY_ICONS: Record<string, string> = {
  saddle: '🪣',
  bridle: '🔗',
  halter: '🐴',
  saddle_pad: '🟫',
  leg_wraps: '🦿',
  reins: '🪢',
  girth: '🟤',
  breastplate: '🛡️',
};

/** 'All' plus every competition discipline. */
export const DISCIPLINE_OPTIONS = ['All', ...DISCIPLINE_VALUES];

/**
 * Tack tier badge styling — semantic role tokens (DECISIONS.md §7):
 * basic → neutral, quality → info, premium → accent (gold).
 */
export const TIER_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  basic: {
    bg: 'bg-[var(--role-neutral-bg)]',
    text: 'text-[var(--role-neutral-text)]',
    label: 'Basic',
  },
  quality: {
    bg: 'bg-[var(--role-info-bg)]',
    text: 'text-[var(--role-info-text)]',
    label: 'Quality',
  },
  premium: {
    bg: 'bg-[var(--role-accent-bg)]',
    text: 'text-[var(--role-accent-text)]',
    label: 'Premium',
  },
};
