/**
 * PageHero — Atmospheric page header for Celestial Night pages
 *
 * Replaces the boring "icon-box + title" pattern with a cinematic banner
 * that makes each page feel like entering a location in a game world.
 *
 * Features:
 * - Gradient backdrop with ambient glow orbs
 * - Gold accent line divider
 * - Slot for optional decorative element (right side)
 * - Thematic mood via `mood` prop that controls glow colours
 */

import React from 'react';

type PageMood = 'default' | 'golden' | 'mystic' | 'competitive' | 'nature';

interface PageHeroProps {
  title: string;
  subtitle?: string;
  mood?: PageMood;
  icon?: React.ReactNode;
  /** Optional background image URL — covers the entire hero area */
  backgroundImage?: string;
  /** Optional decorative element rendered on the right (desktop only) */
  decoration?: React.ReactNode;
  children?: React.ReactNode;
}

const moodConfig: Record<PageMood, { orb1: string; orb2: string; accentLine: string }> = {
  default: {
    orb1: 'radial-gradient(ellipse at 20% 50%, rgba(58, 111, 221, 0.15) 0%, transparent 60%)',
    orb2: 'radial-gradient(ellipse at 85% 30%, rgba(201, 162, 39, 0.1) 0%, transparent 50%)',
    accentLine:
      'linear-gradient(90deg, transparent, rgba(201, 162, 39, 0.5), rgba(58, 111, 221, 0.3), transparent)',
  },
  golden: {
    orb1: 'radial-gradient(ellipse at 15% 60%, rgba(201, 162, 39, 0.18) 0%, transparent 55%)',
    orb2: 'radial-gradient(ellipse at 80% 20%, rgba(201, 162, 39, 0.12) 0%, transparent 50%)',
    accentLine:
      'linear-gradient(90deg, transparent, rgba(201, 162, 39, 0.6), rgba(201, 162, 39, 0.6), transparent)',
  },
  mystic: {
    orb1: 'radial-gradient(ellipse at 25% 40%, rgba(195, 155, 211, 0.15) 0%, transparent 55%)',
    orb2: 'radial-gradient(ellipse at 75% 60%, rgba(58, 111, 221, 0.12) 0%, transparent 50%)',
    accentLine:
      'linear-gradient(90deg, transparent, rgba(195, 155, 211, 0.5), rgba(58, 111, 221, 0.3), transparent)',
  },
  competitive: {
    orb1: 'radial-gradient(ellipse at 20% 50%, rgba(192, 57, 43, 0.12) 0%, transparent 55%)',
    orb2: 'radial-gradient(ellipse at 80% 30%, rgba(201, 162, 39, 0.15) 0%, transparent 50%)',
    accentLine:
      'linear-gradient(90deg, transparent, rgba(201, 162, 39, 0.5), rgba(192, 57, 43, 0.3), transparent)',
  },
  nature: {
    orb1: 'radial-gradient(ellipse at 20% 50%, rgba(46, 139, 87, 0.12) 0%, transparent 55%)',
    orb2: 'radial-gradient(ellipse at 80% 40%, rgba(201, 162, 39, 0.1) 0%, transparent 50%)',
    accentLine:
      'linear-gradient(90deg, transparent, rgba(46, 139, 87, 0.4), rgba(201, 162, 39, 0.3), transparent)',
  },
};

const PageHero: React.FC<PageHeroProps> = ({
  title,
  subtitle,
  mood = 'default',
  icon,
  backgroundImage,
  decoration,
  children,
}) => {
  const { orb1, orb2, accentLine } = moodConfig[mood];

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
      {/* Ambient glow orbs — purely decorative */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{ background: orb1 }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{ background: orb2 }}
      />

      {/* Content */}
      <div className="relative z-[1] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-4 min-w-0">
            {/* Icon container with glow */}
            {icon && (
              <div
                className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border border-[rgba(201,162,39,0.3)] shadow-[0_0_20px_rgba(201,162,39,0.15)]"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(201, 162, 39, 0.12) 0%, rgba(10, 22, 40, 0.8) 100%)',
                }}
              >
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h1
                className="text-2xl sm:text-3xl font-bold text-[var(--gold-400)] tracking-wide"
                style={{
                  fontFamily: 'var(--font-heading)',
                  textShadow: '0 0 30px rgba(201, 162, 39, 0.3)',
                }}
              >
                {title}
              </h1>
              {subtitle && (
                <p
                  className="mt-1 text-sm text-[var(--cream)]/80 font-[var(--font-body)] max-w-xl"
                  style={{ textShadow: '0 1px 6px rgba(0,0,0,1), 0 0 20px rgba(0,0,0,0.9)' }}
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

        {/* Optional children (e.g., stat pills, action buttons) */}
        {children && <div className="mt-5">{children}</div>}
      </div>

      {/* Gold accent divider line */}
      <div className="h-px w-full" aria-hidden="true" style={{ background: accentLine }} />
    </header>
  );
};

export default PageHero;
