/**
 * GoldBorderFrame (Epic 30-1)
 *
 * Animated gold corner flourishes for hero panels.
 * Renders decorative L-shaped corner accents that animate in on mount.
 *
 * Usage:
 *   <GoldBorderFrame>
 *     <div>Your hero content</div>
 *   </GoldBorderFrame>
 *
 * Props:
 *   - cornerSize: length of the corner arms in px (default 20)
 *   - thickness: stroke width in px (default 2)
 *   - animated: whether corners animate in (default true)
 *   - className: extra classes on the wrapper
 */

import React from 'react';

export interface GoldBorderFrameProps {
  children: React.ReactNode;
  cornerSize?: number;
  thickness?: number;
  animated?: boolean;
  className?: string;
}

/** Single L-shaped corner drawn with two absolutely-positioned divs */
function Corner({
  position,
  size,
  thickness,
  animated,
}: {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  size: number;
  thickness: number;
  animated: boolean;
}) {
  const isTop = position.startsWith('top');
  const isLeft = position.endsWith('left');

  const posStyle: React.CSSProperties = {
    position: 'absolute',
    [isTop ? 'top' : 'bottom']: 0,
    [isLeft ? 'left' : 'right']: 0,
    width: size,
    height: size,
    animationDelay: isTop ? (isLeft ? '0ms' : '80ms') : isLeft ? '160ms' : '240ms',
  };

  // Horizontal arm
  const hStyle: React.CSSProperties = {
    position: 'absolute',
    [isTop ? 'top' : 'bottom']: 0,
    [isLeft ? 'left' : 'right']: 0,
    width: '100%',
    height: thickness,
    background: 'var(--gold-primary)',
    borderRadius: 2,
  };

  // Vertical arm
  const vStyle: React.CSSProperties = {
    position: 'absolute',
    [isTop ? 'top' : 'bottom']: 0,
    [isLeft ? 'left' : 'right']: 0,
    width: thickness,
    height: '100%',
    background: 'var(--gold-primary)',
    borderRadius: 2,
  };

  return (
    <div
      style={posStyle}
      className={animated ? 'gold-corner-animate' : undefined}
      aria-hidden="true"
    >
      <div style={hStyle} />
      <div style={vStyle} />
    </div>
  );
}

export function GoldBorderFrame({
  children,
  cornerSize = 20,
  thickness = 2,
  animated = true,
  className = '',
}: GoldBorderFrameProps) {
  return (
    <div className={`relative ${className}`}>
      {/* Corner flourishes */}
      {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((pos) => (
        <Corner
          key={pos}
          position={pos}
          size={cornerSize}
          thickness={thickness}
          animated={animated}
        />
      ))}

      {/* Content */}
      {children}
    </div>
  );
}

export default GoldBorderFrame;
