/**
 * Test Utilities
 *
 * Helper functions and components for testing.
 */

import React from 'react';
import { BrowserRouter as RouterBrowserRouter, MemoryRouter as RouterMemoryRouter } from 'react-router-dom';

// Re-export everything from react-router-dom for convenience
export * from 'react-router-dom';

/**
 * BrowserRouter configured with v7 future flags
 * Use this in tests to suppress React Router v7 warnings
 *
 * This replaces the standard BrowserRouter from react-router-dom
 */
export const BrowserRouter: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <RouterBrowserRouter
    future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    }}
  >
    {children}
  </RouterBrowserRouter>
);

/**
 * MemoryRouter configured with v7 future flags
 * Use this in tests to suppress React Router v7 warnings
 *
 * This is useful for testing routing behavior without browser navigation
 */
export const MemoryRouter: React.FC<{
  children: React.ReactNode;
  initialEntries?: string[];
  initialIndex?: number;
}> = ({ children, initialEntries, initialIndex }) => (
  <RouterMemoryRouter
    initialEntries={initialEntries}
    initialIndex={initialIndex}
    future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    }}
  >
    {children}
  </RouterMemoryRouter>
);

/**
 * TestRouter - alias for BrowserRouter for backward compatibility
 * Use this in tests that reference TestRouter
 */
export const TestRouter = BrowserRouter;
