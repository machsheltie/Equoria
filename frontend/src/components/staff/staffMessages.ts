/**
 * Shared copy and formats for the Steward's Office (Equoria-puj1e.1).
 *
 * Failures:
 *
 * Wraps the shared mapper (userMessageFor). A lapsed check-in and an
 * unverified email are named first, whatever the control. Then a control may
 * name what a status means for its own request — a 409 on a role change is not a 409 on a ticket —
 * and anything it does not name falls through to the shared copy. Server
 * messages are never rendered.
 */

import { userMessageFor } from '@/lib/http/userMessage';
import { isCheckinRequired, statusOf } from '@/hooks/api/useStaff';
import type { TicketStatus } from '@/lib/api/staff';
import type { ApiError } from '@/lib/http/types';
import { DEFAULT_DATETIME_OPTIONS } from '@/lib/formatDate';
import { GAME_TIME_ZONE } from '@/lib/gameTime';

/** Game time is Eastern; the zone name keeps the time honest for any reader. */
export const STAFF_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  ...DEFAULT_DATETIME_OPTIONS,
  timeZone: GAME_TIME_ZONE,
  timeZoneName: 'short',
};

/** A steward whose account is no longer on staff or was erased (Equoria-2yugk). */
export const FORMER_STEWARD = 'a former steward';

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  declined: 'Declined',
};

export const CHECKIN_LAPSED =
  'Your check-in on this browser has lapsed. Reload the office to check in again.';

export const EMAIL_UNVERIFIED = 'Verify your email to keep using the office.';

/** The 403 a capability guard gives a staff account whose email is not verified. */
function isEmailUnverified(error: unknown): boolean {
  return statusOf(error) === 403 && (error as Partial<ApiError>).code === 'STAFF_EMAIL_UNVERIFIED';
}

export function staffErrorMessage(
  error: unknown,
  byStatus: Partial<Record<number, string>> = {}
): string {
  if (isCheckinRequired(error)) {
    return CHECKIN_LAPSED;
  }
  // Before the per-status maps: a control's own 403 copy (a role that can't
  // change) must not explain a refusal about the moderator's own email.
  if (isEmailUnverified(error)) {
    return EMAIL_UNVERIFIED;
  }
  const status = statusOf(error);
  if (status !== undefined && byStatus[status]) {
    return byStatus[status] as string;
  }
  return userMessageFor(error).message;
}
