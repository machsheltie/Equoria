/**
 * Common UI Components Barrel Export
 *
 * Re-exports shared components for convenient single-import access:
 *   import { BaseModal } from '@/components/common';
 *
 * CR-4-08: Added BaseModal barrel export so consuming modules can import from
 * '@/components/common' instead of deep-linking to the file directly.
 */

export { default as BaseModal } from './BaseModal';
export type { BaseModalProps, ModalSize } from './BaseModal';
export { default as CooldownTimer } from './CooldownTimer';
