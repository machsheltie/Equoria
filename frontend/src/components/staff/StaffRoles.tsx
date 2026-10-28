/**
 * StaffRoles — the Stewards area: who holds staff roles (Equoria-puj1e.1).
 *
 * Admin only (roles.manage). Lists current staff, finds a player by username,
 * and promotes or revokes a moderator. Both changes need a written reason and
 * a confirmation; the server refuses self, admin and stale changes, and those
 * refusals show at the confirm control with the reason kept.
 */

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField, Input } from '@/components/ui/form';
import { ErrorState, InlineError, SectionLoading } from '@/components/ui/state';
import { isCheckinRequired, useLookupUser, useStaffList } from '@/hooks/api/useStaff';
import type { AccountRole, StaffMember } from '@/lib/api/staff';
import { userMessageFor } from '@/lib/http/userMessage';
import RoleChangeDialog, { type RoleChange } from './RoleChangeDialog';
import { staffErrorMessage } from './staffMessages';
import StaffSection from './StaffSection';

const ROLE_WORDS: Record<AccountRole, string> = {
  user: 'a player',
  moderator: 'a moderator',
  admin: 'the admin',
  owner: 'the owner',
};

// Owner ruling 2026-10-23 (Equoria-4tleh): Owner (Head Admin), Admin, Moderator.
const staffTitles: Record<StaffMember['role'], string> = {
  user: 'Player',
  moderator: 'Moderator',
  admin: 'Admin',
  owner: 'Owner',
};

const LOOKUP_MESSAGES = {
  400: 'Enter a username.',
  404: 'No player goes by that name.',
};

function RoleControl({
  member,
  onChange,
  canAppointAdmin,
}: {
  member: StaffMember;
  onChange: (change: RoleChange) => void;
  canAppointAdmin: boolean;
}) {
  if (member.role !== 'moderator' && member.role !== 'user') {
    return null;
  }
  // Only the owner appoints admins (owner ruling 2026-10-23); the server
  // refuses everyone else, so the control is simply not offered.
  const appoint = canAppointAdmin ? (
    <Button
      variant="secondary"
      size="sm"
      aria-label={`Make ${member.username} an admin`}
      onClick={() => onChange({ member, toRole: 'admin' })}
    >
      Make admin
    </Button>
  ) : null;
  if (member.role === 'moderator') {
    return (
      <span className="flex gap-2">
        {appoint}
        <Button
          variant="destructive"
          size="sm"
          aria-label={`Revoke ${member.username}`}
          onClick={() => onChange({ member, toRole: 'user' })}
        >
          Revoke
        </Button>
      </span>
    );
  }
  return (
    <span className="flex gap-2">
      <Button
        variant="secondary"
        size="sm"
        aria-label={`Make ${member.username} a moderator`}
        onClick={() => onChange({ member, toRole: 'moderator' })}
      >
        Make moderator
      </Button>
      {appoint}
    </span>
  );
}

export interface StaffRolesProps {
  onCheckinRequired: () => void;
  /** The viewer holds roles.manage (the owner alone, q76). */
  canAppointAdmin?: boolean;
}

export function StaffRoles({ onCheckinRequired, canAppointAdmin = false }: StaffRolesProps) {
  const staff = useStaffList(true);
  const lookup = useLookupUser();
  const [username, setUsername] = useState('');
  const [found, setFound] = useState<StaffMember | null>(null);
  const [change, setChange] = useState<RoleChange | null>(null);

  const checkinLapsed = isCheckinRequired(staff.error);
  useEffect(() => {
    if (checkinLapsed) {
      onCheckinRequired();
    }
  }, [checkinLapsed, onCheckinRequired]);

  const find = (event: React.FormEvent) => {
    event.preventDefault();
    const name = username.trim();
    if (name === '') {
      return;
    }
    setFound(null);
    lookup.mutate(name, { onSuccess: (member) => setFound(member) });
  };

  const onChanged = (updated: StaffMember) => {
    if (found?.id === updated.id) {
      setFound(updated);
    }
  };

  let list: React.ReactNode;
  if (staff.isPending) {
    list = <SectionLoading label="Loading stewards" />;
  } else if (staff.isError) {
    const { title, message, retryable } = userMessageFor(staff.error);
    list = (
      <ErrorState
        title={title}
        message={message}
        retry={retryable ? { label: 'Try Again', onClick: () => void staff.refetch() } : undefined}
      />
    );
  } else if (staff.data.staff.length === 0) {
    list = (
      <EmptyState variant="first-use" title="No stewards" description="No one holds a role." />
    );
  } else {
    list = (
      <ul className="divide-y divide-[var(--border-muted)]">
        {staff.data.staff.map((member) => (
          <li key={member.id} className="flex items-center justify-between gap-3 py-3">
            <span className="text-[var(--text-primary)]">
              {member.username}{' '}
              <span className="text-sm text-role-secondary">
                — {staffTitles[member.role] ?? 'Steward'}
              </span>
            </span>
            <RoleControl member={member} onChange={setChange} canAppointAdmin={canAppointAdmin} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <StaffSection
      title="Stewards"
      intro="Moderators are players you trust with the game's care. Every change is written to the ledger."
    >
      {list}

      <form onSubmit={find} className="mt-6 flex flex-col gap-2" noValidate>
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="Player's username" className="min-w-0 flex-1">
            {(field) => (
              <Input
                {...field}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="off"
              />
            )}
          </FormField>
          <Button
            type="submit"
            variant="secondary"
            pending={lookup.isPending}
            disabled={username.trim() === ''}
          >
            Find
          </Button>
        </div>
        {lookup.isError && (
          <InlineError message={staffErrorMessage(lookup.error, LOOKUP_MESSAGES)} />
        )}
      </form>

      {found && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-[var(--text-primary)]">
            {found.username} is {ROLE_WORDS[found.role] ?? 'without a listed role'}.
          </p>
          <RoleControl member={found} onChange={setChange} canAppointAdmin={canAppointAdmin} />
        </div>
      )}

      <RoleChangeDialog change={change} onClose={() => setChange(null)} onChanged={onChanged} />
    </StaffSection>
  );
}

export default StaffRoles;
