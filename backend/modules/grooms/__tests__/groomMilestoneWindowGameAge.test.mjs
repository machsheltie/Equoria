/**
 * Equoria-xggat: the groom interaction's milestone window stops at game age 3.
 *
 * OLD CONTRACT: the window lookup stopped at 1095 elapsed days (~3 real years).
 * NEW RULING (owner, 2026-10-19, decision 18): "under 3" is the horse's GAME
 * age, the age the game shows: 1 game-year = 7 days, so age 3 = 21 days.
 */
import { describe, it, expect } from '@jest/globals';
import { getCurrentMilestoneWindow } from '../controllers/groomInteractionController.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';

const bornDaysAgo = days => gameCalendarDate(new Date(), -days);

describe('getCurrentMilestoneWindow uses game age (Equoria-xggat)', () => {
  it('names the window for a horse of game age 2 (20 days old)', () => {
    expect(getCurrentMilestoneWindow(bornDaysAgo(20))).toBe('trust_handling_2');
  });

  it('returns null once the horse is game age 3 (21 days old)', () => {
    expect(getCurrentMilestoneWindow(bornDaysAgo(21))).toBeNull();
  });

  it('returns null for a horse inside the old 28-day window but past game age 3', () => {
    expect(getCurrentMilestoneWindow(bornDaysAgo(25))).toBeNull();
  });
});
