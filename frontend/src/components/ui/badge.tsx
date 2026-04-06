/** Badge — Naked Radix forwarder. Visual styling lives in game/GameBadge.tsx (Story 22-6) */
import * as React from 'react';

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'success'
  | 'warning'
  | 'primary'
  | 'outline'
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'ultra-rare'
  | 'legendary';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

function Badge({ className, ...props }: BadgeProps) {
  return <div className={className} {...props} />;
}

export { Badge };
