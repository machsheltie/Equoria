/** Label — Celestial Night Inter font, cream color (Task 22-6) */
import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const labelVariants = cva(
  [
    'text-sm font-medium leading-none',
    'font-[var(--font-body)] text-[var(--cream)]',
    'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
  ].join(' '),
  {
    variants: {
      variant: {
        default: '',
        /** Small-caps variant for field group headers */
        caps: 'text-xs uppercase tracking-widest text-[var(--text-muted)]',
        /** Gold accent for required fields */
        required: 'text-[var(--gold-400)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>
>(({ className, variant, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants({ variant }), className)} {...props} />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
