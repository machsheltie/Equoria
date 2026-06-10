/**
 * PageHeader — Compact standard page header (DECISIONS.md §2, D-01).
 *
 * The lightweight header for operational pages: title (h1), optional
 * subtitle, optional actions slot (right-aligned, wraps below on mobile),
 * optional metadata row, optional breadcrumbs slot above the title, and
 * an optional icon (plain — no glow container).
 *
 * Layout contract:
 * - NO own max-width wrapper, NO horizontal padding. Place PageHeader
 *   inside a PageContainer; alignment with body comes free from the shell.
 * - Vertical rhythm: py-6 md:py-8 by default.
 * - Single subtle bottom border via --glass-border (the token already used
 *   throughout the design system for divider-weight separators). Chosen
 *   over "no divider" because PageHeader frequently appears directly above
 *   a content section; the border prevents the heading from visually
 *   merging with the first card below.
 * - No decorative orbs, no gradient divider, no background.
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  /** Page title — rendered as h1. Required. */
  title: string;

  /** Optional subtitle rendered below the title in secondary text. */
  subtitle?: string;

  /**
   * Optional ReactNode slot for actions (e.g. buttons).
   * Right-aligned on desktop, wraps below the title/subtitle block on mobile.
   */
  actions?: React.ReactNode;

  /**
   * Optional ReactNode row rendered between the subtitle and the divider.
   * Intended for stat-pill rows, breadcrumb-adjacent badges, or short meta
   * items.
   */
  metadata?: React.ReactNode;

  /**
   * Optional ReactNode rendered above the title — typically a Breadcrumb
   * component or a back-link affordance.
   */
  breadcrumbs?: React.ReactNode;

  /**
   * Optional icon rendered to the left of the title.
   * Rendered as a plain element — no glow container, no gradient background
   * (per DECISIONS.md §2: PageHeader is compact, no artwork).
   */
  icon?: React.ReactNode;

  /** Additional Tailwind classes merged via cn (twMerge). */
  className?: string;
}

/**
 * PageHeader — compact title header for operational pages.
 *
 * Usage:
 * ```tsx
 * <PageContainer variant="narrow">
 *   <PageHeader
 *     title="Settings"
 *     subtitle="Manage your account preferences."
 *     icon={<Settings className="w-5 h-5 text-[var(--gold-400)]" />}
 *   />
 *   …body content…
 * </PageContainer>
 * ```
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  metadata,
  breadcrumbs,
  icon,
  className,
}) => {
  return (
    <header
      className={cn('py-6 md:py-8 border-b border-[var(--glass-border)]', className)}
      data-testid="page-header"
    >
      {/* Breadcrumbs slot — sits above the title row */}
      {breadcrumbs && (
        <div
          className="mb-3 text-sm text-[var(--text-secondary)]"
          data-testid="page-header-breadcrumbs"
        >
          {breadcrumbs}
        </div>
      )}

      {/* Title row: icon + title/subtitle block + actions */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          {/* Plain icon — no glow container per DECISIONS.md §2 */}
          {icon && (
            <span
              className="flex-shrink-0 mt-0.5"
              aria-hidden="true"
              data-testid="page-header-icon"
            >
              {icon}
            </span>
          )}

          <div className="min-w-0">
            {/* No truncate: long titles wrap naturally (handoff §6.2 — silent
                ellipsis hides entity/page names). break-words guards long
                unbroken strings; min-w-0 on ancestors lets the flex item shrink.
                Typography via .type-page-title role class (Equoria-o5hub.8). */}
            <h1 className="type-page-title break-words">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-[var(--text-secondary)]">{subtitle}</p>}
          </div>
        </div>

        {/* Actions slot — wraps below on narrow viewports */}
        {actions && (
          <div
            className="flex items-center gap-2 flex-wrap flex-shrink-0"
            data-testid="page-header-actions"
          >
            {actions}
          </div>
        )}
      </div>

      {/* Metadata row — badges, stat pills, short meta items */}
      {metadata && (
        <div
          className="mt-3 text-sm text-[var(--text-secondary)]"
          data-testid="page-header-metadata"
        >
          {metadata}
        </div>
      )}
    </header>
  );
};

export default PageHeader;
