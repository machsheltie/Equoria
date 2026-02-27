import React, { useState } from 'react';

interface FantasyButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  size?: 'default' | 'large';
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

const FantasyButton = ({
  children,
  onClick,
  variant = 'primary',
  size = 'default',
  className = '',
  type = 'button',
  disabled = false,
}: FantasyButtonProps) => {
  const [isPressed, setIsPressed] = useState(false);
  const [showShimmer, setShowShimmer] = useState(false);

  const handleClick = () => {
    if (disabled) return;
    setIsPressed(true);
    setShowShimmer(true);
    setTimeout(() => setIsPressed(false), 150);
    setTimeout(() => setShowShimmer(false), 600);
    if (onClick) onClick();
  };

  const baseClasses =
    'relative rounded-lg font-fantasy-body font-bold uppercase tracking-wider transition-all duration-200 overflow-hidden';
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';

  const sizeClasses = size === 'large' ? 'px-8 py-4 text-lg' : 'px-6 py-3 text-base';

  const variantClasses =
    variant === 'primary'
      ? 'bg-[rgba(37,99,235,0.9)] text-white magical-glow hover:bg-[rgba(37,99,235,1)] hover:shadow-lg'
      : 'bg-[rgba(15,35,70,0.5)] text-[rgb(220,235,255)] border border-[rgba(37,99,235,0.3)] hover:bg-[rgba(15,35,70,0.7)]';

  const pressedClasses = isPressed ? 'transform scale-95' : '';

  return (
    <button
      type={type}
      disabled={disabled}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${pressedClasses} ${disabledClasses} ${className}`}
      onClick={handleClick}
      onMouseEnter={() => !disabled && setShowShimmer(true)}
      onMouseLeave={() => setShowShimmer(false)}
    >
      <span className="relative z-[var(--z-raised)]">{children}</span>

      {/* Shimmer effect */}
      {showShimmer && <div className="absolute inset-0 shimmer-effect opacity-60" />}

      {/* Corner embellishments */}
      <div className="absolute top-1 left-1 w-2 h-2 border-l-2 border-t-2 border-burnished-gold opacity-60" />
      <div className="absolute top-1 right-1 w-2 h-2 border-r-2 border-t-2 border-burnished-gold opacity-60" />
      <div className="absolute bottom-1 left-1 w-2 h-2 border-l-2 border-b-2 border-burnished-gold opacity-60" />
      <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-burnished-gold opacity-60" />
    </button>
  );
};

export default FantasyButton;
