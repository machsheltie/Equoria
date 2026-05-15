import { vi } from 'vitest';

// Expose jest global for libraries that expect it (like jest-canvas-mock)
// @ts-expect-error — global.jest isn't typed; we're shimming it for jest-canvas-mock
global.jest = vi;

// Signal to React that this environment supports act().
// Must be set before any React module loads (i.e. in the first setupFile).
// Without this, Radix UI components that schedule async focus/state updates
// (e.g. Tabs ArrowKey navigation) emit "not wrapped in act()" warnings even
// when userEvent handles them correctly.
// See: https://github.com/reactwg/react-18/discussions/102
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
