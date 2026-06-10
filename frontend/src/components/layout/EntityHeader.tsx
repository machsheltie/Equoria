/**
 * EntityHeader — Identity-centred detail header (DECISIONS.md §2, D-01).
 *
 * For entity detail pages (horse, foal, club): image/avatar, name (h1),
 * core metadata badges, entity actions, and an optional back-link
 * affordance.
 *
 * Layout contract:
 * - NO own max-width wrapper, NO horizontal padding. Place EntityHeader
 *   inside a PageContainer; alignment with body comes free from the shell.
 * - Vertical rhythm: py-6 md:py-8 by default.
 * - Image/avatar uses --radius-lg (per DECISIONS.md §3 semantic mapping).
 * - No decorative orbs, no gradient background, no glow containers.
 *
 * Usage:
 * ```tsx
 * <PageContainer variant="content">
 *   <EntityHeader
 *     name={foal.name}
 *     image="/path/to/image.png"
 *     metadata={<span className="text-sm text-[var(--text-secondary)]">3 days old</span>}
 *     backLink={{ to: '/my-stable', label: 'Back to stable' }}
 *   />
 *   …body content…
 * </PageContainer>
 * ```
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EntityHeaderBackLink {
  /** Route to link to (passed to react-router-dom Link's `to` prop). */
  to: string;
  /** Label text shown next to the back arrow. */
  label: string;
}

export interface EntityHeaderProps {
  /** Entity name — rendered as h1. Required. */
  name: string;

  /**
   * Image for the entity. Accepts either:
   * - A src string → rendered as <img> with --radius-lg rounding.
   * - A ReactNode → rendered as-is (for custom avatar components).
   */
  image?: string | React.ReactNode;

  /**
   * Optional alt text for the image when `image` is a string.
   * Defaults to the entity name.
   */
  imageAlt?: string;

  /**
   * Optional ReactNode row of badges/chips displayed below the name.
   * Typical use: health status, sale price, sex badge, etc.
   */
  metadata?: React.ReactNode;

  /**
   * Optional ReactNode for entity-level actions (e.g. Edit, List for Sale).
   * Rendered to the right of the name block on desktop.
   */
  actions?: React.ReactNode;

  /**
   * Optional back-link affordance rendered above the entity identity block.
   * Rendered as a react-router-dom Link with an ArrowLeft icon.
   */
  backLink?: EntityHeaderBackLink;

  /** Additional Tailwind classes merged via cn (twMerge). */
  className?: string;
}

/**
 * EntityHeader — identity-centred header for detail pages.
 */
export const EntityHeader: React.FC<EntityHeaderProps> = ({
  name,
  image,
  imageAlt,
  metadata,
  actions,
  backLink,
  className,
}) => {
  const isImageString = typeof image === 'string';

  return (
    <header className={cn('py-6 md:py-8', className)} data-testid="entity-header">
      {/* Back-link affordance */}
      {backLink && (
        <Link
          to={backLink.to}
          className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-4"
          data-testid="entity-header-back-link"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          {backLink.label}
        </Link>
      )}

      {/* Identity block: image + name/metadata + actions */}
      <div className="flex items-start gap-4 flex-wrap">
        {/* Avatar / portrait */}
        {image && (
          <div className="flex-shrink-0" data-testid="entity-header-image-wrapper">
            {isImageString ? (
              <img
                src={image as string}
                alt={imageAlt ?? name}
                className="w-20 h-20 object-cover rounded-[var(--radius-lg)]"
              />
            ) : (
              image
            )}
          </div>
        )}

        {/* Name + metadata + actions */}
        <div className="flex-1 min-w-0 flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            {/* No truncate: long entity names wrap naturally (handoff §6.2 —
                silent ellipsis hides horse/club names). break-words guards long
                unbroken strings; min-w-0 on ancestors lets the flex item shrink. */}
            <h1
              className="text-[var(--text-3xl)] font-semibold text-[var(--text-primary)] break-words"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {name}
            </h1>

            {/* Badges / chips row */}
            {metadata && (
              <div
                className="mt-2 flex flex-wrap items-center gap-2"
                data-testid="entity-header-metadata"
              >
                {metadata}
              </div>
            )}
          </div>

          {/* Actions slot */}
          {actions && (
            <div
              className="flex items-center gap-2 flex-wrap flex-shrink-0"
              data-testid="entity-header-actions"
            >
              {actions}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default EntityHeader;
