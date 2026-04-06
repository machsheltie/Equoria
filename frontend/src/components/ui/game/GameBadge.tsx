/**
 * GameBadge — Rarity-aware pill badge (Story 22.6)
 *
 * Composites over badge.tsx.
 * Rarity variants: common (var(--bg-twilight) bg), rare (purple-tinted glass + var(--status-rare) text),
 * legendary (gold-tinted glass + var(--status-legendary) text). Rounded-full pill.
 * Also supports: default (gold), secondary, destructive, success, warning, primary, outline.
 *
 * All colour values come from CSS custom property tokens — no raw hex or rgba literals.
 */
export { Badge as GameBadge, badgeVariants as gameBadgeVariants } from '@/components/ui/badge';
export type { BadgeProps as GameBadgeProps } from '@/components/ui/badge';
