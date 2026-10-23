/**
 * Stale-build recovery (Equoria-bvddn.32): one guarded reload, never a loop.
 * Real sessionStorage, real window events; only the page reload itself is a
 * recorded function because jsdom cannot navigate.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  installStaleBuildReload,
  isStaleBuildError,
  reloadOnceForNewBuild,
} from '../staleBuildReload';

beforeEach(() => window.sessionStorage.clear());
afterEach(() => window.sessionStorage.clear());

describe('isStaleBuildError', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://x/assets/HorsePage-abc.js',
    'error loading dynamically imported module: https://x/assets/a.js',
    'Importing a module script failed.',
    'Unable to preload CSS for /assets/a.css',
  ])('recognises %s', (message) => {
    expect(isStaleBuildError(new TypeError(message))).toBe(true);
  });

  it('recognises a ChunkLoadError by name', () => {
    const error = new Error('boom');
    error.name = 'ChunkLoadError';
    expect(isStaleBuildError(error)).toBe(true);
  });

  it('does not treat an ordinary render error as a stale build', () => {
    expect(isStaleBuildError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isStaleBuildError(null)).toBe(false);
    expect(isStaleBuildError('Failed to fetch dynamically imported module')).toBe(false);
  });
});

describe('reloadOnceForNewBuild', () => {
  it('reloads the first time', () => {
    const reload = vi.fn();
    expect(reloadOnceForNewBuild({ reload, now: 1_000_000 })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('refuses a second reload inside the guard window (no reload loop)', () => {
    const reload = vi.fn();
    reloadOnceForNewBuild({ reload, now: 1_000_000 });
    expect(reloadOnceForNewBuild({ reload, now: 1_010_000 })).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('allows another reload once the window has passed (a later deploy)', () => {
    const reload = vi.fn();
    reloadOnceForNewBuild({ reload, now: 1_000_000 });
    expect(reloadOnceForNewBuild({ reload, now: 1_000_000 + 61_000 })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});

describe('installStaleBuildReload', () => {
  it('reloads once when Vite reports a preload error, and stops listening when removed', () => {
    const reload = vi.fn();
    const remove = installStaleBuildReload({ reload });

    window.dispatchEvent(new Event('vite:preloadError'));
    window.dispatchEvent(new Event('vite:preloadError'));
    expect(reload).toHaveBeenCalledTimes(1);

    remove();
    window.sessionStorage.clear();
    window.dispatchEvent(new Event('vite:preloadError'));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
