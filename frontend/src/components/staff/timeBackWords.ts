/**
 * Words for the Owner's outage tools (Equoria-puj1e.5). The server names
 * fields and refusals by code; the office never shows a code, only these.
 */

import { staffErrorMessage } from './staffMessages';
import type { ApiError } from '@/lib/http/types';

/** What each moved value is, in words, for "N <words>". */
const fieldWords: Record<string, string> = {
  'Horse.dateOfBirth': 'birth dates',
  'Horse.lastBredDate': 'last breedings',
  'Horse.inFoalSinceDate': 'pregnancies',
  'Horse.lastVettedDate': 'vet visits',
  'Horse.lastGroomed': 'groomings',
  'Horse.lastShod': 'shoeings',
  'Horse.lastFedDate': 'feedings',
  'Horse.trainingCooldown': 'training waits',
  'TrainingLog.trainedAt': 'training sessions',
  'GroomAssignment.createdAt': 'groom assignments',
  'GroomAssignment.startDate': 'groom start dates',
  'GroomInteraction.timestamp': 'grooming records',
  'GroomInteraction.createdAt': 'grooming record dates',
  'StaffMarketplaceState.lastRefresh': 'staff market refreshes',
  'Show.closeDate': 'show closing dates',
  'Show.runDate': 'show dates',
  'ClubElection.startsAt': 'club election openings',
  'ClubElection.endsAt': 'club election closings',
  'Groom.feeUnpaidSince': 'unpaid groom fees',
  'Groom.careerWeeks': 'grooms’ years',
  'Rider.careerWeeks': 'riders’ years',
  'Trainer.careerWeeks': 'trainers’ years',
  'Horse.age': 'horse ages',
  'FoalDevelopment.currentDay': 'foal development days',
};

/** Values the owner has not ruled on yet, which a time-back leaves alone. */
const unruledWords: Record<string, string> = {
  'Horse.hungerSince': 'hunger',
  'FoalDevelopment.finalDayEvaluatedAt': 'a foal’s last development day',
  'Rider.feeUnpaidSince': 'unpaid rider fees',
  'Rider.freeAgentSince': 'riders’ time as free agents',
  'RiderRetirementSchedule.noticeSentAt': 'rider retirement notices',
  'RiderRetirementSchedule.assignedAt': 'rider retirement notices',
  'HallOfFameNomination.weekStart': 'Hall of Fame rounds',
  'HallOfFameRound.weekStart': 'Hall of Fame rounds',
  'HallOfFameRound.startsAt': 'Hall of Fame rounds',
  'HallOfFameRound.endsAt': 'Hall of Fame rounds',
};

/** "3 groomings" lines for every field with a non-zero count, in a stable order. */
export function movedLines(fields: Record<string, number> | undefined): string[] {
  if (!fields) return [];
  return Object.entries(fields)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${count.toLocaleString()} ${fieldWords[key] ?? 'other dates'}`);
}

export function unruledLine(keys: string[]): string | null {
  const words = [...new Set(keys.map((key) => unruledWords[key] ?? 'other dates'))];
  return words.length === 0 ? null : `Left alone until you rule on them: ${words.join(', ')}.`;
}

/** "2 days" / "5 hours" / "40 minutes" for a pause. */
export function pauseWords(seconds: number): string {
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (seconds >= 86_400) {
    const days = Math.floor(seconds / 86_400);
    const hours = Math.round((seconds % 86_400) / 3600);
    return hours > 0 ? `${plural(days, 'day')} ${plural(hours, 'hour')}` : plural(days, 'day');
  }
  if (seconds >= 3600) return plural(Math.round(seconds / 3600), 'hour');
  return plural(Math.max(1, Math.round(seconds / 60)), 'minute');
}

const byCode: Record<string, string> = {
  staffFreshCodeInvalid: 'That code is not right, or it has run out. Email yourself a new one.',
  staffCheckinRateLimited: 'Too many codes asked for. Wait a few minutes and try again.',
  staffFreshCodePurposeInvalid: 'That code could not be sent. Try again.',
  timeBackJobsNotHeld: 'Hold the nightly jobs first.',
  timeBackOverlaps: 'Part of this outage has already been given back.',
  timeBackEndInFuture: 'The outage end cannot be in the future.',
  timeBackWindowTooLong: 'An outage longer than 30 days cannot be given back.',
  timeBackWindowInvalid: 'Enter when the outage began and ended; it must end after it began.',
  timeBackAlreadyUndone: 'This one has already been undone.',
  timeBackNotFound: 'That time-back is no longer on the list.',
  jobsAlreadyHeld: 'The nightly jobs are already held.',
  jobsNotHeld: 'The nightly jobs are not held.',
  jobsHeld: 'The nightly jobs are held. Release them first, then deliver the foals.',
};

/** The office's words for a refusal: the server's code first, then the shared copy. */
export function timeBackError(error: unknown): string {
  const code = typeof error === 'object' && error !== null ? (error as ApiError).code : undefined;
  if (typeof code === 'string' && byCode[code]) return byCode[code];
  return staffErrorMessage(error, { 403: 'Only the Owner can use these tools.' });
}
