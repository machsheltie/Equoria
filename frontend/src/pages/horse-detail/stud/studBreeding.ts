/**
 * The words and the mare-picker rules for breeding from a stallion's page
 * (Equoria-q4uem.9; owner rulings q89-q95, q104-q110).
 *
 * The picker greys out a mare the server would refuse and says why in plain
 * words; the server stays the authority (validateBreedingPair). Refusals reach
 * the screen as authored copy keyed by status or refusal code, never as the
 * server's message or a code name (FRONTEND_ASYNC_STATE_DOCTRINE §4; owner
 * ruling 2026-10-23).
 */

import type { BreedingHorse } from '@/lib/api/breedingHorse';
import { actionMessageFor } from '@/lib/http/actionMessage';
import type { BreedingKind } from '@/hooks/api/useStuds';

/** Horses breed only at ages 3-20, both sexes (owner ruling 2026-10-23). */
export const MIN_BREEDING_AGE = 3;
export const MAX_BREEDING_AGE = 20;

export interface MareChoice {
  mare: BreedingHorse;
  /** Why she cannot go to this stallion now; null when she can. */
  unavailable: string | null;
}

const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'America/New_York' });

function whyNot(mare: BreedingHorse, stallionBreed: string | null, now: Date): string | null {
  if (mare.inFoal) return 'already in foal';
  if (mare.pendingStudRequest) return 'a request is already waiting';
  if (mare.age < MIN_BREEDING_AGE) return 'under 3';
  if (mare.age > MAX_BREEDING_AGE) return 'retired from breeding';
  if (mare.breedingCooldownEndsAt) {
    const ends = new Date(mare.breedingCooldownEndsAt);
    if (ends.getTime() > now.getTime()) return `resting until ${weekday.format(ends)}`;
  }
  if (mare.displayedHealth === 'Bad') return 'in bad health';
  if (stallionBreed && mare.breedName !== stallionBreed) return 'a different breed';
  return null;
}

/** Her mares for this stallion, the ones who can go first, each with any reason she cannot. */
export function mareChoices(
  horses: readonly BreedingHorse[],
  stallionBreed: string | null,
  now: Date = new Date()
): MareChoice[] {
  return horses
    .filter((horse) => horse.sex === 'Mare')
    .map((mare) => ({ mare, unavailable: whyNot(mare, stallionBreed, now) }))
    .sort((a, b) => Number(a.unavailable !== null) - Number(b.unavailable !== null));
}

/** The button: "Breed to Moonrise Sonata (500)", or no fee for her own stallion. */
export function breedButtonLabel(stallionName: string, kind: BreedingKind, fee: number): string {
  if (kind === 'own') return `Breed to ${stallionName}`;
  return `Breed to ${stallionName} (${fee.toLocaleString()})`;
}

/** What happened, said in place of the picker. */
export function breedingDoneLine(
  kind: BreedingKind,
  mareName: string,
  stallionName: string,
  ownerName: string | null
): string {
  if (kind === 'private') {
    return ownerName
      ? `Your request for ${mareName} is with ${ownerName}.`
      : `Your request for ${mareName} has been sent.`;
  }
  return `${mareName} is in foal to ${stallionName}. The foal is due in 7 days.`;
}

/** A refused breeding, as the player reads it. */
export function breedingRefusal(error: unknown, stallionName: string): string {
  return actionMessageFor(
    error,
    {
      400: `That mare can't be bred to ${stallionName} right now.`,
      404: `${stallionName} is no longer standing at stud.`,
      409: `${stallionName}'s stud terms changed. Please look again.`,
    },
    {
      INSUFFICIENT_FUNDS: "You don't have enough coins for this stud fee.",
      STUD_FEE_CHANGED: `${stallionName}'s stud fee has changed. Please look again.`,
      MARE_HAS_PENDING_REQUEST: 'That mare already has a request waiting.',
      OWN_STALLION: `${stallionName} is your own stallion.`,
      STUD_OWNER_UNAVAILABLE: `${stallionName}'s owner can't take mares right now.`,
    }
  );
}

/** A refused stud standing change. */
export function standingRefusal(error: unknown, horseName: string): string {
  return actionMessageFor(
    error,
    { 400: `${horseName} can't stand at stud with that fee.` },
    { stallionTooYoungForStud: `${horseName} can stand at stud from age 3.` }
  );
}

/** A refused answer to a breeding request. */
export function requestAnswerRefusal(error: unknown): string {
  return actionMessageFor(
    error,
    {
      404: 'That request is no longer here.',
      409: 'This request has already been answered or withdrawn.',
    },
    {
      REQUEST_NOT_PENDING: 'This request has already been answered or withdrawn.',
      REQUEST_DECLINED: "The breeding couldn't go ahead, so the request was declined.",
      INSUFFICIENT_FUNDS:
        "The mare's owner can no longer pay the fee, so the request was declined.",
    }
  );
}
