/**
 * User-safe copy for a refused ACTION (hire, refresh, join, vote, post…).
 *
 * `userMessageFor` is the one mapping point for transport failures, but its
 * 4xx copy ("Please check the highlighted fields…") assumes the player just
 * filled in a form. A refused hire, join or vote has no highlighted fields, and
 * the backend answers a business refusal (roster full, already a member,
 * election closed) with the same 4xx class as bad input. These helpers let an
 * action name what a status means FOR ITS OWN REQUEST and fall through to the
 * shared copy for everything it does not name.
 *
 * Same discipline as `userMessageFor` and `staffErrorMessage`: classify by
 * `ApiError.statusCode`, never echo `error.message`
 * (FRONTEND_ASYNC_STATE_DOCTRINE §4).
 */

import { userMessageFor } from './userMessage.js';

/** Copy an action supplies for the statuses it can name, keyed by HTTP status. */
export type ActionCopy = Partial<Record<number, string>>;

/**
 * Copy an action supplies for the machine-readable refusal codes it can name,
 * keyed by `ApiError.code`. A code says more than a status: two different
 * refusals can share a 400.
 */
export type ActionCodeCopy = Partial<Record<string, string>>;

function codeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const code = (error as { code: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function statusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) return undefined;
  const status = (error as { statusCode: unknown }).statusCode;
  return typeof status === 'number' ? status : undefined;
}

/**
 * The action's own copy for this failure, else the shared mapper's. A refusal
 * code the action names wins over the status copy; the status copy covers a
 * response with no code or a code the action does not name.
 * A network failure (0), expired session (401) and rate limit (429) always use
 * the shared copy: they say nothing about the action itself.
 */
export function actionMessageFor(
  error: unknown,
  copy: ActionCopy = {},
  codeCopy: ActionCodeCopy = {}
): string {
  const status = statusOf(error);
  if (status !== undefined && status !== 0 && status !== 401 && status !== 429) {
    const code = codeOf(error);
    const byCode = code ? codeCopy[code] : undefined;
    if (byCode) return byCode;
    const own = copy[status];
    if (own) return own;
  }
  return userMessageFor(error).message;
}

/**
 * Hiring from a staff marketplace. A 400 with no refusal code (an older server
 * answer) could be a full roster or an unaffordable hire, so this copy names
 * both honestly. A coded refusal gets `hireRefusalCodes` instead.
 */
export const hireRefused: ActionCopy = {
  400: "That hire couldn't go through. Your roster may be full or your balance may be short.",
};

/** The kinds of staff a player hires from a marketplace. */
export type HireStaffKind = 'rider' | 'trainer' | 'groom';

const rosterFullAdvice: Record<HireStaffKind, string> = {
  rider: 'Dismiss a rider or raise your stable level before hiring another.',
  // The trainer limit follows the player's level (owner ruling 2026-10-28, q245).
  trainer: 'Dismiss a trainer or raise your level before hiring another.',
  groom: 'Release a groom before hiring another.',
};

/**
 * The exact refusal for a coded staff hire 400 (Equoria-dosig): the backend's
 * `rosterCapReached` and `insufficientFunds`. Pass as the third argument of
 * `actionMessageFor` beside `hireRefused`.
 */
export function hireRefusalCodes(staff: HireStaffKind): ActionCodeCopy {
  return {
    rosterCapReached: `Your ${staff} roster is full. ${rosterFullAdvice[staff]}`,
    insufficientFunds: "Your balance doesn't cover this hire.",
  };
}

/**
 * The refusal code the four staff assign endpoints (groom, rider, trainer, and
 * the horse-page rider picker) answer for a retired horse, 21 and over and not in
 * foal (Equoria-70gu6). userMessageFor's 4xx copy ("check the highlighted
 * fields") is no answer to it. Pass as the third argument of `actionMessageFor`.
 */
export const assignStaffRefusalCodes: ActionCodeCopy = {
  horseRetired: 'Retired horses (21 and over) cannot be given a new groom, rider or trainer.',
};

/**
 * A refused training session. The backend answers cooldown, age and health
 * refusals with a 400, and its own wording is not player copy (Equoria-mr1kq).
 */
export const trainRefused: ActionCopy = {
  400: "That training session couldn't go ahead. The horse may be on cooldown, too young or in poor health.",
};

/**
 * The refusal code the train call answers for a horse with no assigned trainer
 * (owner ruling 2026-10-26, Equoria-r8a6h). Pass as the third argument of
 * `actionMessageFor` beside `trainRefused`.
 */
export const trainRefusalCodes: ActionCodeCopy = {
  trainerRequired: 'Assign a trainer to this horse before training it.',
};

/** A refused show entry, ridden or conformation (Equoria-mr1kq). */
export const enterShowRefused: ActionCopy = {
  400: "That horse can't be entered in this show right now.",
  404: "That show or horse couldn't be found. Reload and try again.",
  409: 'That entry conflicts with the show as it stands now. Reload and try again.',
};

/** A refused equip or unequip of tack or feed (Equoria-mr1kq). */
export const equipRefused: ActionCopy = {
  400: "That item can't be used that way.",
  404: "That item or horse couldn't be found. Reload and try again.",
  409: 'Your stable changed while that was in flight. Reload and try again.',
};

/** Refreshing a staff marketplace: a 400 is the refresh fee the balance can't cover. */
export const refreshRefused: ActionCopy = {
  400: "The marketplace couldn't be refreshed. Your balance may not cover the fee.",
};

/**
 * A refused show hosting (Equoria-oey96.13): the weekly limit, a prize the host
 * cannot cover and a name another show already has are coded refusals; the
 * 400 and 409 copy covers an older answer with no code.
 */
export const createShowRefused: ActionCopy = {
  400: "That show couldn't be hosted. Check the name, discipline, level and entry fee, and that your coins cover the prize.",
  409: "That show couldn't be hosted. You may have reached this week's limit, or the name is already taken.",
};

export const createShowRefusalCodes: ActionCodeCopy = {
  weeklyShowLimitReached:
    "You've hosted all the shows you can this week. A new week of hosting begins on Monday.",
  insufficientFunds:
    "Your coins don't cover the prize for that entry fee. Lower the entry fee, or hold a show once you have more coins.",
  showNameTaken: 'Another show already has that name. Give yours a different one.',
};

/**
 * Marketplace and profile refusals (owner ruling 2026-10-28, q161,
 * Equoria-bvddn.40): a failed listing, delisting, purchase, profile save or
 * craft shows its reason next to the button that failed, in plain words —
 * never the server's own message. None of these endpoints sends a refusal
 * code, so the copy is keyed by status and names each refusal that status can
 * mean for that request.
 */
export const listHorseRefused: ActionCopy = {
  400: "That horse couldn't be listed. Set a price from 100 to 9,999,999 coins, and check it isn't already for sale.",
  409: 'That horse changed while you were listing it. It may already be listed or sold.',
};

export const delistHorseRefused: ActionCopy = {
  400: "That horse isn't listed for sale any more.",
  409: 'That listing changed. The horse may already be sold or off the Marketplace.',
};

export const buyHorseRefused: ActionCopy = {
  400: "That horse couldn't be bought. Your coins may not cover the price, or it's no longer for sale.",
  404: "That horse couldn't be found. It may already have been sold.",
  409: 'That listing changed before your purchase went through. It may already be sold.',
};

export const saveProfileRefused: ActionCopy = {
  400: 'Check your username, stable name and bio, then try again.',
  409: 'That username is already taken. Choose a different one.',
};

export const craftItemRefused: ActionCopy = {
  400: "You don't have the coins or materials this recipe needs.",
  403: 'Your workshop needs an upgrade before you can craft this.',
  404: "That recipe couldn't be found. Reload and try again.",
  409: 'Your inventory changed while you were crafting. Try again.',
};

/**
 * Feed, inventory and Settings refusals (Equoria-c1sg6, same ruling as above:
 * q161). These pages toasted the server's message. Some of those messages are
 * already plain words ("Already fed today. Try again tomorrow."), but others on
 * the same status are not ("Unknown feed tier: elite", "packs must be an
 * integer ≥ 1", "Preference 'x' must be a boolean"), and none carries a code
 * to tell them apart, so each status gets one authored line.
 */
export const buyFeedRefused: ActionCopy = {
  400: "That feed couldn't be bought. Your coins may not cover it.",
  404: "That feed isn't in the shop any more. Reload and try again.",
};

export const feedHorseRefused: ActionCopy = {
  400: "That horse couldn't be fed. It may already have been fed today, or its feed may have run out. Equip or buy more feed and try again.",
  404: "That horse couldn't be found. Reload and try again.",
  409: 'Your feed changed while you were feeding. Try again.',
};

export const unequipItemRefused: ActionCopy = {
  400: "That item isn't on a horse any more.",
  404: "That item couldn't be found. Reload and try again.",
};

export const savePreferenceRefused: ActionCopy = {
  400: "That setting couldn't be saved. Reload Settings and try again.",
};

/** A refused password change (Equoria-c1sg6). */
export const changePasswordRefused: ActionCopy = {
  400: 'Enter your current password and a new one of at least 12 characters.',
};

/**
 * A refused password change. The backend answers a wrong current password with
 * a 401, which `actionMessageFor` reads as an ended session. An ended session
 * reaches this caller marked `sessionExpired` by the transport; any other 401
 * from this endpoint is the current password being refused.
 */
export function changePasswordMessageFor(error: unknown): string {
  const status = statusOf(error);
  const sessionExpired =
    typeof error === 'object' &&
    error !== null &&
    (error as { sessionExpired?: unknown }).sessionExpired === true;
  if (status === 401 && !sessionExpired) {
    return "Your current password isn't right. Check it and try again.";
  }
  return actionMessageFor(error, changePasswordRefused);
}
