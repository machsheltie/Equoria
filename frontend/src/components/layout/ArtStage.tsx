import React from 'react';
import { cn } from '@/lib/utils';

interface ArtStageProps extends React.HTMLAttributes<HTMLDivElement> {
  artSrc?: string;
  artAlt?: string;
  variant?: 'fullscreen' | 'hero' | 'card' | 'sidebar';
  overlay?: boolean;
}

/**
 * ArtStage: A specialized component for presenting High-Fidelity Artwork
 * in the Celestial UI system.
 *
 * Features:
 * - Handles proper layering (z-index)
 * - Optional overlays/gradients to ensure text legibility
 * - Responsive sizing and positioning
 */
export const ArtStage = React.forwardRef<HTMLDivElement, ArtStageProps>(
  (
    {
      className,
      artSrc,
      artAlt = 'Celestial Artwork',
      variant = 'hero',
      overlay = true,
      children,
      ...props
    },
    ref
  ) => {
    // Base styles for the container
    const baseStyles = 'relative overflow-hidden transition-all duration-700 ease-out';

    // Variants control sizing and positioning
    const variants = {
      fullscreen: 'fixed inset-0 z-[-1]', // Behind everything
      hero: 'w-full h-[60vh] min-h-[400px] flex items-center justify-center',
      card: 'w-full aspect-[4/3] rounded-t-lg',
      sidebar: 'h-full w-full absolute inset-0 object-cover',
    };

    return (
      <div ref={ref} className={cn(baseStyles, variants[variant], className)} {...props}>
        {/* The Artwork Layer */}
        {artSrc && (
          <div className="absolute inset-0 w-full h-full">
            <img
              src={artSrc}
              alt={artAlt}
              className={cn(
                'w-full h-full object-cover transition-transform duration-1000 transform hover:scale-105',
                variant === 'fullscreen' && 'opacity-60 mix-blend-overlay' // Blend with space background
              )}
            />
          </div>
        )}

        {/* The Atmosphere/Overlay Layer */}
        {overlay && (
          <div className="absolute inset-0 bg-gradient-to-t from-deep-space via-transparent to-transparent opacity-80" />
        )}

        {/* Optional particle effects or decorative elements could go here */}
        <div className="absolute inset-0 pointer-events-none bg-[url('/assets/noise.png')] opacity-[0.03] mix-blend-overlay"></div>

        {/* Content Layer (if any children are passed) */}
        <div className="relative z-10 w-full h-full flex flex-col justify-end p-6">{children}</div>
      </div>
    );
  }
);

ArtStage.displayName = 'ArtStage';
