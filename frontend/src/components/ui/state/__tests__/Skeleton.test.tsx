/**
 * Skeleton primitives tests (D-15)
 *
 * Covers: Skeleton.Rect, Skeleton.Line, Skeleton.Circle, SkeletonBase.
 * Reduced-motion assertion: verifies that SkeletonBase uses
 * --skeleton-shimmer-duration via the inline animation style (the token
 * is zeroed in tokens.css under prefers-reduced-motion, so the shimmer
 * stops automatically — no component-level motion-media-query needed).
 */

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Skeleton, SkeletonBase } from '../Skeleton';

describe('SkeletonBase', () => {
  it('renders an aria-hidden container', () => {
    const { container } = render(<SkeletonBase className="h-4 w-full" />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies the skeleton-shimmer class', () => {
    const { container } = render(<SkeletonBase />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass('skeleton-shimmer');
  });

  it('uses --skeleton-shimmer-duration token in animation style (reduced-motion assertion)', () => {
    const { container } = render(<SkeletonBase />);
    const el = container.firstChild as HTMLElement;
    // The inline style uses the CSS custom property token.
    // When prefers-reduced-motion: reduce is active, tokens.css sets
    // --skeleton-shimmer-duration: 0s which zeroes the animation duration.
    expect(el.style.animation).toContain('--skeleton-shimmer-duration');
  });

  it('applies custom className', () => {
    const { container } = render(<SkeletonBase className="h-8 w-32" />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass('h-8');
    expect(el).toHaveClass('w-32');
  });
});

describe('Skeleton.Rect', () => {
  it('renders an aria-hidden block', () => {
    const { container } = render(<Skeleton.Rect className="h-4 w-3/4" />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies className', () => {
    const { container } = render(<Skeleton.Rect className="h-10 w-20" />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass('h-10', 'w-20');
  });
});

describe('Skeleton.Line', () => {
  it('renders an aria-hidden element with h-[1em] class', () => {
    const { container } = render(<Skeleton.Line />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el).toHaveClass('h-[1em]');
  });

  it('defaults to w-full when no className provided', () => {
    const { container } = render(<Skeleton.Line />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass('w-full');
  });

  it('applies custom width className', () => {
    const { container } = render(<Skeleton.Line className="w-1/2" />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass('w-1/2');
  });
});

describe('Skeleton.Circle', () => {
  it('renders an aria-hidden element', () => {
    const { container } = render(<Skeleton.Circle />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies default size of 40px', () => {
    const { container } = render(<Skeleton.Circle />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveStyle({ width: '40px', height: '40px' });
  });

  it('applies custom size', () => {
    const { container } = render(<Skeleton.Circle size={64} />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveStyle({ width: '64px', height: '64px' });
  });
});
