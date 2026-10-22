/**
 * Async-state primitives barrel (D-15, D-16, D-17)
 *
 * Loading:
 *   PageLoading    — route/page-level (wraps GallopingLoader)
 *   SectionLoading — section-level inline spinner
 *   Skeleton       — Skeleton.Rect / Skeleton.Line / Skeleton.Circle + SkeletonBase
 *   LoadingRegion  — role="status" wrapper that announces a component's own placeholder
 *
 * Errors:
 *   InlineError — field/inline error (icon + text, role="alert")
 *   ErrorState  — section/page error (wraps ErrorCard, adds severity + backLink)
 *
 * Note: Button pending state lives in frontend/src/components/ui/button.tsx (D-07/D-15).
 */

export { PageLoading } from './PageLoading';
export type { PageLoadingProps } from './PageLoading';

export { SectionLoading } from './SectionLoading';
export type { SectionLoadingProps } from './SectionLoading';

export { Skeleton, SkeletonBase } from './Skeleton';

export { LoadingRegion } from './LoadingRegion';
export type { LoadingRegionProps } from './LoadingRegion';

export { InlineError } from './InlineError';
export type { InlineErrorProps } from './InlineError';

export { ErrorState } from './ErrorState';
export type { ErrorStateProps, ErrorStateRetry, ErrorStateBackLink } from './ErrorState';
