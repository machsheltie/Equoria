/**
 * fieldStyles — Canonical form-control visual recipe (Equoria-o5hub.12 / D-13)
 *
 * Single source of truth for the field appearance derived from .celestial-input:
 *   bg: --glass-bg, border: --glass-border, radius: --radius-md, text: --text-primary
 *   placeholder: --text-muted, focus: --gold-primary ring, invalid: --role-danger-border,
 *   disabled: opacity-40 cursor-not-allowed.
 *
 * Every form control imports BASE_FIELD_CLASSES and composes via cn().
 * Do NOT duplicate these values in individual control files.
 */
import { cn } from '@/lib/utils';

/** Core visual recipe — shared by Input, Textarea, Select, NumberInput */
export const BASE_FIELD_CLASSES = [
  // Layout & shape
  'w-full',
  'rounded-[var(--radius-md)]',
  'px-3',
  'py-2',
  'text-sm',
  // Colors / glass surface
  'bg-[var(--glass-bg)]',
  'border',
  'border-[var(--glass-border)]',
  'text-[var(--text-primary)]',
  'placeholder:text-[var(--text-muted)]',
  // Transition
  'transition-[border-color,box-shadow]',
  'duration-200',
  // Focus — gold ring matching celestial-input
  'outline-none',
  'focus:border-[var(--gold-primary)]',
  'focus:shadow-[0_0_0_1px_var(--gold-primary)]',
  // Invalid state — role-danger border; text unchanged
  'aria-[invalid=true]:border-[var(--role-danger-border)]',
  'aria-[invalid=true]:focus:shadow-[0_0_0_1px_var(--role-danger-border)]',
  // Disabled
  'disabled:opacity-40',
  'disabled:cursor-not-allowed',
] as const;

/** Convenience helper — merges base classes with any extras */
export function fieldCn(...extras: Parameters<typeof cn>) {
  return cn(BASE_FIELD_CLASSES.join(' '), ...extras);
}
