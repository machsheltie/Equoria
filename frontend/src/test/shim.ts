import { vi } from 'vitest';

// Expose jest global for libraries that expect it (like jest-canvas-mock)
// @ts-ignore
global.jest = vi;
