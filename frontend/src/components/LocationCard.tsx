/**
 * LocationCard Component
 *
 * 3-layer atmospheric card for the World Hub:
 *   Layer 1 — Painting background: location-specific CSS gradient + large icon
 *   Layer 2 — Glass chrome overlay: frosted surface over the label area
 *   Layer 3 — Interactive label: name, description, visit arrow
 *
 * Hover state: gold glow border + elevated shadow, name transitions to gold,
 * visit arrow slides right. All transitions respect prefers-reduced-motion via
 * --duration-* tokens (zeroed by the media query in tokens.css).
 *
 * Story UI-2: LocationCard Component
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export interface LocationCardProps {
  /** Unique location identifier — used for data-testid and aria */
  id: string;
  /** Display name of the location */
  name: string;
  /** One-sentence description shown in the glass overlay */
  description: string;
  /** Emoji icon rendered in the painting area */
  icon: string;
  /** React Router path for navigation on click */
  href: string;
  /**
   * CSS gradient string for the atmospheric painting background.
   * Each location supplies its own; these are intentionally content-level
   * data constants, not design-system tokens (no semantic token exists for
   * per-location painting colours).
   */
  paintingGradient: string;
  /** Number of pending alerts — renders a red badge when > 0 */
  alertCount?: number;
  /** Label appended to alertCount (default: "alert") */
  alertLabel?: string;
}

const LocationCard: React.FC<LocationCardProps> = ({
  id,
  name,
  description,
  icon,
  href,
  paintingGradient,
  alertCount,
  alertLabel = 'alert',
}) => {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      to={href}
      className="relative flex flex-col overflow-hidden"
      style={{
        borderRadius: 'var(--radius-card)',
        border: `1px solid ${hovered ? 'var(--border-active)' : 'var(--border-default)'}`,
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        boxShadow: hovered ? 'var(--shadow-card-hover), var(--glow-gold)' : 'var(--shadow-card)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'var(--transition-all)',
        minHeight: '220px',
        textDecoration: 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-testid={`location-card-${id}`}
      aria-label={`Visit ${name}`}
    >
      {/* ── Layer 1: Atmospheric painting background ─────────────────────── */}
      <div
        className="absolute inset-0"
        style={{ background: paintingGradient }}
        aria-hidden="true"
      />

      {/* Icon centered in the upper painting area */}
      <div
        className="relative z-10 flex flex-1 items-center justify-center pt-6 pb-3 text-5xl select-none"
        aria-hidden="true"
      >
        {icon}
      </div>

      {/* ── Layer 2 + 3: Glass chrome label overlay ───────────────────────── */}
      {/* No additional backdrop-filter here — the card wrapper already provides
          the single allowed blur layer per the one-blur-layer rule. */}
      <div
        className="relative z-10 px-4 pb-4 pt-3"
        style={{ background: 'var(--glass-surface-heavy-bg)' }}
      >
        {/* Location name */}
        <h2
          className="text-base font-semibold mb-1 truncate"
          style={{
            color: hovered ? 'var(--gold-400)' : 'var(--text-primary)',
            fontFamily: 'var(--font-heading)',
            transition: 'var(--transition-color)',
          }}
        >
          {name}
        </h2>

        {/* Description */}
        <p
          className="text-xs leading-relaxed line-clamp-2"
          style={{ color: 'var(--text-secondary)' }}
        >
          {description}
        </p>

        {/* Visit arrow */}
        <div
          className="mt-2 flex items-center gap-1 text-xs font-medium"
          style={{
            color: hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
            transition: 'var(--transition-color)',
          }}
        >
          Visit
          <span
            className="inline-block"
            style={{
              transform: hovered ? 'translateX(3px)' : 'translateX(0)',
              transition: 'var(--transition-transform)',
            }}
            aria-hidden="true"
          >
            →
          </span>
        </div>
      </div>

      {/* ── Alert badge ───────────────────────────────────────────────────── */}
      {alertCount !== undefined && alertCount > 0 && (
        <span
          className="absolute top-3 right-3 text-white text-xs font-bold px-2 py-0.5"
          style={{
            background: 'var(--status-error)',
            borderRadius: 'var(--radius-pill)',
            zIndex: 'var(--z-raised)',
          }}
          data-testid={`location-card-alert-${id}`}
        >
          {alertCount} {alertLabel}
        </span>
      )}
    </Link>
  );
};

export default LocationCard;
