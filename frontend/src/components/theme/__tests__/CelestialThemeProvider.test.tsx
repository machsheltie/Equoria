/**
 * CelestialThemeProvider Component Tests
 *
 * Tests the theme toggling via URL params and localStorage.
 */

import React from 'react';
import { render } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from '@/test/utils';
import { CelestialThemeProvider } from '../CelestialThemeProvider';

describe('CelestialThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.classList.remove('celestial');
  });

  afterEach(() => {
    localStorage.clear();
    document.body.classList.remove('celestial');
  });

  it('adds celestial class by default when no localStorage or param', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <CelestialThemeProvider />
      </MemoryRouter>
    );
    expect(document.body.classList.contains('celestial')).toBe(true);
  });

  it('adds celestial class when ?theme=celestial param is present', () => {
    render(
      <MemoryRouter initialEntries={['/?theme=celestial']}>
        <CelestialThemeProvider />
      </MemoryRouter>
    );
    expect(document.body.classList.contains('celestial')).toBe(true);
    expect(localStorage.getItem('equoria-theme')).toBe('celestial');
  });

  it('removes celestial class when ?theme=default param is present', () => {
    document.body.classList.add('celestial');
    render(
      <MemoryRouter initialEntries={['/?theme=default']}>
        <CelestialThemeProvider />
      </MemoryRouter>
    );
    expect(document.body.classList.contains('celestial')).toBe(false);
    expect(localStorage.getItem('equoria-theme')).toBe('default');
  });

  it('removes celestial class when localStorage has "default"', () => {
    localStorage.setItem('equoria-theme', 'default');
    render(
      <MemoryRouter initialEntries={['/']}>
        <CelestialThemeProvider />
      </MemoryRouter>
    );
    expect(document.body.classList.contains('celestial')).toBe(false);
  });

  it('adds celestial class when localStorage has "celestial"', () => {
    localStorage.setItem('equoria-theme', 'celestial');
    render(
      <MemoryRouter initialEntries={['/']}>
        <CelestialThemeProvider />
      </MemoryRouter>
    );
    expect(document.body.classList.contains('celestial')).toBe(true);
  });

  it('renders nothing (returns null)', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <CelestialThemeProvider />
      </MemoryRouter>
    );
    expect(container.innerHTML).toBe('');
  });
});
