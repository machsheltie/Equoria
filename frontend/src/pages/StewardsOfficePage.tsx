/**
 * The Steward's Office (Equoria-puj1e.1, docs/features/staff-foundation.md).
 *
 * A hidden room for the game's stewards: the admin and the moderators. It is
 * reached only by its address and is not in any navigation. For anyone who is
 * not staff, GET /staff/me answers 404 and the page sends them home, exactly
 * as an unknown address would.
 *
 * - /me decides everything. Pending → the shared page loader. Untrusted
 *   browser → check in by email code. Trusted → the areas the account's
 *   capabilities allow.
 * - If any area is refused with STAFF_CHECKIN_REQUIRED (the 30-day trust ran
 *   out mid-visit), the page returns to check-in.
 * - Plain and open: a title, then each area under its own heading and rule.
 *   No dashboard tiles, no cards.
 */

import React, { useCallback, useState } from 'react';
import { Navigate } from 'react-router';
import { PageContainer } from '@/components/layout/PageContainer';
import StaffActionLog from '@/components/staff/StaffActionLog';
import StaffCheckIn from '@/components/staff/StaffCheckIn';
import StaffRoles from '@/components/staff/StaffRoles';
import StaffTickets from '@/components/staff/StaffTickets';
import { ErrorState, PageLoading } from '@/components/ui/state';
import { useAuth } from '@/contexts/AuthContext';
import { isCheckinRequired, statusOf, useStaffMe } from '@/hooks/api/useStaff';
import { userMessageFor } from '@/lib/http/userMessage';

export default function StewardsOfficePage() {
  const { user } = useAuth();
  const me = useStaffMe();
  const [checkinLapsed, setCheckinLapsed] = useState(false);
  const onCheckinRequired = useCallback(() => setCheckinLapsed(true), []);
  const onCheckedIn = useCallback(() => setCheckinLapsed(false), []);

  // A 404 — not staff, or staff access revoked mid-visit — always leaves.
  if (statusOf(me.error) === 404) {
    return <Navigate to="/" replace />;
  }
  if (me.isPending) {
    return <PageLoading />;
  }
  // Only a /me that never loaded replaces the office. A failed background
  // refetch keeps the areas (and any open dialog or half-written form) on
  // screen with the last good answer.
  if (!me.data) {
    const { title, message, retryable } = userMessageFor(me.error);
    return (
      <ErrorState
        severity="page"
        title={title}
        message={message}
        retry={retryable ? { label: 'Try Again', onClick: () => void me.refetch() } : undefined}
      />
    );
  }

  const { capabilities, trusted } = me.data;
  const can = (capability: string) => capabilities.includes(capability);
  const showCheckIn = !trusted || checkinLapsed || isCheckinRequired(me.error);

  return (
    <PageContainer variant="content" className="pb-12" data-testid="stewards-office">
      <header className="mb-8">
        <h1 className="font-[family-name:var(--font-announcer)] text-3xl font-bold text-[var(--text-primary)]">
          The Steward&apos;s Office
        </h1>
        <p className="mt-2 text-role-secondary">
          Where the game&apos;s stewards keep the ledger and answer each other&apos;s notes.
        </p>
        <div
          aria-hidden="true"
          className="mt-4 h-0.5 w-40"
          style={{ background: 'var(--gradient-gold-divider)' }}
        />
      </header>

      {showCheckIn ? (
        <StaffCheckIn onCheckedIn={onCheckedIn} />
      ) : (
        <div className="flex flex-col gap-10">
          {(can('ticket.file') || can('ticket.resolve')) && (
            <StaffTickets
              canFile={can('ticket.file')}
              canResolve={can('ticket.resolve')}
              onCheckinRequired={onCheckinRequired}
            />
          )}
          {can('roles.manage') && <StaffRoles onCheckinRequired={onCheckinRequired} />}
          {(can('log.view.own') || can('log.view.all')) && (
            <StaffActionLog
              selfId={user?.id === undefined ? undefined : String(user.id)}
              canSeeNames={can('roles.manage')}
              canFilter={can('log.view.all')}
              onCheckinRequired={onCheckinRequired}
            />
          )}
        </div>
      )}
    </PageContainer>
  );
}
