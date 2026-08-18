/**
 * PageHero — Image-backed location header (DECISIONS.md §2, D-20).
 *
 * **Demoted role:** PageHero is now the approved _location header_ variant
 * for world-service pages that have real artwork (vet, farrier, shops,
 * stables-as-locations). Operational pages use `PageHeader` instead.
 *
 * **What changed (D-20 split ruling, user 2026-08-13 — Equoria-ds4c9):**
 * - Ambient mood orb decorations stay REMOVED (the two absolute
 *   radial-gradient divs and the `moodConfig` rgba table that drove them).
 *   They sat on top of the location artwork and washed out the region the
 *   title occupies; the artwork is the reason the header exists.
 * - `mood` prop is kept for API compatibility with existing consumers but is
 *   a no-op. Mark it `@deprecated` in your IDE; it will be removed once
 *   all consumers have migrated to PageHeader.
 * - Gilt icon container RESTORED per the ruling: 46px, gold border at 45%
 *   (rgba(200,168,78,0.45) — no exact token exists; 0.40 is
 *   --btn-gold-border / --tier-gold-border), 14% gold fill, resting
 *   --glow-gold, --radius-md, icon rendered in --gold-light.
 * - Gold gradient divider RESTORED: 2px, beneath the title block, consuming
 *   `--gradient-gold-divider` (a dedicated alias of the gold-accent ramp in
 *   tokens.css) so `--gradient-gold-accent` itself stays reserved for
 *   button/badge use per the D-20 token reservation.
 * - Inner `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` wrapper kept unchanged
 *   (alignment consolidation is a separate concern tracked under a follow-up
 *   issue; ~15 existing consumers depend on this spacing today).
 * - `backgroundImage` support is unchanged — this is now the primary use
 *   case for PageHero.
 *
 * **Existing PageHeroProps API is unchanged.** No consumer breaks.
 */

import React from 'react';

/** @deprecated Pass `mood` to PageHero only for backwards-compatibility.
 *  It is a no-op since D-20 — orbs stay removed. Migrate to PageHeader.
 */
type PageMood = 'default' | 'golden' | 'mystic' | 'competitive' | 'nature';

interface PageHeroProps {
  title: string;
  subtitle?: string;
  /**
   * @deprecated No-op since D-20. The mood orb decorations have been removed.
   * Pass it freely for now; it will be removed once consumers migrate to PageHeader.
   */
  mood?: PageMood;
  icon?: React.ReactNode;
  /** Optional background image URL — covers the entire hero area. */
  backgroundImage?: string;
  /** Optional decorative element rendered on the right (desktop only). */
  decoration?: React.ReactNode;
  children?: React.ReactNode;
}

const PageHero: React.FC<PageHeroProps> = ({
  title,
  subtitle,
  mood: _mood, // no-op since D-20 — destructured to keep the prop API clean
  icon,
  backgroundImage,
  decoration,
  children,
}) => {
  return (
    <header className={`relative overflow-hidden mb-8 ${backgroundImage ? 'min-h-[220px]' : ''}`}>
      {/* Optional background image */}
      {backgroundImage && (
        <div
          className="absolute inset-0 pointer-events-none bg-cover bg-center bg-no-repeat"
          aria-hidden="true"
          style={{ backgroundImage: `url('${backgroundImage}')` }}
        />
      )}
      {/* Dark overlay to keep text readable over background image */}
      {backgroundImage && (
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background: 'linear-gradient(to right, rgba(5,12,30,0.85) 30%, rgba(5,12,30,0.5) 100%)',
          }}
        />
      )}

      {/* Content */}
      <div className="relative z-[1] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-4 min-w-0">
            {/* Gilt icon container (D-20 split ruling): 46px, 45% gold border,
                14% gold fill, resting gold glow, --radius-md, icon in --gold-light */}
            {icon && (
              <div
                data-testid="page-hero-icon"
                className="flex-shrink-0 w-[46px] h-[46px] flex items-center justify-center rounded-[var(--radius-md)] border border-[rgba(200,168,78,0.45)] bg-[rgba(200,168,78,0.14)] shadow-[var(--glow-gold)] text-[var(--gold-light)]"
                aria-hidden="true"
              >
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h1
                className="text-2xl sm:text-3xl font-bold text-[var(--gold-400)] tracking-wide"
                style={{
                  fontFamily: 'var(--font-heading)',
                  textShadow: backgroundImage
                    ? '0 1px 6px rgba(0,0,0,1), 0 0 20px rgba(0,0,0,0.9), 0 0 30px var(--alpha-gold-ember-30)'
                    : undefined,
                }}
              >
                {title}
              </h1>
              {subtitle && (
                <p
                  className="mt-1 text-sm text-[var(--alpha-cream-80)] font-[var(--font-body)] max-w-xl"
                  style={{
                    textShadow: backgroundImage
                      ? '0 1px 6px rgba(0,0,0,1), 0 0 20px rgba(0,0,0,0.9)'
                      : undefined,
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Optional decoration — desktop only */}
          {decoration && (
            <div className="hidden lg:flex items-center flex-shrink-0 opacity-60">{decoration}</div>
          )}
        </div>

        {/* Gold gradient divider beneath the title block (D-20 split ruling).
            Consumes --gradient-gold-divider, NOT --gradient-gold-accent, which
            stays reserved for buttons/badges. */}
        <div
          data-testid="page-hero-divider"
          className="mt-4 h-[2px] w-full"
          aria-hidden="true"
          style={{ background: 'var(--gradient-gold-divider)' }}
        />

        {/* Optional children (e.g., stat pills, action buttons) */}
        {children && (
          <div
            className="mt-5"
            style={{
              textShadow: backgroundImage
                ? '0 1px 6px rgba(0,0,0,1), 0 0 20px rgba(0,0,0,0.9)'
                : undefined,
            }}
          >
            {children}
          </div>
        )}
      </div>
    </header>
  );
};

export default PageHero;
