/**
 * deriveLatestChapter + HorseCard NarrativeChip wiring (Equoria-pqzmf, Spec 11.3.12)
 *
 * NarrativeChip + deriveHorseChip were built but dead. This adds
 * deriveLatestChapter — a "latest chapter" one-line story derived from REAL
 * per-horse HorseSummary fields already on the hub (no N+1 queries), with
 * the spec's current / stale(>7d) / none states.
 */

import { describe, it, expect } from 'vitest';
import { deriveLatestChapter } from '../NarrativeChip';

const DAY = 24 * 60 * 60 * 1000;

describe('deriveLatestChapter (pqzmf, Spec 11.3.12)', () => {
  it('returns the "just arrived" none-state for a horse with no recorded events', () => {
    const chip = deriveLatestChapter({}, Date.now());
    expect(chip.text).toMatch(/just arrived/i);
    expect(chip.stale).toBe(false);
  });

  it('reports an injured horse as its latest chapter', () => {
    const chip = deriveLatestChapter({ healthStatus: 'injured' }, Date.now());
    expect(chip.text).toMatch(/recovering|vet|injured/i);
  });

  it('reports an in-foal mare as its latest chapter', () => {
    const now = Date.now();
    const chip = deriveLatestChapter(
      { inFoalSinceDate: new Date(now - 2 * DAY).toISOString() },
      now
    );
    expect(chip.text).toMatch(/foal/i);
    expect(chip.stale).toBe(false);
  });

  it('uses the most recent real event timestamp and is NOT stale within 7 days', () => {
    const now = Date.now();
    const chip = deriveLatestChapter({ lastGroomed: new Date(now - 2 * DAY).toISOString() }, now);
    expect(chip.text).toMatch(/groom/i);
    expect(chip.stale).toBe(false);
  });

  it('marks an event older than 7 days as stale', () => {
    const now = Date.now();
    const chip = deriveLatestChapter({ lastGroomed: new Date(now - 9 * DAY).toISOString() }, now);
    expect(chip.stale).toBe(true);
  });

  it('prefers the single most recent of multiple real events', () => {
    const now = Date.now();
    const chip = deriveLatestChapter(
      {
        lastGroomed: new Date(now - 5 * DAY).toISOString(),
        lastFedDate: new Date(now - 1 * DAY).toISOString(),
      },
      now
    );
    // Fed is more recent than groomed → fed is the latest chapter.
    expect(chip.text).toMatch(/fed/i);
    expect(chip.stale).toBe(false);
  });
});
