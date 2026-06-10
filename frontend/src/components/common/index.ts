/**
 * Common UI Components Barrel Export
 *
 * Re-exports shared components for convenient single-import access:
 *   import { CooldownTimer } from '@/components/common';
 *
 * BaseModal was deleted 2026-06-10 (Equoria-o5hub.13) after all consumers
 * migrated to GameDialog (@/components/ui/game) — the canonical dialog per
 * DECISIONS.md §8.
 */

export { default as CooldownTimer } from './CooldownTimer';
