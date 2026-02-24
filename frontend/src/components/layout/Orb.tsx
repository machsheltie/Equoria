import React from 'react';
import { cn } from '@/lib/utils';

interface OrbProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'purple' | 'gold' | 'blue';
  blur?: 'sm' | 'md' | 'lg';
}

export const Orb: React.FC<OrbProps> = ({
  className,
  size = 'md',
  color = 'purple',
  blur = 'md',
  ...props
}) => {
  const sizeClasses = {
    sm: 'w-32 h-32',
    md: 'w-64 h-64',
    lg: 'w-96 h-96',
    xl: 'w-[500px] h-[500px]',
  };

  const colorClasses = {
    purple: 'bg-nebula-purple/20',
    gold: 'bg-celestial-gold/10',
    blue: 'bg-midnight-blue/40',
  };

  const blurClasses = {
    sm: 'blur-xl',
    md: 'blur-2xl',
    lg: 'blur-3xl',
  };

  return (
    <div
      className={cn(
        'rounded-full pointer-events-none absolute animate-float mix-blend-screen',
        sizeClasses[size],
        colorClasses[color],
        blurClasses[blur],
        className
      )}
      {...props}
    />
  );
};
