/**
 * canTrain mirrors the refusals the server makes (Equoria-du9bn).
 *
 * The client mirror used to enforce only the minimum age and the cooldown, so a
 * retired horse, or one the server refuses for its health, read as eligible.
 */

import { describe, test, expect } from 'vitest';
import { canTrain } from '../training-utils';

describe('canTrain mirrors the server refusals (Equoria-du9bn)', () => {
  const base = { id: 1, name: 'Thunder', age: 5, trainingCooldown: null };

  test('allows the last active year (20) and refuses 21 and over as retired', () => {
    expect(canTrain({ ...base, age: 20 }).eligible).toBe(true);
    const retired = canTrain({ ...base, age: 21 });
    expect(retired.eligible).toBe(false);
    expect(retired.reason).toContain('too old');
  });

  test('a refusal the server reported makes the horse ineligible, with its reason', () => {
    const reason = 'Thunder is in Bad health and cannot train. Feed and vet them first.';
    const refused = canTrain({ ...base, ineligibleReason: reason });
    expect(refused.eligible).toBe(false);
    expect(refused.reason).toBe(reason);
    expect(canTrain({ ...base, ineligibleReason: null }).eligible).toBe(true);
  });
});
