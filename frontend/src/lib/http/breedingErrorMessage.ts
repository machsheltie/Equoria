/**
 * What the breeding surface says when a pairing is refused (Equoria-2yn9j).
 *
 * The backend answers a malformed request with the express-validator envelope,
 * whose message is the developer string 'Validation failed'; that must never
 * reach a player. The breeding rules' own refusals ('Insufficient funds', 'Mare
 * is already in foal.') are authored game copy about the pairing and stay
 * readable. Transport and server faults go through the shared taxonomy
 * (`userMessageFor`), never the raw body (FRONTEND_ASYNC_STATE_DOCTRINE s4).
 */

import { userMessageFor } from './userMessage.js';

const validationEnvelope = 'validation failed';

const pairingRefused =
  "Those two horses couldn't be paired as chosen. Check the sire and the dam and try again.";
const FALLBACK = "Breeding couldn't go ahead. Please try again.";

export function breedingErrorMessage(error: unknown): string {
  const candidate =
    typeof error === 'object' && error !== null
      ? (error as { statusCode?: unknown; message?: unknown })
      : {};
  const status = typeof candidate.statusCode === 'number' ? candidate.statusCode : undefined;
  const message = typeof candidate.message === 'string' ? candidate.message.trim() : '';

  // Not an ApiError: nothing trustworthy to say beyond a safe sentence.
  if (status === undefined) return FALLBACK;

  // A lost connection, an expired session, a rate limit, an access refusal, a
  // missing record or a server fault: the shared copy, never the body.
  if (status === 0 || status === 401 || status === 403 || status === 404 || status === 429) {
    return userMessageFor(error).message;
  }
  if (status >= 500) return userMessageFor(error).message;

  if (message.toLowerCase() === validationEnvelope) return pairingRefused;
  return message || FALLBACK;
}
