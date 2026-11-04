/**
 * CelestialThemeProvider Component Tests
 *
 * Tests the theme toggling via URL params and localStorage.
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryRouter, useSearchParams } from '@/test/utils';
import { CelestialThemeProvider } from '../CelestialThemeProvider';

describe('CelestialThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.classList.remove('celestial');
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    document.body.classList.remove('celestial');
    vi.restoreAllMocks();
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

  // Old contract: a first visit with no stored theme popped a one-time "Equoria has
  // a new look" toast and recorded it under 'equoria-theme-welcome-shown'. New
  // ruling q173: no pop-ups; the new look is its own announcement.
  it('a first visit applies the new look with no announcement', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <CelestialThemeProvider />
      </MemoryRouter>
    );
    expect(document.body.classList.contains('celestial')).toBe(true);
    expect(container.innerHTML).toBe('');
    expect(localStorage.getItem('equoria-theme-welcome-shown')).toBeNull();
  });

  // Gap 1 — URL param cleanup verified (TEA:TA audit 2026-04-10)
  it('removes ?theme param from URL after applying celestial theme', async () => {
    function LocationDisplay() {
      const [params] = useSearchParams();
      return <span data-testid="search-params">{params.toString()}</span>;
    }

    const { getByTestId } = render(
      <MemoryRouter initialEntries={['/?theme=celestial']}>
        <CelestialThemeProvider />
        <LocationDisplay />
      </MemoryRouter>
    );

    await act(async () => {});

    expect(getByTestId('search-params').textContent).not.toContain('theme');
  });

  // Gap 2 — safeLocalStorageGet throwing in THEME_KEY read path (TEA:TA audit 2026-04-10)
  it('defaults to celestial class when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Private browsing mode');
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <CelestialThemeProvider />
      </MemoryRouter>
    );

    expect(document.body.classList.contains('celestial')).toBe(true);
  });

  // Gap 3 — a localStorage write failing silently (TEA:TA audit 2026-04-10). Old
  // contract exercised the welcome-toast flag write; that write is gone (q173), so
  // the theme-preference write is the one that must fail without crashing.
  it('does not crash when localStorage.setItem throws', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    render(
      <MemoryRouter initialEntries={['/?theme=celestial']}>
        <CelestialThemeProvider />
      </MemoryRouter>
    );

    await act(async () => {});

    expect(document.body.classList.contains('celestial')).toBe(true);
  });
});
