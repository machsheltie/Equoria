/**
 * Vitest Test Setup
 *
 * Global test configuration and matchers.
 */

import '@testing-library/jest-dom';
import 'jest-canvas-mock';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeAll, afterAll } from 'vitest';
import { server } from './msw/server';

// Equoria-t1isr: under full-suite parallel load (4 fork workers + a busy
// machine) testing-library's default 1000ms waitFor/findBy window starves —
// unrelated waitFor-heavy suites rotate red across identical-tree runs,
// failing at ~1010ms. 5000ms gives headroom under contention; an unloaded
// run is unaffected (polling resolves as soon as the condition holds).
// This changes patience, never assertions — a genuinely-broken condition
// still fails, just 4s later.
configure({ asyncUtilTimeout: 5000 });

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Suppress console logs during tests
global.console.log = () => {};
global.console.debug = () => {};
global.console.info = () => {};

// MSW setup for API mocking in tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock ResizeObserver
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverMock;
