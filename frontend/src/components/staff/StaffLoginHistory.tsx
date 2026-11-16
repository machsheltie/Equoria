/**
 * StaffLoginHistory: where a player signed in from in the last 90 days, and the
 * other accounts seen on the same internet addresses (Equoria-puj1e.4, owner
 * ruling q102: login addresses and devices are kept 90 days, then cleared).
 *
 * Owner and Admins only (view.identity); the office never mounts it for a
 * Moderator. Devices are numbered per player ("device 1") and never shown as
 * the stored identifier. A shared address is a lead for a steward to weigh,
 * never proof and never a block. Authored CSS in styles/staffLoginHistory.css.
 */

import React from 'react';
import { ErrorState, SectionLoading } from '@/components/ui/state';
import { useLoginHistory } from '@/hooks/api/useStaff';
import type { LoginSighting, SameAddressAccount } from '@/lib/api/staff';
import { formatDateTime } from '@/lib/formatDate';
import { userMessageFor } from '@/lib/http/userMessage';
import '@/styles/staffLoginHistory.css';

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

const when = (iso: string) => formatDateTime(iso, gameClockFormat);

function SightingLine({ sighting }: { sighting: LoginSighting }) {
  return (
    <li className="login-history__line">
      <span className="login-history__name">{sighting.ipAddress}</span> on device {sighting.device},
      first seen {when(sighting.firstSeenAt)}, last seen {when(sighting.lastSeenAt)}
    </li>
  );
}

function SameAddressLine({ account }: { account: SameAddressAccount }) {
  return (
    <li className="login-history__line">
      <span className="login-history__name">{account.username}</span> (
      {roleWords[account.role] ?? 'Player'}), on {account.sharedAddresses.join(', ')}, last seen{' '}
      {when(account.lastSeenAt)}
    </li>
  );
}

/** Under a player's conduct record: their sign-ins and who shares an address. */
export function LoginHistoryForPlayer({ userId }: { userId: string }) {
  const history = useLoginHistory(userId);

  if (history.isPending) {
    return <SectionLoading label="Reading where they sign in from" />;
  }
  if (history.isError) {
    const { title, message } = userMessageFor(history.error);
    return <ErrorState title={title} message={message} />;
  }
  const { sightings, sameAddress } = history.data;
  return (
    <div className="login-history">
      <div>
        <h3 className="login-history__heading">Where they sign in from</h3>
        {sightings.length === 0 ? (
          <p className="login-history__note">No sign-ins in the last 90 days.</p>
        ) : (
          <ul className="login-history__list">
            {sightings.map((sighting) => (
              <SightingLine key={`${sighting.ipAddress}-${sighting.device}`} sighting={sighting} />
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="login-history__heading">Same address</h3>
        <p className="login-history__note">
          Households, schools and phone networks share addresses, so this is a lead to weigh, not
          proof.
        </p>
        {sameAddress.length === 0 ? (
          <p className="login-history__note">
            No other account has signed in from their addresses in the last 90 days.
          </p>
        ) : (
          <ul className="login-history__list">
            {sameAddress.map((account) => (
              <SameAddressLine key={account.id} account={account} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default LoginHistoryForPlayer;
