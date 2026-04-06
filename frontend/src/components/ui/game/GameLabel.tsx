/**
 * GameLabel — Inter font label with optional smallCaps prop (Story 22-6)
 *
 * Owns all visual styling for labels. Naked label.tsx is the Radix forwarder.
 * Visual: Inter font, --cream color (default), small-caps via smallCaps prop,
 * --gold-400 text via required prop.
 * Spec: "optional smallCaps prop adds font-variant: small-caps"
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import type * as LabelPrimitive from '@radix-ui/react-label';

export interface GameLabelProps extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> {
  /** Renders label in small-caps style for field group headers */
  smallCaps?: boolean;
  /** Gold accent for required fields */
  required?: boolean;
}

const GameLabel = React.forwardRef<React.ElementRef<typeof LabelPrimitive.Root>, GameLabelProps>(
  ({ className, smallCaps, required, ...props }, ref) => (
    <Label
      ref={ref}
      className={cn(
        'text-sm font-medium leading-none',
        'font-[var(--font-body)] text-[var(--cream)]',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        smallCaps && 'text-xs uppercase tracking-widest text-[var(--text-muted)]',
        required && 'text-[var(--gold-400)]',
        className
      )}
      {...props}
    />
  )
);
GameLabel.displayName = 'GameLabel';

export { GameLabel };
