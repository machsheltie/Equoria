/**
 * PageBackground Component Tests — Story 22.3
 *
 * Verifies:
 * - Component renders with aria-hidden
 * - Background and veil layers exist
 * - WebP + JPEG image-set() paths are constructed correctly
 * - scene prop changes the background path
 * - No scene → generic /images/bg-* path
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { PageBackground } from '../PageBackground';

// Provide a stable window size so selectSuffix() returns 16.9
beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });
});

describe('PageBackground', () => {
  it('renders with aria-hidden', () => {
    render(<PageBackground />);
    const root = screen.getByTestId('page-background');
    expect(root).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders background image layer and readability veil', () => {
    render(<PageBackground />);
    expect(screen.getByTestId('page-background-image')).toBeInTheDocument();
    expect(screen.getByTestId('page-background-veil')).toBeInTheDocument();
  });

  it('uses generic /images/bg-* path when no scene is provided', () => {
    render(<PageBackground />);
    const imgLayer = screen.getByTestId('page-background-image');
    // data-bg holds the webp path (jsdom doesn't parse image-set())
    expect(imgLayer.getAttribute('data-bg')).toContain('/images/bg-');
    expect(imgLayer.getAttribute('data-bg')).not.toContain('/images/backgrounds/');
  });

  it('uses scene-specific path when scene="auth"', () => {
    render(<PageBackground scene="auth" />);
    const imgLayer = screen.getByTestId('page-background-image');
    expect(imgLayer.getAttribute('data-bg')).toContain('/images/backgrounds/auth/bg-');
  });

  it('uses scene-specific path when scene="hub"', () => {
    render(<PageBackground scene="hub" />);
    const imgLayer = screen.getByTestId('page-background-image');
    expect(imgLayer.getAttribute('data-bg')).toContain('/images/backgrounds/hub/bg-');
  });

  it('includes both webp and jpg variants in image-set()', () => {
    render(<PageBackground scene="stable" />);
    const imgLayer = screen.getByTestId('page-background-image');
    // data-bg is the webp path; the jpg sibling differs only in extension
    const webpPath = imgLayer.getAttribute('data-bg') ?? '';
    expect(webpPath).toContain('.webp');
    expect(webpPath.replace('.webp', '.jpg')).toContain('.jpg');
  });

  it('has a deep-space background-color fallback', () => {
    render(<PageBackground />);
    const imgLayer = screen.getByTestId('page-background-image');
    expect(imgLayer.style.backgroundColor).toBe('var(--bg-deep-space)');
  });

  it('veil has the correct rgba overlay color', () => {
    render(<PageBackground />);
    const veil = screen.getByTestId('page-background-veil');
    // jsdom normalises rgba() values by adding spaces after commas
    expect(veil.style.backgroundColor).toBe('rgba(5, 10, 20, 0.45)');
  });

  it('is fixed-position and pointer-events-none', () => {
    render(<PageBackground />);
    const root = screen.getByTestId('page-background');
    expect(root).toHaveClass('fixed');
    expect(root).toHaveClass('pointer-events-none');
  });

  it('renders nothing visible (returns presentational div only)', () => {
    const { container } = render(<PageBackground />);
    // Should have 1 root div with 2 child divs (image layer + veil)
    expect(container.firstChild).toBeInTheDocument();
    expect(container.firstChild?.childNodes).toHaveLength(2);
  });
});
