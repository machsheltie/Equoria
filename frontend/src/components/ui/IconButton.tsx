/**
 * IconButton — 44×44 px icon-only button (DECISIONS.md §5, D-07/D-09)
 *
 * Wraps Button with size="icon". `aria-label` is TypeScript-required.
 * Accepts an `icon` prop (ReactNode) OR children — both render inside the
 * 44×44 touch target.
 *
 * Tooltip: when `tooltip` is provided the button is wrapped in a
 * GameTooltip (Radix-backed, Celestial Night styled). The tooltip requires
 * a GameTooltipProvider ancestor; if none exists Radix silently skips the
 * portal. If integrating GameTooltip is not possible in a context, pass
 * `title` directly via the standard `title` prop — it is forwarded to the
 * underlying button element and surfaces in browsers / AT without Radix.
 *
 * Default variant: 'ghost' (text-only, underline on hover per ghost spec).
 * Override via the `variant` prop.
 */

import * as React from 'react';
import { Button, type ButtonProps } from './button';
import {
  GameTooltip,
  GameTooltipContent,
  GameTooltipProvider,
  GameTooltipTrigger,
} from './game/GameTooltip';

export interface IconButtonProps extends Omit<ButtonProps, 'size'> {
  /** Screen-reader label. Required for accessibility (WCAG 2.1 SC 1.1.1). */
  'aria-label': string;
  /** Icon node. Renders inside the button. Also accepts children instead. */
  icon?: React.ReactNode;
  /**
   * Optional tooltip text. When provided the button is wrapped in a
   * GameTooltip (Radix-backed). The tooltip renders above the button by
   * default (Radix default side).
   *
   * Note: GameTooltip requires a GameTooltipProvider ancestor. In isolated
   * test/render environments without a provider the tooltip silently skips
   * portal rendering; the `aria-label` still provides AT accessibility.
   */
  tooltip?: string;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, children, tooltip, variant = 'ghost', ...props }, ref) => {
    const content = icon ?? children;

    const button = (
      <Button size="icon" variant={variant} ref={ref} {...props}>
        {content}
      </Button>
    );

    if (!tooltip) {
      return button;
    }

    return (
      <GameTooltipProvider>
        <GameTooltip>
          <GameTooltipTrigger asChild>{button}</GameTooltipTrigger>
          <GameTooltipContent>{tooltip}</GameTooltipContent>
        </GameTooltip>
      </GameTooltipProvider>
    );
  }
);
IconButton.displayName = 'IconButton';

export { IconButton };
