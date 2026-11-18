/**
 * Shared forum words for content moderation (Equoria-puj1e.3, owner rulings
 * q375 and q376).
 */

import type { ForumReportReason } from '@/lib/api/forum';
import { defaultDatetimeOptions, formatDateTime } from '@/lib/formatDate';
import { gameTimeZone } from '@/lib/gameTime';
import type { ApiError } from '@/lib/http/types';
import { userMessageFor } from '@/lib/http/userMessage';

/** q376: the mark on a post or thread only its author can see until a moderator accepts it. */
export const heldLabel = 'Awaiting a moderator';

const cooldownCode = 'forumPostingCooldown';

/** q380: a post with a word on the blocked list. Never names the word. */
export const blockedWordMessage =
  'This cannot be posted as written. Please change the wording and try again.';

/** q382: the reasons a player may give for reporting a post, in the players' words. */
export const reportReasonLabels: Record<ForumReportReason, string> = {
  rudeOrBullying: 'Rude or bullying',
  spamOrSelling: 'Spam or selling',
  personalInformation: 'Personal information',
  other: 'Other',
};

/**
 * What to say when a new thread or reply is refused. A steward's posting cooldown
 * names the moment it ends, in game time; anything else uses the shared copy.
 */
export function forumPostErrorMessage(error: unknown): string {
  const apiError = (error ?? {}) as Partial<ApiError>;
  if (apiError.statusCode === 400 && apiError.code === 'forumBlockedWord') {
    return blockedWordMessage;
  }
  if (apiError.statusCode === 403 && apiError.code === cooldownCode) {
    if (typeof apiError.until === 'string') {
      const when = formatDateTime(apiError.until, {
        ...defaultDatetimeOptions,
        timeZone: gameTimeZone,
        timeZoneName: 'short',
      });
      return `A steward has paused your forum posting until ${when}.`;
    }
    return 'A steward has paused your forum posting for now.';
  }
  return userMessageFor(error).message;
}
