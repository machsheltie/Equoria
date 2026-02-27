/**
 * GallopingLoader Component — Story 18-1
 *
 * Full-page loading fallback for React.lazy() Suspense boundaries.
 * Replaces the bare CSS spinner (PageLoader in App.tsx) with a
 * thematic galloping horse silhouette that travels across the screen.
 *
 * Animation: horse silhouette travels left→right with a bobbing gait;
 *            3 dust particles trail behind using --celestial-primary.
 * Reduced motion: horse is static, only pulsing "Loading…" text shown.
 */

import React from 'react';

export default function GallopingLoader() {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ background: 'var(--bg-page)' }}
      role="status"
      aria-label="Loading"
    >
      {/* Animated track area */}
      <div className="relative w-72 h-28 overflow-hidden">
        {/* Traveling group: horse + dust particles move together left→right */}
        <div className="gallop-traveler absolute bottom-4">
          {/* Dust particles — positioned behind the horse (negative right offset) */}
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="gallop-dust-particle"
              style={{
                right: `${14 + i * 10}px`,
                bottom: `${i * 3}px`,
                width: `${5 - i}px`,
                height: `${5 - i}px`,
                background: 'var(--celestial-primary)',
                animationDelay: `${i * 0.12}s`,
              }}
            />
          ))}
          {/* Horse silhouette from placeholder.svg */}
          <img
            src="/placeholder.svg"
            alt=""
            aria-hidden="true"
            style={{ width: '56px', height: '56px', objectFit: 'contain', display: 'block' }}
          />
        </div>

        {/* Ground line */}
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{ height: '1px', background: 'var(--border-default)', opacity: 0.3 }}
          aria-hidden="true"
        />
      </div>

      {/* Loading text */}
      <p
        className="text-sm animate-pulse mt-4"
        style={{ color: 'var(--text-muted)', letterSpacing: '0.05em' }}
      >
        Loading…
      </p>

      {/* Screen reader announcement */}
      <span className="sr-only">Loading, please wait</span>
    </div>
  );
}
