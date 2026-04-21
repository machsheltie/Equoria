/**
 * PageBackground / usePageBackground Tests — Story 22.3
 *
 * Verifies:
 * - usePageBackground returns correct CSS properties
 * - Scene paths resolve correctly
 * - Static src overrides scene
 * - Default scene falls back to /images/bg-*
 * - PageBackground marker component renders data-bg
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PageBackground, usePageBackground } from '../PageBackground';

// Provide a stable window size so selectSuffix() returns 16.9
beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });
});

describe('usePageBackground', () => {
  it('returns background style with cover, fixed attachment, and gradient loading fallback', () => {
    const { result } = renderHook(() => usePageBackground());
    expect(result.current.backgroundSize).toBe('cover');
    expect(result.current.backgroundAttachment).toBe('fixed');
    expect(result.current.backgroundPosition).toBe('center center');
    // AC4: deep navy gradient fallback (#0a0e1a → #111827) painted while art loads
    expect(result.current.background).toContain('#0a0e1a');
    expect(result.current.background).toContain('#111827');
  });

  it('uses generic /images/bg-* path when no scene is provided', () => {
    const { result } = renderHook(() => usePageBackground());
    const bg = result.current.backgroundImage as string;
    expect(bg).toContain('/images/bg-');
    expect(bg).not.toContain('/images/backgrounds/');
  });

  it('uses scene-specific path when scene="auth"', () => {
    const { result } = renderHook(() => usePageBackground({ scene: 'auth' }));
    expect(result.current.backgroundImage).toContain('/images/backgrounds/auth/bg-');
  });

  it('falls back to the generic path when scene="hub" has no delivered art', () => {
    const { result } = renderHook(() => usePageBackground({ scene: 'hub' }));
    expect(result.current.backgroundImage).toContain('/images/bg-');
    expect(result.current.backgroundImage).not.toContain('/images/backgrounds/hub/');
  });

  it('prefers src over scene when both provided', () => {
    const { result } = renderHook(() =>
      usePageBackground({ scene: 'hub', src: '/images/bg-stable.webp' })
    );
    expect(result.current.backgroundImage).toContain('bg-stable.webp');
    expect(result.current.backgroundImage).not.toContain('backgrounds/hub');
  });

  it('uses the stable WebP background as a plain URL', () => {
    const { result } = renderHook(() => usePageBackground({ src: '/images/bg-stable.webp' }));
    const bg = result.current.backgroundImage as string;

    expect(bg).toContain("url('/images/bg-stable.webp')");
    expect(bg).not.toContain('image-set');
    expect(bg).not.toContain('.jpg');
  });

  it('uses the horse detail WebP background as a plain URL', () => {
    const { result } = renderHook(() => usePageBackground({ src: '/images/bg-horse-detail.webp' }));
    const bg = result.current.backgroundImage as string;

    expect(bg).toContain("url('/images/bg-horse-detail.webp')");
    expect(bg).not.toContain('image-set');
    expect(bg).not.toContain('.jpg');
  });

  it('uses the farrier WebP background as a plain URL', () => {
    const { result } = renderHook(() => usePageBackground({ src: '/assets/art/farrier.webp' }));
    const bg = result.current.backgroundImage as string;

    expect(bg).toContain("url('/assets/art/farrier.webp')");
    expect(bg).not.toContain('image-set');
    expect(bg).not.toContain('.jpg');
  });

  it('default scene resolves to generic path (not /backgrounds/default/)', () => {
    const { result } = renderHook(() => usePageBackground({ scene: 'default' }));
    const bg = result.current.backgroundImage as string;
    expect(bg).toContain('/images/bg-');
    expect(bg).not.toContain('/backgrounds/default/');
  });
});

describe('useResponsiveBackground resize', () => {
  it('re-evaluates path on window resize (debounced)', async () => {
    // D-3: verify the resize handler updates the background URL
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => usePageBackground({ scene: 'hub' }));
      expect(result.current.backgroundImage).toContain('bg-16.9.webp');

      // Simulate portrait resize
      act(() => {
        Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
        Object.defineProperty(window, 'innerHeight', { value: 812, writable: true });
        window.dispatchEvent(new Event('resize'));
        vi.advanceTimersByTime(200);
      });

      expect(result.current.backgroundImage).toContain('bg-9.16.webp');
    } finally {
      vi.useRealTimers();
      // restore to beforeEach defaults
      Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });
    }
  });
});

describe('PageBackground component', () => {
  it('renders a layered div with data-bg at z-[var(--z-below)]', () => {
    render(<PageBackground scene="stable" />);
    const el = screen.getByTestId('page-background');
    expect(el.getAttribute('data-bg')).toContain('.webp');
    // AC1: the layer is positioned below content
    expect((el as HTMLElement).style.position).toBe('fixed');
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('uses generic path when no scene', () => {
    render(<PageBackground />);
    const el = screen.getByTestId('page-background');
    expect(el.getAttribute('data-bg')).toContain('/images/bg-');
  });

  it('marker mode renders display:none div for legacy tests', () => {
    render(<PageBackground scene="auth" marker />);
    const el = screen.getByTestId('page-background');
    expect((el as HTMLElement).style.display).toBe('none');
  });
});
