/**
 * FrostedPanel — Game-native glass surface container (Story 22-6)
 *
 * Owns all visual styling for card surfaces. Naked card.tsx is the Radix forwarder.
 * Visual: glass-panel CSS class (backdrop-filter blur(12px), var(--glass-bg) bg,
 * var(--glass-border) border, 12px radius). Gold hover border via Tailwind override.
 * Use instead of <Card> for all game content areas.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';

const FrostedPanel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <Card
      ref={ref}
      className={cn(
        'glass-panel',
        'text-[var(--text-primary)]',
        'transition-shadow duration-200',
        'hover:border-[var(--gold-dim)]',
        className
      )}
      {...props}
    />
  )
);
FrostedPanel.displayName = 'FrostedPanel';

const FrostedPanelHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <CardHeader ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  )
);
FrostedPanelHeader.displayName = 'FrostedPanelHeader';

const FrostedPanelTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <CardTitle
    ref={ref}
    className={cn(
      'text-xl font-semibold leading-snug tracking-wide',
      'font-[var(--font-heading)] text-[var(--gold-400)]',
      className
    )}
    {...props}
  />
));
FrostedPanelTitle.displayName = 'FrostedPanelTitle';

const FrostedPanelDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <CardDescription
    ref={ref}
    className={cn('text-sm text-[var(--text-muted)] font-[var(--font-body)]', className)}
    {...props}
  />
));
FrostedPanelDescription.displayName = 'FrostedPanelDescription';

const FrostedPanelContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <CardContent ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
);
FrostedPanelContent.displayName = 'FrostedPanelContent';

const FrostedPanelFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <CardFooter ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  )
);
FrostedPanelFooter.displayName = 'FrostedPanelFooter';

export {
  FrostedPanel,
  FrostedPanelHeader,
  FrostedPanelTitle,
  FrostedPanelDescription,
  FrostedPanelContent,
  FrostedPanelFooter,
};
