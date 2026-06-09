/**
 * PageContainer — Content measure primitive for authenticated pages.
 *
 * ## Ownership split (see docs/design-system/DECISIONS.md §1)
 *
 * - **Shell** (`DashboardLayout`, line 100): owns the outer application-width
 *   constraint (`max-w-[1440px] mx-auto`), horizontal gutters (`px-4 md:px-8`),
 *   and the gap between the main content column and the aside panel.
 *   PageContainer MUST NOT add `px-*` classes — gutters already exist.
 *
 * - **PageContainer** (this file): constrains *content measure* within the
 *   shell via one of four approved variants. Choose the variant that matches
 *   the page's content density; do not use arbitrary `max-w-[*]` classes.
 *
 * - **Pages**: own their internal composition — grid columns, card layouts,
 *   spacing between sections — below the PageContainer boundary.
 *
 * ## Variants (source of truth: DECISIONS.md §1)
 *
 * | Variant   | Class               | Width  | Use                                   |
 * | --------- | ------------------- | ------ | ------------------------------------- |
 * | `narrow`  | max-w-2xl mx-auto   | 672px  | Forms, settings, focused workflows    |
 * | `content` | max-w-4xl mx-auto   | 896px  | Standard operational pages            |
 * | `wide`    | max-w-6xl mx-auto   | 1152px | Grids, marketplaces, rosters          |
 * | `full`    | w-full              | shell  | Edge-to-edge tools (exceptional use)  |
 *
 * ## Usage
 *
 * ```tsx
 * // Standard page
 * <PageContainer>…</PageContainer>
 *
 * // Settings / forms
 * <PageContainer variant="narrow">…</PageContainer>
 *
 * // Data-rich grid
 * <PageContainer variant="wide">…</PageContainer>
 *
 * // Semantic element
 * <PageContainer as="section" variant="content">…</PageContainer>
 *
 * // No vertical padding (e.g. the container is inside a padded parent)
 * <PageContainer padded={false}>…</PageContainer>
 * ```
 */

import React from 'react';
import { cn } from '@/lib/utils';

export type PageContainerVariant = 'narrow' | 'content' | 'wide' | 'full';

/** Maps each variant to the Tailwind classes approved in DECISIONS.md §1. */
const VARIANT_CLASSES: Record<PageContainerVariant, string> = {
  narrow: 'max-w-2xl mx-auto',
  content: 'max-w-4xl mx-auto',
  wide: 'max-w-6xl mx-auto',
  full: 'w-full',
};

export interface PageContainerProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Content-measure variant. Defaults to `content` (896px / max-w-4xl).
   * See DECISIONS.md §1 for the full table.
   */
  variant?: PageContainerVariant;

  /**
   * When `true` (default), adds `py-6 md:py-8` for standard vertical rhythm.
   * Set to `false` when the container is inside a parent that already provides
   * vertical spacing, or when a page needs custom top/bottom handling.
   */
  padded?: boolean;

  /**
   * The HTML element to render as. Defaults to `div`.
   * Use `section`, `main`, `article`, etc. when it aids accessibility or
   * semantic HTML for the page's document structure.
   */
  as?: React.ElementType;

  /** Additional Tailwind classes merged via `cn` (twMerge). */
  className?: string;

  /** Override the default `data-testid="page-container"`. */
  'data-testid'?: string;
}

/**
 * PageContainer — constrains content measure within the DashboardLayout shell.
 *
 * Never adds horizontal padding (`px-*`). The shell owns the gutters.
 */
export function PageContainer({
  variant = 'content',
  padded = true,
  as: Tag = 'div',
  className,
  children,
  'data-testid': dataTestId = 'page-container',
  ...rest
}: PageContainerProps) {
  return (
    <Tag
      data-testid={dataTestId}
      className={cn(VARIANT_CLASSES[variant], padded && 'py-6 md:py-8', className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export default PageContainer;
