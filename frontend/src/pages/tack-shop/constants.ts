/**
 * TackShop constants (extracted from TackShopPage — Equoria-f5xni)
 *
 * Category display-name fallbacks, category emoji icons, the discipline
 * filter option list, and tack tier styling. Extracted verbatim so the
 * page composition and its sub-components share one source of truth.
 */

import { disciplineValues } from '@/constants/disciplines';

/** Fallback display names if backend doesn't provide them */
export const defaultCategoryNames: Record<string, string> = {
  saddle: 'Saddles',
  bridle: 'Bridles',
  halter: 'Halters',
  saddlePad: 'Saddle Pads',
  legWraps: 'Leg Wraps & Boots',
  reins: 'Reins',
  girth: 'Girths',
  breastplate: 'Breastplates',
};

/** Fallback emoji icons per category */
export const categoryIcons: Record<string, string> = {
  saddle: '🪣',
  bridle: '🔗',
  halter: '🐴',
  saddlePad: '🟫',
  legWraps: '🦿',
  reins: '🪢',
  girth: '🟤',
  breastplate: '🛡️',
};

/** 'All' plus every competition discipline. */
export const disciplineOptions = ['All', ...disciplineValues];

/**
 * Tack tier badge styling — semantic role tokens (DECISIONS.md §7):
 * basic → neutral, quality → info, premium → accent (gold).
 */
export const tierColors: Record<string, { bg: string; text: string; label: string }> = {
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
