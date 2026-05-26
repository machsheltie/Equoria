/**
 * Foal-development response-shape contract sentinel (Equoria-n3yw6).
 *
 * The real backend (GET /api/foals/:foalId/development) returns the
 * development stats nested under `data.development`, e.g. after the
 * apiClient `.data` unwrap:
 *
 *   { foal, development: { currentDay, bondingLevel, stressLevel,
 *     completedActivities, maxDay, enrichmentDay, enrichmentWindowOpen },
 *     availableEnrichmentActivities, activityHistory, availableActivities }
 *
 * FoalDetailPage / FoalDevelopmentTracker read `development.currentDay`,
 * `development.bondingLevel`, etc. at the TOP level — so the raw nested body
 * made every stat card render a placeholder. `normalizeFoalDevelopment`
 * flattens the nested block to the canonical flat FoalDevelopment shape.
 *
 * These are SENTINEL-POSITIVE tests: they feed the EXACT nested shape the
 * real backend emits and assert the flattened result exposes the real values
 * at the top level. If the normalizer were removed (the regression), the
 * `development` block would stay nested and `currentDay` would be undefined —
 * these tests would fail.
 */

import { describe, it, expect } from 'vitest';
import { normalizeFoalDevelopment, type RawFoalDevelopmentBody } from '@/lib/api-client';

describe('normalizeFoalDevelopment — foal-development contract (Equoria-n3yw6)', () => {
  it('flattens the real nested GET /development envelope-body to the flat contract', () => {
    // This is the EXACT shape foalModel.getFoalDevelopment returns, after the
    // apiClient `.data` unwrap.
    const rawNested: RawFoalDevelopmentBody = {
      // @ts-expect-error — `foal` exists on the real body but is not part of
      // the typed RawFoalDevelopmentBody; it is intentionally ignored.
      foal: { id: 42, name: 'TestFixture-Foal', age: 0, breed: 'X', owner: 'Y' },
      development: {
        currentDay: 3,
        bondingLevel: 72,
        stressLevel: 14,
        completedActivities: { 0: ['gentle_touch'], 1: ['soft_voice'] },
        maxDay: 6,
        enrichmentDay: 3,
        enrichmentWindowOpen: true,
      },
      availableEnrichmentActivities: [{ type: 'gentle_touch', name: 'Gentle Touch' }],
    };

    const flat = normalizeFoalDevelopment(rawNested);
    expect(flat).not.toBeNull();

    // Real values surface at the TOP level (this is what the UI reads).
    expect(flat?.currentDay).toBe(3);
    expect(flat?.maxDay).toBe(6);
    expect(flat?.bondingLevel).toBe(72);
    expect(flat?.stressLevel).toBe(14);
    expect(flat?.completedActivities).toEqual({ 0: ['gentle_touch'], 1: ['soft_voice'] });
    expect(flat?.enrichmentDay).toBe(3);
    expect(flat?.enrichmentWindowOpen).toBe(true);
    expect(flat?.availableEnrichmentActivities).toEqual([
      { type: 'gentle_touch', name: 'Gentle Touch' },
    ]);
  });

  it('does NOT leave development stats nested (the bug) — no double-nesting', () => {
    const rawNested: RawFoalDevelopmentBody = {
      development: { currentDay: 5, bondingLevel: 60, stressLevel: 5, maxDay: 6 },
    };
    const flat = normalizeFoalDevelopment(rawNested);
    // The regression symptom: a consumer reading `flat.currentDay` got
    // undefined because the value lived at flat.development.currentDay.
    expect(flat?.currentDay).not.toBeUndefined();
    expect(flat?.currentDay).toBe(5);
    // No fabricated placeholder fields leak into the contract.
    expect((flat as Record<string, unknown>).stage).toBeUndefined();
    expect((flat as Record<string, unknown>).progress).toBeUndefined();
    expect((flat as Record<string, unknown>).enrichmentLevel).toBeUndefined();
  });

  it('passes through the already-flat PUT /develop body', () => {
    // PUT /develop returns a flat body (no `development` wrapper).
    const rawFlat: RawFoalDevelopmentBody = {
      currentDay: 2,
      bondingLevel: 55,
      stressLevel: 18,
      completedActivities: {},
      maxDay: 6,
    };
    const flat = normalizeFoalDevelopment(rawFlat);
    expect(flat?.currentDay).toBe(2);
    expect(flat?.bondingLevel).toBe(55);
    expect(flat?.stressLevel).toBe(18);
    expect(flat?.maxDay).toBe(6);
  });

  it('returns null for a null/missing body (honest empty state, not a fabricated zeroed record)', () => {
    // The backend returns { data: null } when a foal has no development
    // record. The normalizer must surface that as null so the UI shows an
    // honest empty state — NOT a fake all-zero FoalDevelopment.
    expect(normalizeFoalDevelopment(null)).toBeNull();
    expect(normalizeFoalDevelopment(undefined)).toBeNull();
  });

  it('fills safe defaults for missing SUB-fields when a body IS present', () => {
    // A present-but-sparse body still produces a usable record (defaults for
    // the absent sub-fields), distinct from the null "no record" case above.
    const flat = normalizeFoalDevelopment({ development: { currentDay: 2 } });
    expect(flat).not.toBeNull();
    expect(flat?.currentDay).toBe(2);
    expect(flat?.maxDay).toBe(6);
    expect(flat?.bondingLevel).toBe(0);
    expect(flat?.stressLevel).toBe(0);
    expect(flat?.completedActivities).toEqual({});
    expect(flat?.availableEnrichmentActivities).toEqual([]);
  });
});
