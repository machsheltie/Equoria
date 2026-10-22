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

function statusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) return undefined;
  const status = (error as { statusCode: unknown }).statusCode;
  return typeof status === 'number' ? status : undefined;
}

/**
 * The action's own copy for this failure's status, else the shared mapper's.
 * A network failure (0), expired session (401) and rate limit (429) always use
 * the shared copy: they say nothing about the action itself.
 */
export function actionMessageFor(error: unknown, copy: ActionCopy = {}): string {
  const status = statusOf(error);
  if (status !== undefined && status !== 0 && status !== 401 && status !== 429) {
    const own = copy[status];
    if (own) return own;
  }
  return userMessageFor(error).message;
}

/**
 * Hiring from a staff marketplace. The backend answers a full roster and an
 * unaffordable hire with the same 400, so the copy names both honestly.
 */
export const hireRefused: ActionCopy = {
  400: "That hire couldn't go through. Your roster may be full or your balance may be short.",
};

/** Refreshing a staff marketplace: a 400 is the refresh fee the balance can't cover. */
export const refreshRefused: ActionCopy = {
  400: "The marketplace couldn't be refreshed. Your balance may not cover the fee.",
};
