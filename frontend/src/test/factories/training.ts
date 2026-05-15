/**
 * Training-session test-data factory (Equoria-tjyc)
 *
 * Implements the architecture spec's `createMockTrainingSession` factory
 * (docs/architecture.md §Testing Patterns, test/factories/training.ts).
 * Shape covers the training-dashboard / cooldown surface: which horse,
 * which discipline, when it was trained, and the resulting cooldown.
 */

export interface MockTrainingSession {
  id: number;
  horseId: number;
  discipline: string;
  trainedAt: string;
  cooldownUntil: string;
  statGained: string;
  pointsGained: number;
}

/**
 * Create a mock training session. Pass `overrides` to customize any field.
 * Defaults to a Dressage session trained "now" with a 7-day cooldown
 * (the canonical global training cooldown — see SECURITY.md).
 */
export function createMockTrainingSession(
  overrides: Partial<MockTrainingSession> = {}
): MockTrainingSession {
  const trainedAt = overrides.trainedAt ?? '2026-05-15T12:00:00.000Z';
  const cooldownUntil =
    overrides.cooldownUntil ??
    new Date(new Date(trainedAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: 1,
    horseId: 1,
    discipline: 'Dressage',
    statGained: 'precision',
    pointsGained: 5,
    ...overrides,
    trainedAt,
    cooldownUntil,
  };
}
