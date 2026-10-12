/**
 * staffErrorMessage — refusal copy for the Steward's Office (Equoria-puj1e.1).
 *
 * A capability guard answers 403 STAFF_EMAIL_UNVERIFIED when a staff account's
 * email is not verified. That refusal is about the moderator, not the control,
 * so it must win over a control's own 403 copy (RoleChangeDialog's "This
 * account's role can't be changed here." would be wrong and misleading).
 */

import { describe, it, expect } from 'vitest';
import type { ApiError } from '@/lib/http/types';
import { CHECKIN_LAPSED, EMAIL_UNVERIFIED, staffErrorMessage } from '../staffMessages';

const refusal = (statusCode: number, code?: string): ApiError => ({
  message: 'raw server text',
  status: 'error',
  statusCode,
  code,
});

const ROLE_403 = { 403: "This account's role can't be changed here." };

describe('staffErrorMessage', () => {
  it('names an unverified email before the control’s own 403 copy', () => {
    const message = staffErrorMessage(refusal(403, 'STAFF_EMAIL_UNVERIFIED'), ROLE_403);

    expect(message).toBe(EMAIL_UNVERIFIED);
    expect(message).toBe('Verify your email to keep using the office.');
  });

  it('names an unverified email with no per-status map at all', () => {
    expect(staffErrorMessage(refusal(403, 'STAFF_EMAIL_UNVERIFIED'))).toBe(EMAIL_UNVERIFIED);
  });

  it('keeps the control’s 403 copy for any other 403', () => {
    expect(staffErrorMessage(refusal(403, 'STAFF_CAPABILITY_REQUIRED'), ROLE_403)).toBe(
      ROLE_403[403]
    );
  });

  it('leaves the 409 check-in refusal to the control’s own map', () => {
    expect(
      staffErrorMessage(refusal(409, 'STAFF_EMAIL_UNVERIFIED'), { 409: 'check-in copy' })
    ).toBe('check-in copy');
  });

  it('still names a lapsed check-in first', () => {
    expect(staffErrorMessage(refusal(403, 'STAFF_CHECKIN_REQUIRED'), ROLE_403)).toBe(
      CHECKIN_LAPSED
    );
  });
});
