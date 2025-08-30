/**
 * Frontend Jest Setup for Equoria
 *
 * Configures Jest environment for React Native component testing
 * with necessary global setup.
 */

// Global test utilities
global.console = {
  ...console,
  // Suppress console.warn and console.error in tests unless needed
  warn: () => {},
  error: () => {},
};
