/**
 * horseNamePolicy.ts — the horse-name rule, said on the surface the player types
 * into (Equoria-4fnro, Equoria-zalyb; OWNER RULINGS 2026-09-14).
 *
 * THE SERVER IS STILL THE VALIDATOR. `backend/modules/horses/services/
 * horseNamePolicy.mjs` decides what a horse may be called; nothing here can
 * admit a name it refuses, and nothing here is trusted by any endpoint. This
 * module exists so the interface can be HONEST BEFORE the request:
 *
 *   - the input can stop at the real limit rather than letting a player type a
 *     name the server will then refuse;
 *   - the counter can show her how much room is left;
 *   - a failure can be explained beside the field (InlineError) in Equoria's
 *     own voice, instead of echoing a server string — which
 *     FRONTEND_ASYNC_STATE_DOCTRINE §4 forbids outright.
 *
 * WHEN THE SERVER RULE CHANGES, CHANGE THIS WITH IT. The two are kept in step
 * by the tests either side of the boundary, not by a build-time import (the
 * backend module is ESM under `backend/`, outside the frontend's tsconfig
 * roots). The numbers below are small and the rule is stable; the cost of that
 * duplication is a comment, and the alternative — a surface that silently
 * disagrees with the server — is what Equoria-zalyb was filed about.
 *
 * MIRRORS, EXACTLY:
 *   - length: 1-40 raw UTF-16 units (`String.length`, the count Postgres
 *     stores), non-empty after trimming
 *   - characters: no `<`, no NUL. `>` IS allowed — the refusal of `<` is
 *     boundary hygiene, not a naming rule, and the owner ratified that scope on
 *     2026-09-14 (Equoria-du5qe).
 *   - no repair: an over-long name is refused, never silently shortened.
 */

/** The name a foal is born with, until her player names her (Equoria-4fnro). */
export const UNNAMED_HORSE_NAME = 'unnamed';

export const HORSE_NAME_MAX_LENGTH = 40;

export type HorseNameRejection = 'empty' | 'length' | 'characters';

/**
 * Why this candidate name cannot be sent, or null when it can.
 *
 * @param name - exactly what the player has typed, untrimmed
 */
export function horseNameRejection(name: string): HorseNameRejection | null {
  if (name.trim().length === 0) return 'empty';
  if (name.length > HORSE_NAME_MAX_LENGTH) return 'length';
  if (name.includes('<') || name.includes('\0')) return 'characters';
  return null;
}

/**
 * What to say to a player whose name was refused, beside the field she typed it
 * into. Copy — not a validator's wording — because this is read by someone
 * naming a horse, sometimes her first one.
 */
export function horseNameRejectionCopy(rejection: HorseNameRejection, name: string): string {
  switch (rejection) {
    case 'empty':
      return 'She needs a name — even a short one.';
    case 'length':
      return `That is ${name.length} characters; a horse name can be up to ${HORSE_NAME_MAX_LENGTH}. Trim ${name.length - HORSE_NAME_MAX_LENGTH} and she is ready.`;
    case 'characters':
      return 'A horse name cannot contain the "<" character. Try it without that one.';
    default:
      return 'That name cannot be used. Try another.';
  }
}

/** True when this horse has not been named yet, so the surface can invite one. */
export function isUnnamed(name: string | null | undefined): boolean {
  return name === UNNAMED_HORSE_NAME;
}
