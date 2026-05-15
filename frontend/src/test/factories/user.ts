/**
 * User test-data factory (Equoria-tjyc)
 *
 * Implements the architecture spec's `createMockUser` factory pattern
 * (docs/architecture.md §Testing Patterns). There is no single canonical
 * `User` TS interface in the codebase, so this factory targets the
 * profile / dashboard shape consumed by the frontend (id/username/email/
 * level/xp/money). Structurally typed for the same reason as the horse
 * factory.
 */

export interface MockUser {
  id: string;
  username: string;
  email: string;
  level: number;
  xp: number;
  money: number;
  completedOnboarding: boolean;
}

/**
 * Create a mock user. Pass `overrides` to customize any field.
 */
export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: 'test-user-id',
    username: 'TestPlayer',
    email: 'test.player@example.com',
    level: 12,
    xp: 4200,
    money: 25000,
    completedOnboarding: true,
    ...overrides,
  };
}
