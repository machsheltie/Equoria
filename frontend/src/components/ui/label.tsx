/** Label — Native <label> forwarder (no Radix). Visual styling lives in game/GameLabel.tsx (Story 22-6) */
import * as React from 'react';

const Label = React.forwardRef<React.ElementRef<'label'>, React.ComponentPropsWithoutRef<'label'>>(
  ({ className, onMouseDown, ...props }, ref) => (
    <label
      ref={ref}
      className={className}
      // Replicates @radix-ui/react-label behavior: prevent text selection when
      // the label is double-clicked (without swallowing the consumer's handler).
      onMouseDown={(event) => {
        onMouseDown?.(event);
        if (!event.defaultPrevented && event.detail > 1) {
          event.preventDefault();
        }
      }}
      {...props}
    />
  )
);
Label.displayName = 'Label';

export { Label };
