/**
 * EmptyState (Epic 30-4)
 *
 * Celestial Night empty-state illustrations for 4 scenarios:
 *   - no-horses
 *   - no-competitions
 *   - no-messages
 *   - no-results
 *
 * Each variant renders an ASCII/SVG-inspired pictogram, a heading,
 * a subtitle, and an optional CTA button.
 *
 * Usage:
 *   <EmptyState
 *     variant="no-horses"
 *     action={{ label: 'Browse Horses', onClick: () => navigate('/horses') }}
 *   />
 */

import React from 'react';
import { Footprints, Trophy, MessageSquare, SearchX } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

export type EmptyVariant = 'no-horses' | 'no-competitions' | 'no-messages' | 'no-results';

export interface EmptyStateProps {
  variant: EmptyVariant;
  /** Override default heading */
  title?: string;
  /** Override default subtitle */
  subtitle?: string;
  /** Optional CTA button */
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

// ── Variant config ─────────────────────────────────────────────────────────────

interface VariantConfig {
  Icon: React.ElementType;
  title: string;
  subtitle: string;
  illustration: React.ReactNode;
}

function IllustrationRing({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto mb-4 h-20 w-20">
      {/* Outer glow ring */}
      <div className="absolute inset-0 rounded-full bg-[rgba(201,162,39,0.06)] border border-[rgba(201,162,39,0.12)]" />
      {/* Inner ring */}
      <div className="absolute inset-2 rounded-full bg-[rgba(201,162,39,0.04)] border border-[rgba(201,162,39,0.08)] flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

const VARIANTS: Record<EmptyVariant, VariantConfig> = {
  'no-horses': {
    Icon: Footprints,
    title: 'No Horses Yet',
    subtitle: 'Your stable is empty. Browse available horses to begin your journey.',
    illustration: (
      <IllustrationRing>
        <Footprints className="h-8 w-8 text-[var(--gold-400)]" aria-hidden="true" />
      </IllustrationRing>
    ),
  },
  'no-competitions': {
    Icon: Trophy,
    title: 'No Competitions Found',
    subtitle: 'No shows match your current filters. Try adjusting the discipline or status.',
    illustration: (
      <IllustrationRing>
        <Trophy className="h-8 w-8 text-[var(--gold-400)]" aria-hidden="true" />
      </IllustrationRing>
    ),
  },
  'no-messages': {
    Icon: MessageSquare,
    title: 'No Messages',
    subtitle: 'Your inbox is empty. Messages from other players will appear here.',
    illustration: (
      <IllustrationRing>
        <MessageSquare className="h-8 w-8 text-[var(--gold-400)]" aria-hidden="true" />
      </IllustrationRing>
    ),
  },
  'no-results': {
    Icon: SearchX,
    title: 'No Results',
    subtitle: "We couldn't find anything matching your search. Try different keywords.",
    illustration: (
      <IllustrationRing>
        <SearchX className="h-8 w-8 text-[var(--gold-400)]" aria-hidden="true" />
      </IllustrationRing>
    ),
  },
};

// ── Component ──────────────────────────────────────────────────────────────────

export function EmptyState({ variant, title, subtitle, action, className = '' }: EmptyStateProps) {
  const config = VARIANTS[variant];

  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}
      data-testid={`empty-state-${variant}`}
    >
      {/* Illustration */}
      {config.illustration}

      {/* Text */}
      <h3
        className="text-base font-semibold text-[var(--cream)]"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        {title ?? config.title}
      </h3>
      <p className="mt-1 text-sm text-[var(--text-muted)] font-[var(--font-body)] max-w-xs leading-relaxed">
        {subtitle ?? config.subtitle}
      </p>

      {/* CTA */}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={[
            'mt-5 rounded-full px-6 py-2 text-sm font-bold transition-all',
            'bg-gradient-to-r from-[var(--gold-700)] to-[var(--gold-400)] text-[var(--celestial-navy-900)]',
            'hover:brightness-110 hover:shadow-[0_0_14px_rgba(201,162,39,0.3)]',
            'font-[var(--font-heading)]',
          ].join(' ')}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
