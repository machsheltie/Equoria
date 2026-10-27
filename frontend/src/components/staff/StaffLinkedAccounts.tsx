/**
 * StaffLinkedAccounts: who shares a device with a player, and which internet
 * addresses are busy (Equoria-x5n89, owner rulings q123-q126).
 *
 * Owner and Admins only (accounts.linked.view); the office never mounts it for a
 * Moderator. Every account counts, staff included. A busy address is a flag for a
 * steward to look at: it never blocks anyone. Plain ledger lists, no panels.
 */

import React, { useEffect } from 'react';
import { ErrorState, SectionLoading } from '@/components/ui/state';
import { isCheckinRequired, useFlaggedAddresses, useLinkedAccounts } from '@/hooks/api/useStaff';
import type { LinkedAccount } from '@/lib/api/staff';
import { formatDateTime } from '@/lib/formatDate';
import { userMessageFor } from '@/lib/http/userMessage';
import StaffSection from './StaffSection';

/** Game time is Eastern; the zone name keeps the time honest for any reader. */
const gameClockFormat: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/New_York',
  timeZoneName: 'short',
};

const roleWords: Record<string, string> = {
  owner: 'Head Admin',
  admin: 'Admin',
  moderator: 'Moderator',
  user: 'Player',
};

/** Under a player's conduct record: the other accounts seen on their devices. */
export function LinkedAccountsForPlayer({ userId }: { userId: string }) {
  const linked = useLinkedAccounts(userId);

  if (linked.isPending) {
    return <SectionLoading label="Looking for accounts on the same device" />;
  }
  if (linked.isError) {
    const { title, message } = userMessageFor(linked.error);
    return <ErrorState title={title} message={message} />;
  }
  const { accounts } = linked.data;
  return (
    <div>
      <h3 className="type-card-heading">Same device</h3>
      {accounts.length === 0 ? (
        <p className="mt-1 text-sm text-role-secondary">
          No other account has signed in from their devices in the last 90 days.
        </p>
      ) : (
        <ul className="mt-1 divide-y divide-[var(--border-muted)]">
          {accounts.map((account: LinkedAccount) => (
            <li key={account.id} className="py-2 text-sm">
              <span className="text-[var(--text-primary)]">{account.username}</span>{' '}
              <span className="text-role-secondary">
                ({roleWords[account.role] ?? 'Player'}), {account.sharedDevices}{' '}
                {account.sharedDevices === 1 ? 'device' : 'devices'} in common, last seen{' '}
                {formatDateTime(account.lastSeenAt, gameClockFormat)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface StaffFlaggedAddressesProps {
  onCheckinRequired: () => void;
}

/** A section of the office: addresses seen with more than four accounts. */
export function StaffFlaggedAddresses({ onCheckinRequired }: StaffFlaggedAddressesProps) {
  const flagged = useFlaggedAddresses();
  const checkinLapsed = isCheckinRequired(flagged.error);
  useEffect(() => {
    if (checkinLapsed) {
      onCheckinRequired();
    }
  }, [checkinLapsed, onCheckinRequired]);

  let body: React.ReactNode;
  if (flagged.isPending) {
    body = <SectionLoading label="Reading the sightings" />;
  } else if (flagged.isError) {
    const { title, message } = userMessageFor(flagged.error);
    body = <ErrorState title={title} message={message} />;
  } else if (flagged.data.addresses.length === 0) {
    body = (
      <p className="text-sm text-role-secondary">
        No address has been seen with more than four accounts in the last 90 days.
      </p>
    );
  } else {
    body = (
      <ul className="divide-y divide-[var(--border-muted)]">
        {flagged.data.addresses.map((row) => (
          <li key={row.ipAddress} className="py-3">
            <p className="text-[var(--text-primary)]">
              {row.ipAddress}{' '}
              <span className="text-sm text-role-secondary">— {row.accountCount} accounts</span>
            </p>
            <p className="mt-1 text-sm text-role-secondary">
              {row.accounts.map((account) => account.username).join(', ')}
            </p>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <StaffSection
      title="Busy addresses"
      intro="Internet addresses seen with more than four accounts in the last 90 days. A household, school or phone network is often the reason. This blocks no one."
    >
      {body}
    </StaffSection>
  );
}

export default StaffFlaggedAddresses;
