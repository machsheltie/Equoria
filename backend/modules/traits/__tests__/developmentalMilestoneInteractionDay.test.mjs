/**
 * A groom interaction's foal age is an Eastern game day — Equoria-kha18 (item 2).
 *
 * Owner ruling (Stacey, repeated 2026-10-09): every day count is an Eastern
 * calendar day. `dateOfBirth` is a date-only column (UTC midnight of the
 * Eastern birth date); an interaction's `createdAt` is an instant. From 20:00
 * to 24:00 EDT (19:00–24:00 EST) the millisecond delta between them already
 * holds one more whole day than the Eastern calendar, so an evening
 * interaction was counted on the next foal day: it fell out of a window on
 * that window's last day and into a window the day before it opened.
 *
 * assessMilestoneProgress is pure over its arguments, so no database and no
 * clock: the instants below are pinned.
 */

import { describe, it, expect } from '@jest/globals';

import { assessMilestoneProgress } from '../services/developmentalMilestones.mjs';
import { DEVELOPMENTAL_MILESTONES } from '../services/developmentalWindowDefinitions.mjs';

const CASES = [
  // [label, dob (date-only), evening instant on dob + 3 Eastern, evening instant on dob itself]
  [
    'summer, 20:30 EDT',
    new Date('2026-10-13T00:00:00.000Z'),
    new Date('2026-10-17T00:30:00.000Z'), // Fri 2026-10-16 20:30 EDT
    new Date('2026-10-14T00:30:00.000Z'), // Tue 2026-10-13 20:30 EDT
  ],
  [
    'winter, 22:30 EST',
    new Date('2026-12-08T00:00:00.000Z'),
    new Date('2026-12-12T03:30:00.000Z'), // Fri 2026-12-11 22:30 EST
    new Date('2026-12-09T03:30:00.000Z'), // Tue 2026-12-08 22:30 EST
  ],
];

const interaction = createdAt => ({
  createdAt,
  bondingChange: 5,
  stressChange: -2,
  quality: 'good',
});

describe.each(CASES)(
  'interaction foal day on the Eastern calendar (%s) — Equoria-kha18',
  (_label, dob, dayThreeEvening, birthDayEvening) => {
    // Low bond so basic_trust can only be achieved through a counted interaction.
    const horse = { dateOfBirth: dob, bondScore: 5, stressLevel: 5 };

    it('an interaction on the evening of foal day 3 counts toward imprinting (days 0-3)', () => {
      const result = assessMilestoneProgress(
        'basic_trust',
        DEVELOPMENTAL_MILESTONES.basic_trust,
        [interaction(dayThreeEvening)],
        5, // imprinting has closed: the post-window branch assesses it
        horse,
      );

      expect(result.achieved).toBe(true);
    });

    it('an interaction on the evening of foal day 0 does not count toward early socialization (opens day 1)', () => {
      const result = assessMilestoneProgress(
        'environmental_comfort',
        DEVELOPMENTAL_MILESTONES.environmental_comfort,
        [interaction(birthDayEvening)],
        5, // early socialization (days 1-21) is open: the in-window branch assesses it
        horse,
      );

      expect(result.completionPercentage).toBe(0);
    });
  },
);
