/**
 * traitDiscovery — pure-function branch-coverage tests (Equoria-jkht)
 *
 * Targets checkEnrichmentDiscoveries — the only exported pure sync function.
 * No DB calls. No mocks.
 *
 * Branch map for checkEnrichmentDiscoveries:
 *   forEach activityCounts || 0  → first-occurrence (falsy left) / repeat (truthy left)
 *   reduce  activityCounts || 0  → activity done (truthy) / not done (falsy)
 *   if (completedCount >= minCount) → threshold met / not met (×4 ENRICHMENT entries)
 */

import { describe, it, expect } from '@jest/globals';
import { checkEnrichmentDiscoveries, ENRICHMENT_DISCOVERIES } from '../../utils/traitDiscovery.mjs';

// ENRICHMENT_DISCOVERIES entries and their thresholds:
//   SOCIALIZATION_COMPLETE:       activities=[social_interaction, group_play],         minCount=3
//   MENTAL_STIMULATION_COMPLETE:  activities=[puzzle_feeding, obstacle_course],        minCount=2
//   PHYSICAL_DEVELOPMENT_COMPLETE: activities=[free_exercise, controlled_movement],    minCount=4
//   ALL_ENRICHMENT_COMPLETE:      activities=[all 6],                                  minCount=6

function act(type) {
  return { activityType: type };
}

describe('checkEnrichmentDiscoveries()', () => {
  // ── Empty activities ──────────────────────────────────────────────────────

  it('returns empty array when activities is empty', () => {
    const result = checkEnrichmentDiscoveries([]);
    expect(result).toEqual([]);
  });

  // ── No thresholds met ────────────────────────────────────────────────────

  it('returns empty array when activity counts are below all thresholds', () => {
    const activities = [
      act('social_interaction'), // 1 (SOCIALIZATION needs 3)
      act('puzzle_feeding'), // 1 (MENTAL needs 2)
    ];
    const result = checkEnrichmentDiscoveries(activities);
    expect(result).toEqual([]);
  });

  // ── activityCounts || 0: repeated type (truthy left branch) ──────────────

  it('counts repeated activity types correctly (covers truthy-left || branch)', () => {
    // social_interaction × 3 meets SOCIALIZATION_COMPLETE (minCount=3)
    const activities = [act('social_interaction'), act('social_interaction'), act('social_interaction')];
    const result = checkEnrichmentDiscoveries(activities);
    const found = result.find(c => c.name === 'SOCIALIZATION_COMPLETE');
    expect(found).toBeDefined();
    expect(found.completedCount).toBe(3);
  });

  // ── MENTAL_STIMULATION_COMPLETE met ──────────────────────────────────────

  it('returns MENTAL_STIMULATION_COMPLETE when puzzle_feeding + obstacle_course total >= 2', () => {
    const activities = [act('puzzle_feeding'), act('obstacle_course')];
    const result = checkEnrichmentDiscoveries(activities);
    const found = result.find(c => c.name === 'MENTAL_STIMULATION_COMPLETE');
    expect(found).toBeDefined();
    expect(found.priority).toBe('high');
    expect(found.type).toBe('enrichment');
    expect(found.requiredCount).toBe(2);
  });

  // ── Reduce: activity in discovery list but count 0 (falsy || 0 branch) ──

  it('returns 0 completedCount for discovery activities not present (falsy-left || branch)', () => {
    // Only social_interaction present; MENTAL activities absent → completedCount=0 for MENTAL
    const activities = [
      act('social_interaction'),
      act('group_play'),
      act('social_interaction'),
      act('group_play'),
      act('group_play'), // total social+group = 5 → SOCIALIZATION met (>=3)
    ];
    const result = checkEnrichmentDiscoveries(activities);
    // MENTAL_STIMULATION should NOT be met (puzzle/obstacle not present)
    expect(result.find(c => c.name === 'MENTAL_STIMULATION_COMPLETE')).toBeUndefined();
    // SOCIALIZATION should be met
    expect(result.find(c => c.name === 'SOCIALIZATION_COMPLETE')).toBeDefined();
  });

  // ── PHYSICAL_DEVELOPMENT_COMPLETE met ────────────────────────────────────

  it('returns PHYSICAL_DEVELOPMENT_COMPLETE when total free+controlled >= 4', () => {
    const activities = [
      act('free_exercise'),
      act('free_exercise'),
      act('controlled_movement'),
      act('controlled_movement'),
    ];
    const result = checkEnrichmentDiscoveries(activities);
    const found = result.find(c => c.name === 'PHYSICAL_DEVELOPMENT_COMPLETE');
    expect(found).toBeDefined();
    expect(found.completedCount).toBe(4);
    expect(found.requiredCount).toBe(4);
  });

  // ── ALL_ENRICHMENT_COMPLETE met ───────────────────────────────────────────

  it('returns ALL_ENRICHMENT_COMPLETE when all 6 activity types provided (total >= 6)', () => {
    const activities = [
      act('social_interaction'),
      act('group_play'),
      act('puzzle_feeding'),
      act('obstacle_course'),
      act('free_exercise'),
      act('controlled_movement'),
    ];
    const result = checkEnrichmentDiscoveries(activities);
    const found = result.find(c => c.name === 'ALL_ENRICHMENT_COMPLETE');
    expect(found).toBeDefined();
    expect(found.priority).toBe('legendary');
    expect(found.completedCount).toBe(6);
  });

  // ── Multiple conditions met ───────────────────────────────────────────────

  it('returns multiple metConditions when several discoveries are satisfied', () => {
    const activities = [
      // social_interaction × 3 → SOCIALIZATION_COMPLETE
      act('social_interaction'),
      act('social_interaction'),
      act('social_interaction'),
      // puzzle_feeding × 2 → MENTAL_STIMULATION_COMPLETE
      act('puzzle_feeding'),
      act('obstacle_course'),
    ];
    const result = checkEnrichmentDiscoveries(activities);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.find(c => c.name === 'SOCIALIZATION_COMPLETE')).toBeDefined();
    expect(result.find(c => c.name === 'MENTAL_STIMULATION_COMPLETE')).toBeDefined();
  });

  // ── Return shape ─────────────────────────────────────────────────────────

  it('returned conditions have name, description, priority, type, completedCount, requiredCount', () => {
    const activities = [act('puzzle_feeding'), act('obstacle_course')];
    const result = checkEnrichmentDiscoveries(activities);
    expect(result.length).toBeGreaterThan(0);
    const cond = result[0];
    expect(cond).toHaveProperty('name');
    expect(cond).toHaveProperty('description');
    expect(cond).toHaveProperty('priority');
    expect(cond.type).toBe('enrichment');
    expect(typeof cond.completedCount).toBe('number');
    expect(typeof cond.requiredCount).toBe('number');
  });

  // ── Constants are exported and well-formed ────────────────────────────────

  it('ENRICHMENT_DISCOVERIES has 4 entries each with activities array and minCount', () => {
    const entries = Object.entries(ENRICHMENT_DISCOVERIES);
    expect(entries.length).toBe(4);
    for (const [, discovery] of entries) {
      expect(Array.isArray(discovery.activities)).toBe(true);
      expect(typeof discovery.minCount).toBe('number');
      expect(discovery.minCount).toBeGreaterThan(0);
    }
  });
});
