/**
 * Game Component Library — barrel export (Story 22.6)
 *
 * All game-native UI components for Equoria's Celestial Night design system.
 * Import from here instead of individual files:
 *   import { FrostedPanel, GameDialog, GoldTabs, CanonicalTabs } from '@/components/ui/game';
 *
 * Tab hierarchy:
 *   CanonicalTabs — canonical tab component (DECISIONS.md §6, Equoria-o5hub.11). USE THIS.
 *   GoldTabs      — tokenised Radix styling base; foundation of CanonicalTabs. NOT deprecated.
 *   CelestialTabs — @deprecated array-API adapter; retained until consumers migrate.
 */
export * from './FrostedPanel';
export * from './GameDialog';
export * from './GoldTabs';
export * from './GameBadge';
export * from './GlassInput';
export * from './GlassTextarea';
export * from './StatBar';
export * from './GameCheckbox';
export * from './GameLabel';
export * from './GameTooltip';
export * from './GameScrollArea';
export * from './GameCollapsible';
export * from './CelestialTabs';
export * from './CanonicalTabs';
