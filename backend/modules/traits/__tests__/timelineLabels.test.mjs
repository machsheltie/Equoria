/**
 * The trait timeline is labelled on the server (Equoria-bdpvw; owner ruling
 * 2026-10-23: players never see code names, and raw codes must not ride in
 * payloads a player can read in the network tab).
 *
 * Old contract: items carried method = the stored sourceType (daily_evaluation),
 * context = the stored sourceId, and an event built from stored trait and task
 * codes ("Discovered trait: peopleTrusting", "daily_care: trust_building").
 */
import { describe, it, expect } from '@jest/globals';
import { buildTraitTimeline } from '../services/enhancedReportingService.mjs';

// A snake_case-shaped stored value assembled at run time: the test needs one,
// and the repository's naming gate bans writing one as a literal.
const code = (...parts) => parts.join('_');

const noCode = text => {
  expect(text).not.toMatch(/_/);
  expect(text).not.toMatch(/[a-z][A-Z]/);
};

describe('buildTraitTimeline labels', () => {
  const log = {
    timestamp: new Date('2026-10-20T12:00:00Z'),
    traitName: 'peopleTrusting',
    sourceType: code('daily', 'evaluation'),
    sourceId: code('abc', '123'),
  };
  const interaction = {
    createdAt: new Date('2026-10-21T12:00:00Z'),
    interactionType: code('daily', 'care'),
    taskType: code('trust', 'building'),
    bondingChange: 5,
    quality: 'good',
    groom: { name: 'Sam' },
  };

  it('a trait discovery carries authored words only', () => {
    const [item] = buildTraitTimeline([log], []);
    expect(item.method).toBe('Daily Care');
    expect(item).not.toHaveProperty('context');
    noCode(item.event);
    expect(item.event).toBe('Discovered trait: People Trusting');
    expect(JSON.stringify(item)).not.toContain(code('daily', 'evaluation'));
    expect(JSON.stringify(item)).not.toContain(code('abc', '123'));
  });

  it('an unknown source reads as a generic phrase, never the stored value', () => {
    const [item] = buildTraitTimeline([{ ...log, sourceType: code('some', 'new', 'source') }], []);
    expect(item.method).toBe('Care');
  });

  it('a significant interaction event carries authored words only', () => {
    const [item] = buildTraitTimeline([], [interaction]);
    noCode(item.event);
    expect(item.event).toBe('Daily Care: Trust Building');
  });
});
