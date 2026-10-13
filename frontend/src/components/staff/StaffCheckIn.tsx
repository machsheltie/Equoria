/**
 * StaffCheckIn — email-code check-in for this browser (Equoria-puj1e.1).
 *
 * Step one sends a six-digit code to the steward's verified email; step two
 * takes the code. A verified browser is trusted for 30 days (server-side), so
 * on success the office re-reads /me and opens. Failures stay at the control
 * that failed; the typed code is kept.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { InlineError } from '@/components/ui/state';
import { useRequestCheckin, useVerifyCheckin } from '@/hooks/api/useStaff';
import { staffErrorMessage } from './staffMessages';
import StaffSection from './StaffSection';

export interface StaffCheckInProps {
  /** Called once the browser is trusted. */
  onCheckedIn: () => void;
}

const REQUEST_MESSAGES = {
  409: 'Verify your email address first, then check in.',
  429: 'Too many codes requested. Wait a few minutes and try again.',
};

const VERIFY_MESSAGES = {
  400: "That code didn't work. Check it, or send a new one.",
  429: 'Too many tries. Wait a few minutes and try again.',
};

export function StaffCheckIn({ onCheckedIn }: StaffCheckInProps) {
  const [code, setCode] = useState('');
  // Kept in state so a resend in flight does not hide the code field.
  const [sent, setSent] = useState(false);
  const requestCode = useRequestCheckin();
  const verify = useVerifyCheckin();

  const send = () => {
    verify.reset();
    requestCode.mutate(undefined, { onSuccess: () => setSent(true) });
  };

  const requestError = requestCode.isError ? (
    <InlineError message={staffErrorMessage(requestCode.error, REQUEST_MESSAGES)} />
  ) : null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = code.trim();
    if (trimmed === '') {
      return;
    }
    verify.mutate(trimmed, { onSuccess: () => onCheckedIn() });
  };

  return (
    <StaffSection
      title="Check in"
      intro="Stewards check in once on each browser. We'll email you a six-digit code."
    >
      {!sent ? (
        <div className="flex flex-col items-start gap-2">
          <Button onClick={send} pending={requestCode.isPending}>
            Send my code
          </Button>
          {requestError}
        </div>
      ) : (
        <form onSubmit={submit} className="flex max-w-xs flex-col gap-3" noValidate>
          <p className="text-sm text-role-secondary">
            A code is on its way to your email. It lasts ten minutes.
          </p>
          <label htmlFor="staff-checkin-code" className="text-sm text-role-secondary">
            Your code
          </label>
          <Input
            id="staff-checkin-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            aria-invalid={verify.isError || undefined}
          />
          {verify.isError && (
            <InlineError message={staffErrorMessage(verify.error, VERIFY_MESSAGES)} />
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" pending={verify.isPending} disabled={code.trim() === ''}>
              Check in
            </Button>
            <Button
              type="button"
              variant="link"
              onClick={send}
              pending={requestCode.isPending}
              disabled={verify.isPending}
            >
              Send a new code
            </Button>
          </div>
          {requestError}
        </form>
      )}
    </StaffSection>
  );
}

export default StaffCheckIn;
