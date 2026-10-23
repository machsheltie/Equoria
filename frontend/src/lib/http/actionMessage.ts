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
  rider: 'Retire a rider or raise your stable level before hiring another.',
  trainer: 'Retire a trainer or raise your stable level before hiring another.',
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

/** Refreshing a staff marketplace: a 400 is the refresh fee the balance can't cover. */
export const refreshRefused: ActionCopy = {
  400: "The marketplace couldn't be refreshed. Your balance may not cover the fee.",
};
