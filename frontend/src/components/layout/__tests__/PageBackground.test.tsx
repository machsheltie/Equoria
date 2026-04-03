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
import { render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { PageBackground, usePageBackground } from '../PageBackground';

// Provide a stable window size so selectSuffix() returns 16.9
beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });
});

describe('usePageBackground', () => {
  it('returns background style with cover and fixed attachment', () => {
    const { result } = renderHook(() => usePageBackground());
    expect(result.current.backgroundSize).toBe('cover');
    expect(result.current.backgroundAttachment).toBe('fixed');
    expect(result.current.backgroundPosition).toBe('center center');
    expect(result.current.backgroundColor).toBe('var(--bg-deep-space)');
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

  it('uses scene-specific path when scene="hub"', () => {
    const { result } = renderHook(() => usePageBackground({ scene: 'hub' }));
    expect(result.current.backgroundImage).toContain('/images/backgrounds/hub/bg-');
  });

  it('prefers src over scene when both provided', () => {
    const { result } = renderHook(() =>
      usePageBackground({ scene: 'hub', src: '/images/bg-stable.webp' })
    );
    expect(result.current.backgroundImage).toContain('bg-stable.webp');
    expect(result.current.backgroundImage).not.toContain('backgrounds/hub');
  });

  it('default scene resolves to generic path (not /backgrounds/default/)', () => {
    const { result } = renderHook(() => usePageBackground({ scene: 'default' }));
    const bg = result.current.backgroundImage as string;
    expect(bg).toContain('/images/bg-');
    expect(bg).not.toContain('/backgrounds/default/');
  });
});

describe('PageBackground marker', () => {
  it('renders data-testid and data-bg for test inspection', () => {
    render(<PageBackground scene="stable" />);
    const el = screen.getByTestId('page-background');
    expect(el.getAttribute('data-bg')).toContain('.webp');
  });

  it('uses generic path when no scene', () => {
    render(<PageBackground />);
    const el = screen.getByTestId('page-background');
    expect(el.getAttribute('data-bg')).toContain('/images/bg-');
  });
});
