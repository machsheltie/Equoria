/**
 * IconBox — semantic icon container (Equoria-o5hub.8, handoff §6.7)
 *
 * A small rounded container that gives an icon a semantic tint. Use it when
 * the container itself communicates a role (success/warning/danger/info/
 * accent/neutral) — e.g. a status icon at the head of a card, a category
 * marker in a list row.
 *
 * NOT a universal decorative wrapper: plain icons stay plain when a
 * container adds no semantic or visual value. NOT for interactive icon-only
 * controls — those use IconButton (44px target + required aria-label).
 *
 * Accessibility: the box is decorative by default (aria-hidden="true").
 * If the icon is the ONLY carrier of information, pass a `label` — it is
 * rendered for assistive technology via sr-only text and the box loses
 * aria-hidden.
 *
 * All colors via tokens (DECISIONS.md §7): badge background tokens + status
 * text tokens. Radius: --radius-md (semantic scale §3).
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const iconBoxVariants = cva(
  'inline-flex items-center justify-center flex-shrink-0 rounded-[var(--radius-md)]',
  {
    variants: {
      variant: {
        neutral: 'bg-[var(--glass-surface-subtle-bg)] text-[var(--text-secondary)]',
        accent: 'bg-[var(--btn-gold-bg)] text-[var(--gold-light)]',
        success: 'bg-[var(--badge-success-bg)] text-[var(--status-success)]',
        warning: 'bg-[var(--badge-warning-bg)] text-[var(--status-warning)]',
        danger: 'bg-[var(--badge-danger-bg)] text-[var(--status-danger)]',
        info: 'bg-[var(--badge-info-bg)] text-[var(--status-info)]',
      },
      size: {
        sm: 'w-8 h-8 [&_svg]:w-4 [&_svg]:h-4',
        md: 'w-10 h-10 [&_svg]:w-5 [&_svg]:h-5',
        lg: 'w-12 h-12 [&_svg]:w-6 [&_svg]:h-6',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'md',
    },
  }
);

export interface IconBoxProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof iconBoxVariants> {
  /**
   * Accessible label. Omit for decorative boxes (default: aria-hidden).
   * Provide ONLY when the icon is the sole carrier of the information —
   * renders sr-only text and removes aria-hidden.
   */
  label?: string;
}

const IconBox = React.forwardRef<HTMLSpanElement, IconBoxProps>(
  ({ className, variant, size, label, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(iconBoxVariants({ variant, size }), className)}
      {...(label ? {} : { 'aria-hidden': true })}
      data-testid="icon-box"
      {...props}
    >
      {children}
      {label && <span className="sr-only">{label}</span>}
    </span>
  )
);
IconBox.displayName = 'IconBox';

export { IconBox, iconBoxVariants };
