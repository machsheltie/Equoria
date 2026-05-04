import { vi } from 'vitest';

// Expose jest global for libraries that expect it (like jest-canvas-mock)
// @ts-expect-error — global.jest isn't typed; we're shimming it for jest-canvas-mock
global.jest = vi;
