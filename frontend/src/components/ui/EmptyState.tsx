/**
 * EmptyState (Epic 30-4, extended D-17)
 *
 * Two APIs coexist on this component:
 *
 *  1. Legacy API (backward-compat): `variant` is one of the original 4 keys
 *     ('no-horses' | 'no-competitions' | 'no-messages' | 'no-results').
 *     Optional `title`, `subtitle`, `action` props. All existing consumers
 *     continue to work unchanged.
 *
 *  2. D-17 semantic API: `variant` is one of the 5 semantic keys
 *     ('first-use' | 'no-results' | 'filtered' | 'unavailable' | 'completed').
 *     Props: `icon` (ReactNode), `title`, `description`, optional
 *     `primaryAction`, optional `secondaryAction`.
 *
 *     D-08 one-primary rule: only `primaryAction` renders the gold `default`
 *     Button variant; `secondaryAction` always renders `secondary`. The
 *     enforcement is structural — the gold variant is not available to
 *     `secondaryAction` at all.
 *
 * The legacy variant keys are detected by whether the value starts with 'no-'
 * or equals 'no-competitions' / 'no-messages'; the semantic keys are the D-17
 * set. 'no-results' appears in BOTH sets — in the legacy path it renders the
 * legacy config; callers using it with the D-17 props (`description`,
 * `primaryAction`, etc.) are in the semantic path. The discriminant is
 * the presence of `description` or `primaryAction` props.
 */

import React from 'react';
import { Footprints, Trophy, MessageSquare, SearchX } from 'lucide-react';
import { Button } from './button';

// ── Legacy types ───────────────────────────────────────────────────────────────

export type LegacyEmptyVariant = 'no-horses' | 'no-competitions' | 'no-messages' | 'no-results';

// ── D-17 semantic variant types ────────────────────────────────────────────────

/**
 * Semantic variants (D-17):
 *  - first-use: encourage user to start; action strongly recommended
 *  - no-results: search/filter matched nothing; show reset-search action
 *  - filtered: filter narrowed to empty; offer to clear filter
 *  - unavailable: content exists but is inaccessible (permissions/region)
 *  - completed: task complete, nothing left to do; celebratory tone
 */
export type SemanticEmptyVariant =
  | 'first-use'
  | 'no-results'
  | 'filtered'
  | 'unavailable'
  | 'completed';

export type EmptyVariant = LegacyEmptyVariant | SemanticEmptyVariant;

// ── Shared action types ────────────────────────────────────────────────────────

export interface EmptyAction {
  label: string;
  onClick: () => void;
}

// ── Full props interface ───────────────────────────────────────────────────────

export interface EmptyStateProps {
  variant: EmptyVariant;

  // --- D-17 semantic props ---

  /** Icon rendered inside the illustration ring (any ReactNode: Lucide icon, SVG, emoji) */
  icon?: React.ReactNode;
  /** Override / supply heading text */
  title?: string;
  /** D-17 body copy (preferred over `subtitle` for semantic variants) */
  description?: string;
  /**
   * Primary action — renders a gold `default` Button (D-08 one-primary rule).
   * Only one primary action is shown; use `secondaryAction` for supplementary actions.
   */
  primaryAction?: EmptyAction;
  /**
   * Secondary action — always renders a `secondary` Button (never gold).
   * D-08: the gold treatment is reserved for `primaryAction` only.
   */
  secondaryAction?: EmptyAction;

  // --- Legacy compat props ---

  /** @deprecated Use `description` for new code; kept for legacy consumers */
  subtitle?: string;
  /** @deprecated Use `primaryAction` for new code; kept for legacy consumers */
  action?: EmptyAction;

  className?: string;
}

// ── Legacy variant config ──────────────────────────────────────────────────────

interface LegacyVariantConfig {
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

const LEGACY_VARIANTS: Record<LegacyEmptyVariant, LegacyVariantConfig> = {
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

const LEGACY_VARIANT_KEYS = new Set<string>([
  'no-horses',
  'no-competitions',
  'no-messages',
  // 'no-results' is shared — see discriminant note in file-level JSDoc
]);

// ── D-17 semantic variant defaults ────────────────────────────────────────────

/** Semantic variants tune icon emphasis + whether actions are encouraged. */
const SEMANTIC_DEFAULTS: Record<
  SemanticEmptyVariant,
  { title: string; description: string; iconEmphasis: 'strong' | 'subtle' }
> = {
  'first-use': {
    title: 'Nothing here yet',
    description: 'Get started by creating your first item.',
    iconEmphasis: 'strong',
  },
  'no-results': {
    title: 'No Results',
    description: "We couldn't find anything matching your search.",
    iconEmphasis: 'subtle',
  },
  filtered: {
    title: 'No Matches',
    description: 'Your current filters returned nothing. Try adjusting them.',
    iconEmphasis: 'subtle',
  },
  unavailable: {
    title: 'Not Available',
    description: 'This content is currently unavailable.',
    iconEmphasis: 'subtle',
  },
  completed: {
    title: 'All Done',
    description: "There's nothing left to do here.",
    iconEmphasis: 'strong',
  },
};

// ── Component ──────────────────────────────────────────────────────────────────

export function EmptyState({
  variant,
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  // legacy compat
  subtitle,
  action,
  className = '',
}: EmptyStateProps) {
  // Discriminant: treat as legacy if the key is in the LEGACY_VARIANT_KEYS set,
  // OR if it is 'no-results' AND neither `description` nor `primaryAction` are present.
  const isLegacy =
    LEGACY_VARIANT_KEYS.has(variant) ||
    (variant === 'no-results' && !description && !primaryAction && !secondaryAction);

  if (isLegacy) {
    const config = LEGACY_VARIANTS[variant as LegacyEmptyVariant];
    const resolvedAction = primaryAction ?? action;

    return (
      <div
        className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}
        data-testid={`empty-state-${variant}`}
      >
        {/* Illustration */}
        {config.illustration}

        {/* Text */}
        {/* Typography via .type-card-title role class (Equoria-o5hub.8) */}
        <h3 className="type-card-title">{title ?? config.title}</h3>
        <p className="mt-1 text-sm text-[var(--text-muted)] font-[var(--font-body)] max-w-xs leading-relaxed">
          {subtitle ?? description ?? config.subtitle}
        </p>

        {/* CTA — legacy single-action */}
        {resolvedAction && (
          <button
            type="button"
            onClick={resolvedAction.onClick}
            className={[
              'mt-5 rounded-full px-6 py-2 text-sm font-bold transition-all',
              'bg-gradient-to-r from-[var(--gold-700)] to-[var(--gold-400)] text-[var(--celestial-navy-900)]',
              'hover:brightness-110 hover:shadow-[0_0_14px_rgba(201,162,39,0.3)]',
              'font-[var(--font-heading)]',
            ].join(' ')}
          >
            {resolvedAction.label}
          </button>
        )}
      </div>
    );
  }

  // ── D-17 semantic path ─────────────────────────────────────────────────────
  const semanticVariant = variant as SemanticEmptyVariant;
  const defaults = SEMANTIC_DEFAULTS[semanticVariant];
  const iconEmphasisStrong = defaults.iconEmphasis === 'strong';

  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}
      data-testid={`empty-state-${variant}`}
    >
      {/* Illustration ring — icon prop or nothing */}
      {icon != null && (
        <IllustrationRing>
          <span
            className={iconEmphasisStrong ? 'text-[var(--gold-400)]' : 'text-[var(--text-muted)]'}
            aria-hidden="true"
          >
            {icon}
          </span>
        </IllustrationRing>
      )}

      {/* Text */}
      {/* Typography via .type-card-title role class (Equoria-o5hub.8) */}
      <h3 className="type-card-title">{title ?? defaults.title}</h3>
      <p className="mt-1 text-sm text-[var(--text-muted)] font-[var(--font-body)] max-w-xs leading-relaxed">
        {description ?? subtitle ?? defaults.description}
      </p>

      {/* Actions — D-08 one-primary enforcement */}
      {(primaryAction || secondaryAction) && (
        <div className="mt-5 flex items-center justify-center gap-3">
          {/* PRIMARY: gold default variant — enforced structurally */}
          {primaryAction && (
            <Button
              variant="default"
              size="default"
              onClick={primaryAction.onClick}
              data-testid="empty-state-primary-action"
            >
              {primaryAction.label}
            </Button>
          )}
          {/* SECONDARY: always secondary variant — never gold */}
          {secondaryAction && (
            <Button
              variant="secondary"
              size="default"
              onClick={secondaryAction.onClick}
              data-testid="empty-state-secondary-action"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
