/**
 * Unit tests for test-data factories (Equoria-tjyc)
 *
 * Verifies the createMock* helpers: sane defaults, override application,
 * shallow stat-merge semantics, and — critically — that each call produces
 * a fresh object so factory output cannot leak mutation between tests
 * (the core advantage of factories over static fixtures).
 */

import { describe, it, expect } from 'vitest';
import { createMockHorse, createMockUser, createMockTrainingSession } from '../index';

describe('createMockHorse (Equoria-tjyc)', () => {
  it('returns sane defaults when called with no arguments', () => {
    const horse = createMockHorse();
    expect(horse.id).toBe(1);
    expect(horse.name).toBe('Test Horse');
    expect(horse.breed).toBe('Thoroughbred');
    expect(horse.stats.speed).toBe(75);
    expect(horse.disciplineScores).toEqual({ Dressage: 70 });
  });

  it('applies top-level overrides', () => {
    const horse = createMockHorse({ name: 'Custom Name', age: 9 });
    expect(horse.name).toBe('Custom Name');
    expect(horse.age).toBe(9);
    // Untouched fields keep defaults
    expect(horse.breed).toBe('Thoroughbred');
  });

  it('shallow-merges stats so one stat can be overridden in isolation', () => {
    const horse = createMockHorse({ stats: { speed: 99 } as never });
    expect(horse.stats.speed).toBe(99);
    // Other stats fall back to defaults rather than becoming undefined
    expect(horse.stats.stamina).toBe(80);
    expect(horse.stats.focus).toBe(71);
  });

  it('produces a fresh object each call (no shared mutable state)', () => {
    const a = createMockHorse();
    const b = createMockHorse();
    expect(a).not.toBe(b);
    expect(a.stats).not.toBe(b.stats);
    a.name = 'Mutated';
    a.stats.speed = 0;
    expect(b.name).toBe('Test Horse');
    expect(b.stats.speed).toBe(75);
  });
});

describe('createMockUser (Equoria-tjyc)', () => {
  it('returns defaults and applies overrides', () => {
    expect(createMockUser().username).toBe('TestPlayer');
    expect(createMockUser({ money: 1 }).money).toBe(1);
  });

  it('produces a fresh object each call', () => {
    const a = createMockUser();
    const b = createMockUser();
    a.money = 0;
    expect(b.money).toBe(25000);
  });
});

describe('createMockTrainingSession (Equoria-tjyc)', () => {
  it('defaults to a 7-day cooldown from trainedAt', () => {
    const s = createMockTrainingSession();
    const delta = new Date(s.cooldownUntil).getTime() - new Date(s.trainedAt).getTime();
    expect(delta).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('recomputes cooldown when trainedAt is overridden', () => {
    const s = createMockTrainingSession({ trainedAt: '2026-01-01T00:00:00.000Z' });
    expect(s.cooldownUntil).toBe('2026-01-08T00:00:00.000Z');
  });

  it('respects an explicit cooldownUntil override', () => {
    const s = createMockTrainingSession({
      trainedAt: '2026-01-01T00:00:00.000Z',
      cooldownUntil: '2026-01-02T00:00:00.000Z',
    });
    expect(s.cooldownUntil).toBe('2026-01-02T00:00:00.000Z');
  });
});
