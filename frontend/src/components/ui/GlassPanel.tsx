/**
 * GlassPanel Component
 *
 * Reusable glassmorphism surface wrapper that enforces the single blur layer
 * rule: only ONE element with backdrop-filter: blur() should be active on
 * screen at any time. Nested GlassPanels must NOT apply blur — set the
 * `noBlur` prop on inner panels when nesting.
 *
 * Sizes:
 *   sm    — 12px blur, subtle bg  (e.g. inline tooltip surfaces)
 *   md    — 12px blur, standard bg (default, most panels/cards)
 *   lg    — 16px blur, heavy bg    (e.g. modals, hero panels)
 *
 * Story UI-3: GlassPanel + StatBar Primitives
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface GlassPanelProps {
  /** Content to render inside the glass surface */
  children: React.ReactNode;
  /** Surface opacity variant */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Disable backdrop-filter on this panel when it's nested inside another
   * glass surface that already provides the blur layer.
   */
  noBlur?: boolean;
  /** Override the default border (pass false to remove) */
  border?: boolean;
  /** Additional Tailwind classes */
  className?: string;
  /** Inline style overrides */
  style?: React.CSSProperties;
  /** HTML element tag to render (default: div) */
  as?: keyof React.JSX.IntrinsicElements;
  /** Forwarded aria / data attributes */
  [key: `aria-${string}`]: string | boolean | undefined;
  [key: `data-${string}`]: string | undefined;
}

const bgTokens = {
  sm: 'var(--glass-surface-subtle-bg)',
  md: 'var(--glass-surface-bg)',
  lg: 'var(--glass-surface-heavy-bg)',
} as const;

const blurTokens = {
  sm: 'var(--glass-blur-light)',
  md: 'var(--glass-blur)',
  lg: 'var(--glass-blur-heavy)',
} as const;

const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  size = 'md',
  noBlur = false,
  border = true,
  className,
  style,
  as: Tag = 'div',
  ...rest
}) => {
  const blurValue = noBlur ? 'none' : blurTokens[size];

  const inlineStyle: React.CSSProperties = {
    background: bgTokens[size],
    backdropFilter: blurValue,
    WebkitBackdropFilter: blurValue,
    borderRadius: 'var(--radius-panel)',
    border: border ? 'var(--glass-border)' : undefined,
    boxShadow: 'var(--shadow-panel)',
    ...style,
  };

  return (
    <Tag className={cn(className)} style={inlineStyle} {...rest}>
      {children}
    </Tag>
  );
};

export default GlassPanel;
