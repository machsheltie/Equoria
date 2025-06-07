import React, { useState } from 'react';

interface FantasyButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  size?: 'default' | 'large';
  className?: string;
}

const FantasyButton = ({ 
  children, 
  onClick, 
  variant = 'primary',
  size = 'default',
  className = '' 
}: FantasyButtonProps) => {
  const [isPressed, setIsPressed] = useState(false);
  const [showShimmer, setShowShimmer] = useState(false);

  const handleClick = () => {
    setIsPressed(true);
    setShowShimmer(true);
    setTimeout(() => setIsPressed(false), 150);
    setTimeout(() => setShowShimmer(false), 600);
    if (onClick) onClick();
  };

  const baseClasses = "relative rounded-lg font-fantasy-body font-bold uppercase tracking-wider transition-all duration-200 overflow-hidden";
  
  const sizeClasses = size === 'large' 
    ? "px-8 py-4 text-lg" 
    : "px-6 py-3 text-base";
  
  const variantClasses = variant === 'primary'
    ? "bg-forest-green text-parchment gold-border magical-glow hover:shadow-lg"
    : "bg-aged-bronze text-parchment border-2 border-burnished-gold hover:bg-saddle-leather";

  const pressedClasses = isPressed ? "transform scale-95" : "";

  return (
    <button
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${pressedClasses} ${className}`}
      onClick={handleClick}
      onMouseEnter={() => setShowShimmer(true)}
      onMouseLeave={() => setShowShimmer(false)}
    >
      <span className="relative z-10 parchment-texture">
        {children}
      </span>
      
      {/* Shimmer effect */}
      {showShimmer && (
        <div className="absolute inset-0 shimmer-effect opacity-60" />
      )}
      
      {/* Corner embellishments */}
      <div className="absolute top-1 left-1 w-2 h-2 border-l-2 border-t-2 border-burnished-gold opacity-60" />
      <div className="absolute top-1 right-1 w-2 h-2 border-r-2 border-t-2 border-burnished-gold opacity-60" />
      <div className="absolute bottom-1 left-1 w-2 h-2 border-l-2 border-b-2 border-burnished-gold opacity-60" />
      <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-burnished-gold opacity-60" />
    </button>
  );
};

export default FantasyButton;