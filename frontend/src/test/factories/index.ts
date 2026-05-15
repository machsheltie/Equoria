/**
 * Test-data factory barrel (Equoria-tjyc)
 *
 * Per docs/architecture.md §Testing Patterns (test/factories/index.ts).
 * Import factories from '@/test/factories' rather than deep paths.
 *
 * Note: this is additive (architecture-spec option (c)). The existing
 * static fixtures under src/test/fixtures/ remain in place; factories
 * complement them for tests that need per-call mock objects with overrides.
 */

export { createMockHorse } from './horse';
export type { MockHorse, MockHorseStats } from './horse';

export { createMockUser } from './user';
export type { MockUser } from './user';

export { createMockTrainingSession } from './training';
export type { MockTrainingSession } from './training';
