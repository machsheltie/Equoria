/**
 * PageBackground Component Tests — Story 22.3
 *
 * Verifies:
 * - Component renders with aria-hidden
 * - Background and veil layers exist
 * - Body background is set via useEffect
 * - scene prop changes the background path
 * - No scene → generic /images/bg-* path
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PageBackground } from '../PageBackground';

// Provide a stable window size so selectSuffix() returns 16.9
beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });
});

afterEach(() => {
  // Clean up body styles left by PageBackground useEffect
  document.body.style.backgroundImage = '';
  document.body.style.backgroundSize = '';
  document.body.style.backgroundPosition = '';
  document.body.style.backgroundRepeat = '';
  document.body.style.backgroundAttachment = '';
});

describe('PageBackground', () => {
  it('renders with aria-hidden', () => {
    render(<PageBackground />);
    const root = screen.getByTestId('page-background');
    expect(root).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders image layer and readability veil', () => {
    render(<PageBackground />);
    expect(screen.getByTestId('page-background-image')).toBeInTheDocument();
    expect(screen.getByTestId('page-background-veil')).toBeInTheDocument();
  });

  it('uses generic /images/bg-* path when no scene is provided', () => {
    render(<PageBackground />);
    const imgLayer = screen.getByTestId('page-background-image');
    expect(imgLayer.getAttribute('data-bg')).toContain('/images/bg-');
    expect(imgLayer.getAttribute('data-bg')).not.toContain('/images/backgrounds/');
  });

  it('sets body background-image via useEffect', () => {
    render(<PageBackground />);
    expect(document.body.style.backgroundImage).toContain('/images/bg-');
    expect(document.body.style.backgroundSize).toBe('cover');
    expect(document.body.style.backgroundAttachment).toBe('fixed');
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

  it('data-bg path ends in .webp', () => {
    render(<PageBackground scene="stable" />);
    const imgLayer = screen.getByTestId('page-background-image');
    const webpPath = imgLayer.getAttribute('data-bg') ?? '';
    expect(webpPath).toMatch(/\.webp$/);
  });

  it('veil has the correct rgba overlay color', () => {
    render(<PageBackground />);
    const veil = screen.getByTestId('page-background-veil');
    expect(veil.style.backgroundColor).toBe('rgba(5, 10, 20, 0.45)');
  });

  it('is fixed-position and pointer-events-none', () => {
    render(<PageBackground />);
    const root = screen.getByTestId('page-background');
    expect(root).toHaveClass('fixed');
    expect(root).toHaveClass('pointer-events-none');
  });

  it('renders 2 child divs (image layer + veil)', () => {
    const { container } = render(<PageBackground />);
    expect(container.firstChild).toBeInTheDocument();
    expect(container.firstChild?.childNodes).toHaveLength(2);
  });
});
