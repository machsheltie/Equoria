/**
 * developmentalWindowSystem — interactionAge regression test (Equoria-ka0p)
 *
 * Equoria-ka0p: assessMilestoneProgress's in-window filter (the else-if branch
 * for currentAge >= window.startDay) was computing
 *   (createdAt - dob) / (1000 * 60 * 60 * 1000)
 * instead of the companion line's
 *   (createdAt - dob) / (1000 * 60 * 60 * 24)
 *
 * The buggy divisor (1000*60*60*1000 = 3,600,000,000) produces values ~41.67x
 * smaller than days. For an interaction that occurred 10 days into a window,
 * the bug computed an "age" of 0 instead of 10 — so the
 * `interactionAge >= window.startDay` filter incorrectly EXCLUDED interactions
 * that fell inside the window for any window with startDay > 0.
 *
 * This test plants an interaction whose createdAt is N days after the foal's
 * dateOfBirth, asserts that assessMilestoneProgress's in-window branch counts
 * that interaction, and is the sentinel-positive guard for the divisor.
 *
 * No DB required — assessMilestoneProgress is a pure helper over its args.
 */

import { assessMilestoneProgress } from '../../modules/horses/index.mjs';

describe('assessMilestoneProgress — interactionAge in-window filter (Equoria-ka0p)', () => {
  /**
   * Build an interaction object shaped like a Prisma `GroomInteraction` row,
   * placed `daysAfterDob` calendar days after `dob`.
   */
  function makeInteraction(dob, daysAfterDob) {
    const createdAt = new Date(dob.getTime() + daysAfterDob * 24 * 60 * 60 * 1000);
    return {
      createdAt,
      interactionType: 'bonding',
      bondingChange: 5,
      stressChange: -2,
      quality: 'good',
    };
  }

  it('counts an interaction inside an open window (currentAge inside window range)', () => {
    // Foal born 25 days ago (real time). currentAge = 25 game-days.
    const dob = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000);
    const horse = { dateOfBirth: dob };

    // Use early_socialization (startDay:1, endDay:21) but mark currentAge as
    // 15 — within the window — so the else-if branch (in-window assessment)
    // runs, not the post-window branch.
    const milestoneName = 'environmental_comfort';
    const milestone = { window: 'early_socialization', requirement: 'varied_exposure', score: 15 };

    // Plant an interaction at day 10 (inside window 1..21).
    const interactionInside = makeInteraction(dob, 10);

    // Pre-fix: divisor 1000*60*60*1000 made interactionAge = floor(10/41.67) = 0,
    //          so the filter `interactionAge >= window.startDay (1)` returned false
    //          and the interaction was dropped. completionPercentage went to 0.
    // Post-fix: divisor 1000*60*60*24 makes interactionAge = 10, the filter
    //          passes, and the interaction is counted.
    const result = assessMilestoneProgress(
      milestoneName,
      milestone,
      [interactionInside],
      15, // currentAge in days
      horse,
    );

    expect(result).toBeDefined();
    expect(result.achieved).toBe(false); // not yet — window is still open
    // The critical sentinel: completionPercentage > 0 means the interaction
    // was included in calculatePartialCompletion. Pre-fix this was always 0
    // for any startDay > 0 window because no interactions survived the filter.
    expect(result.completionPercentage).toBeGreaterThan(0);
  });

  it('excludes an interaction that occurred before the window opened', () => {
    // Negative-control: an interaction at day 0 must NOT be counted for a
    // window whose startDay is 1. Without this assertion, a too-permissive
    // divisor would also pass the first test for the wrong reason.
    const dob = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000);
    const horse = { dateOfBirth: dob };

    const milestoneName = 'environmental_comfort';
    const milestone = { window: 'early_socialization', requirement: 'varied_exposure', score: 15 };

    // Interaction at day 0 — before window.startDay = 1.
    const interactionBefore = makeInteraction(dob, 0);

    const result = assessMilestoneProgress(milestoneName, milestone, [interactionBefore], 15, horse);

    expect(result).toBeDefined();
    expect(result.achieved).toBe(false);
    // With ONLY an out-of-window interaction, completionPercentage stays at 0.
    expect(result.completionPercentage).toBe(0);
  });

  it('post-window branch counts interactions whose interactionAge falls in [startDay, endDay]', () => {
    // Companion-line sanity check: the post-window branch at line 838 already
    // uses the correct 1000*60*60*24 divisor. This test guards that branch so
    // a future "harmonize the two" refactor cannot silently re-break it.
    const dob = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    const horse = { dateOfBirth: dob };

    const milestoneName = 'environmental_comfort';
    const milestone = { window: 'early_socialization', requirement: 'varied_exposure', score: 15 };

    const interactionInside = makeInteraction(dob, 10); // window is 1..21

    const result = assessMilestoneProgress(
      milestoneName,
      milestone,
      [interactionInside],
      100, // currentAge past window.endDay = 21 → post-window branch
      horse,
    );

    expect(result).toBeDefined();
    // Whether achieved depends on assessMilestoneAchievement's internal
    // threshold; we only assert the filter let the interaction through —
    // either achieved=true OR completionPercentage>0.
    expect(result.achieved === true || result.completionPercentage > 0).toBe(true);
  });
});
