/**
 * TackShop constants (extracted from TackShopPage — Equoria-f5xni)
 *
 * Category display-name fallbacks, category emoji icons, the discipline
 * filter option list, and tack tier styling. Extracted verbatim so the
 * page composition and its sub-components share one source of truth.
 */

export type TackShopTab = 'horses' | 'shop';

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

export const DISCIPLINE_OPTIONS = [
  'All',
  'Dressage',
  'Show Jumping',
  'Cross-Country',
  'Western Pleasure',
  'Endurance',
  'Racing',
  'Eventing',
  'Reining',
  'Barrel Racing',
  'Hunter',
];

export const TIER_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  basic: { bg: 'bg-slate-500/20', text: 'text-slate-300', label: 'Basic' },
  quality: { bg: 'bg-blue-500/20', text: 'text-blue-300', label: 'Quality' },
  premium: { bg: 'bg-amber-500/20', text: 'text-amber-300', label: 'Premium' },
};
