/**
 * CinematicMoment Component — Story 18-4
 *
 * Fullscreen overlay for three key game moments:
 * - trait-discovery: when foal traits are revealed
 * - foal-birth: when a breeding produces a live foal
 * - cup-win: when a horse achieves 1st place in competition
 *
 * Auto-dismisses after 3 seconds; also dismisses on click/Escape.
 * Uses z-[var(--z-celebration)] (90) to render above all other UI.
 *
 * Animation: card scales in with a bounce using cinematic-entrance keyframe.
 * Reduced motion: no scale animation, simple fade only.
 */

import React, { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

export type CinematicVariant = 'trait-discovery' | 'foal-birth' | 'cup-win';

export interface CinematicMomentProps {
  variant: CinematicVariant;
  /** Main heading: "New Trait Discovered!", "A Foal is Born!", "Victory!" */
  title: string;
  /** Secondary line: trait name, foal name, competition name */
  subtitle?: string;
  /** Called when the moment should dismiss (auto at 3s or on user interaction) */
  onDismiss: () => void;
}

const VARIANT_CONFIG: Record<
  CinematicVariant,
  { icon: string; accentColor: string; ariaLabel: string }
> = {
  'trait-discovery': {
    icon: '✨',
    accentColor: 'var(--status-rare)',
    ariaLabel: 'Trait discovery notification',
  },
  'foal-birth': {
    icon: '🐴',
    accentColor: 'var(--gold-500)',
    ariaLabel: 'Foal birth notification',
  },
  'cup-win': {
    icon: '🏆',
    accentColor: 'var(--gold-300)',
    ariaLabel: 'Competition victory notification',
  },
};

const AUTO_DISMISS_MS = 3000;

export default function CinematicMoment({
  variant,
  title,
  subtitle,
  onDismiss,
}: CinematicMomentProps) {
  const config = VARIANT_CONFIG[variant];

  // Auto-dismiss after 3 seconds
  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  // Escape key dismiss
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    },
    [onDismiss]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const content = (
    <div
      className="fixed inset-0 flex items-center justify-center z-[var(--z-celebration)]"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      role="dialog"
      aria-modal="true"
      aria-label={config.ariaLabel}
      onClick={onDismiss}
      data-testid="cinematic-moment-overlay"
    >
      {/* Card — click propagation stopped so clicking card doesn't dismiss */}
      <div
        className="relative max-w-sm w-full mx-6 rounded-2xl p-8 text-center"
        style={{
          background: 'var(--glass-surface-heavy-bg)',
          backdropFilter: 'var(--glass-blur-heavy)',
          border: '1px solid var(--glass-border-bright)',
          boxShadow: 'var(--glow-gold-intense)',
          animation: 'cinematic-entrance var(--duration-slow) var(--ease-bounce) forwards',
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid="cinematic-moment-card"
      >
        {/* Icon */}
        <div
          className="text-6xl mb-4 leading-none"
          aria-hidden="true"
          data-testid="cinematic-moment-icon"
        >
          {config.icon}
        </div>

        {/* Title */}
        <h2
          className="fantasy-header text-2xl font-bold mb-2"
          style={{ color: config.accentColor }}
          data-testid="cinematic-moment-title"
        >
          {title}
        </h2>

        {/* Subtitle */}
        {subtitle && (
          <p
            className="text-sm"
            style={{ color: 'var(--text-muted)' }}
            data-testid="cinematic-moment-subtitle"
          >
            {subtitle}
          </p>
        )}

        {/* Dismiss hint */}
        <p className="text-xs mt-6 opacity-50" style={{ color: 'var(--text-muted)' }}>
          Tap anywhere to continue
        </p>
      </div>

      {/* Screen reader announcement */}
      <div role="status" aria-live="assertive" aria-atomic="true" className="sr-only">
        {title}
        {subtitle ? ` — ${subtitle}` : ''}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
