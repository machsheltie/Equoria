import React, { useRef } from 'react';
import { cn } from '@/lib/utils';
import { Constellation } from './Constellation';

interface StarFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  density?: 'low' | 'medium' | 'high';
  speed?: 'slow' | 'medium' | 'fast';
}

export const StarField: React.FC<StarFieldProps> = ({
  className,
  density = 'medium',
  speed = 'slow',
  ...props
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate stars (this could be optimized with Canvas for high density, but DOM is fine for < 100 stars)
  const starCount = {
    low: 50,
    medium: 100,
    high: 200,
  }[density];

  const duration = {
    slow: '4s',
    medium: '3s',
    fast: '2s',
  }[speed];

  return (
    <div
      ref={containerRef}
      className={cn('fixed inset-0 overflow-hidden pointer-events-none z-[-2]', className)}
      {...props}
    >
      {[...Array(starCount)].map((_, i) => {
        const size = Math.random() * 2 + 1; // 1px to 3px
        const left = `${Math.random() * 100}%`;
        const top = `${Math.random() * 100}%`;
        const delay = `${Math.random() * 5}s`;

        return (
          <div
            key={i}
            className="absolute rounded-full bg-white opacity-0 animate-twinkle"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              left,
              top,
              animationDelay: delay,
              animationDuration: duration,
            }}
          />
        );
      })}

      {/* Nebula Overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-nebula-purple/5 to-transparent mix-blend-screen" />

      {/* Constellation Overlay */}
      <div className="absolute top-1/4 right-[10%] w-[40%] h-[60%] opacity-40 mix-blend-screen pointer-events-none">
        <Constellation />
      </div>
    </div>
  );
};
