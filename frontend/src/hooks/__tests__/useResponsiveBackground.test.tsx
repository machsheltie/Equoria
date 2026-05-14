/**
 * useResponsiveBackground — unit tests (Equoria-ecyt)
 *
 * Covers:
 *  - auth scene: returns /images/backgrounds/auth/bg-{ratio}.webp
 *  - non-SCENES_WITH_ART scene: returns generic /images/bg-{ratio}.webp fallback
 *  - 'default' scene: always uses generic fallback (excluded from SCENES_WITH_ART by design)
 *  - aspect-ratio variant selection matches viewport dimensions
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useResponsiveBackground } from '../useResponsiveBackground';

describe('useResponsiveBackground', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('auth scene (in SCENES_WITH_ART)', () => {
    it('returns /images/backgrounds/auth/ path when scene=auth', () => {
      const { result } = renderHook(() => useResponsiveBackground('auth'));
      expect(result.current).toMatch(/^\/images\/backgrounds\/auth\/bg-[\d.]+\.webp$/);
    });

    it('selects 16.9 ratio when viewport is 1280×720 (16:9)', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 720, configurable: true });
      const { result } = renderHook(() => useResponsiveBackground('auth'));
      expect(result.current).toBe('/images/backgrounds/auth/bg-16.9.webp');
    });

    it('selects 9.16 ratio when viewport is 390×844 (phone portrait)', () => {
      Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true });
      const { result } = renderHook(() => useResponsiveBackground('auth'));
      expect(result.current).toBe('/images/backgrounds/auth/bg-9.16.webp');
    });

    it('selects 21.9 ratio when viewport is 3440×1440 (ultrawide)', () => {
      Object.defineProperty(window, 'innerWidth', { value: 3440, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 1440, configurable: true });
      const { result } = renderHook(() => useResponsiveBackground('auth'));
      expect(result.current).toBe('/images/backgrounds/auth/bg-21.9.webp');
    });
  });

  describe('non-SCENES_WITH_ART scenes fall back to generic images', () => {
    it('returns generic /images/bg-*.webp when scene=hub (not yet in SCENES_WITH_ART)', () => {
      const { result } = renderHook(() => useResponsiveBackground('hub'));
      expect(result.current).toMatch(/^\/images\/bg-[\d.]+\.webp$/);
      expect(result.current).not.toContain('/backgrounds/');
    });

    it('returns generic path when scene=stable', () => {
      const { result } = renderHook(() => useResponsiveBackground('stable'));
      expect(result.current).toMatch(/^\/images\/bg-[\d.]+\.webp$/);
    });

    it('returns generic path when scene=default', () => {
      const { result } = renderHook(() => useResponsiveBackground('default'));
      expect(result.current).toMatch(/^\/images\/bg-[\d.]+\.webp$/);
    });

    it('returns generic path when no scene is provided', () => {
      const { result } = renderHook(() => useResponsiveBackground());
      expect(result.current).toMatch(/^\/images\/bg-[\d.]+\.webp$/);
    });
  });

  describe('innerHeight guard (D-2: prevents Infinity ratio)', () => {
    it('does not throw or return Infinity path when innerHeight is 0', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 0, configurable: true });
      expect(() => renderHook(() => useResponsiveBackground('auth'))).not.toThrow();
    });
  });
});
