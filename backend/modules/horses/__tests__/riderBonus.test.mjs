import { describe, it, expect } from '@jest/globals';
import { applyRiderModifiers } from '../../../utils/riderBonus.mjs';

describe('applyRiderModifiers', () => {
  it('returns score unchanged when both bonus and penalty are 0', () => {
    expect(applyRiderModifiers(100, 0, 0)).toBe(100);
  });

  it('applies bonus correctly', () => {
    // 100 * (1 + 0.10 - 0) = 110
    expect(applyRiderModifiers(100, 0.1, 0)).toBeCloseTo(110);
  });

  it('applies penalty correctly', () => {
    // 100 * (1 + 0 - 0.08) = 92
    expect(applyRiderModifiers(100, 0, 0.08)).toBeCloseTo(92);
  });

  it('applies bonus and penalty together', () => {
    // 100 * (1 + 0.05 - 0.03) = 102
    expect(applyRiderModifiers(100, 0.05, 0.03)).toBeCloseTo(102);
  });

  it('uses default 0 for optional parameters', () => {
    expect(applyRiderModifiers(50)).toBeCloseTo(50);
  });

  it('works with non-integer scores', () => {
    expect(applyRiderModifiers(75.5, 0.1, 0)).toBeCloseTo(83.05);
  });

  it('throws for negative score', () => {
    expect(() => applyRiderModifiers(-1, 0, 0)).toThrow('Score must be a non-negative number');
  });

  it('throws for non-number score', () => {
    expect(() => applyRiderModifiers('100', 0, 0)).toThrow('Score must be a non-negative number');
  });

  it('throws when bonus exceeds 0.10', () => {
    expect(() => applyRiderModifiers(100, 0.11, 0)).toThrow('Bonus percent must be between');
  });

  it('throws for negative bonus', () => {
    expect(() => applyRiderModifiers(100, -0.01, 0)).toThrow('Bonus percent must be between');
  });

  it('throws when penalty exceeds 0.08', () => {
    expect(() => applyRiderModifiers(100, 0, 0.09)).toThrow('Penalty percent must be between');
  });

  it('throws for negative penalty', () => {
    expect(() => applyRiderModifiers(100, 0, -0.01)).toThrow('Penalty percent must be between');
  });

  it('accepts zero score', () => {
    expect(applyRiderModifiers(0, 0.1, 0)).toBe(0);
  });

  it('accepts max valid bonus 0.10 and penalty 0.08', () => {
    // 200 * (1 + 0.10 - 0.08) = 200 * 1.02 = 204
    expect(applyRiderModifiers(200, 0.1, 0.08)).toBeCloseTo(204);
  });
});
