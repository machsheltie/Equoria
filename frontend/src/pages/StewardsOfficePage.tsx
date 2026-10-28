/**
 * The Steward's Office (Equoria-puj1e.1, docs/features/staff-foundation.md).
 *
 * A hidden room for the game's stewards: the admin and the moderators. It is
 * reached only by its address and is not in any navigation. StewardGate
 * (components/staff/StewardGate.tsx) mounts this page only once GET /staff/me
 * has answered for a steward; for everyone else, and whenever /me stops
 * answering for one, the address renders exactly like an unknown one
 * (STAFF-CR-17).
 *
 * - /me decides everything. Untrusted browser → check in by email code.
 *   Trusted → the areas the account's capabilities allow.
 * - If any area or action is refused with STAFF_CHECKIN_REQUIRED (the 30-day
 *   trust ran out mid-visit), the page returns to check-in.
 * - If any area or action gets a 404, /me is asked again at once; a steward
 *   revoked mid-visit then gets /me's 404 and the gate replaces the office
 *   with the not-found page in place.
 * - Plain and open: a title, then each area under its own heading and rule.
 *   No dashboard tiles, no cards.
 */

import React, { useCallback, useState } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import StaffActionLog from '@/components/staff/StaffActionLog';
import StaffCheckIn from '@/components/staff/StaffCheckIn';
import StaffConduct from '@/components/staff/StaffConduct';
import { StaffFlaggedAddresses } from '@/components/staff/StaffLinkedAccounts';
import StaffQuarantinedShows from '@/components/staff/StaffQuarantinedShows';
import StaffRoles from '@/components/staff/StaffRoles';
import StaffTickets from '@/components/staff/StaffTickets';
import { useAuth } from '@/contexts/AuthContext';
import { useGatedStaffMe } from '@/components/staff/StewardGate';
import { isCheckinRequired, useStaffRevocationWatch } from '@/hooks/api/useStaff';
import NotFoundPage from './NotFoundPage';

export default function StewardsOfficePage() {
  const { user } = useAuth();
  const me = useGatedStaffMe();
  const [checkinLapsed, setCheckinLapsed] = useState(false);
  const onCheckinRequired = useCallback(() => setCheckinLapsed(true), []);
  useStaffRevocationWatch(onCheckinRequired);
  const onCheckedIn = useCallback(() => setCheckinLapsed(false), []);

  // The gate mounts the office only with a steward's /me in hand. A failed
  // background refetch keeps the areas (and any open dialog or half-written
  // form) on screen with the last good answer; its 404 is the gate's to act on.
  if (!me.data) {
    return <NotFoundPage />;
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
          {can('warn') && (
            <StaffConduct
              onCheckinRequired={onCheckinRequired}
              canLift={can('conduct.lift')}
              canSeeLinked={can('accounts.linked.view')}
            />
          )}
          {can('accounts.linked.view') && (
            <StaffFlaggedAddresses onCheckinRequired={onCheckinRequired} />
          )}
          {can('roles.manage') && (
            <StaffRoles
              onCheckinRequired={onCheckinRequired}
              canAppointAdmin={can('roles.manage')}
            />
          )}
          {can('shows.quarantine.resolve') && (
            <StaffQuarantinedShows onCheckinRequired={onCheckinRequired} />
          )}
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
