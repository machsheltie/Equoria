/**
 * StaffConduct: warn, freeze and ban a player (Equoria-w47x7, owner ruling q77).
 *
 * Find a player by username, read their standing and record, then act with a
 * written reason. The server decides who may act on whom (nobody on the owner or
 * themselves; moderators and admins never on each other) and its refusals show
 * at the confirm control, with the reason kept.
 */

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField, Input, Select, Textarea } from '@/components/ui/form';
import { ErrorState, InlineError, SectionLoading } from '@/components/ui/state';
import {
  isCheckinRequired,
  useConductAction,
  useConductRecord,
  useLookupConductPlayer,
} from '@/hooks/api/useStaff';
import type { ConductAction, ConductEntry, StaffMember } from '@/lib/api/staff';
import { formatDateTime } from '@/lib/formatDate';
import { userMessageFor } from '@/lib/http/userMessage';
import { staffErrorMessage } from './staffMessages';
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

const actionOptions = [
  { value: 'warn', label: 'Warn' },
  { value: 'freeze', label: 'Freeze' },
  { value: 'ban/account', label: 'Ban the account' },
  { value: 'ban/ip', label: 'Ban the IP address they last signed in from' },
  { value: 'ban/device', label: 'Ban the device they last signed in from' },
];

// Owner and Admins only (q101): a moderator cannot undo.
const liftOptions = [
  { value: 'lift/account', label: 'Lift the freeze or ban on the account' },
  { value: 'lift/ip', label: 'Lift the IP ban they caused' },
  { value: 'lift/device', label: 'Lift the device ban they caused' },
];

// Owner ruling q103: an IP ban can reach other players on a shared connection.
export const ipBanWarning =
  'An IP ban can also block other players who share this connection, such as a household, school or library. Consider banning the device first.';

const freezeOptions = [
  { value: '1', label: '1 day' },
  { value: '3', label: '3 days' },
  { value: '7', label: '7 days' },
];

const entryWords: Record<ConductEntry['kind'], string> = {
  warning: 'Warned',
  freeze: 'Frozen',
  ban: 'Banned',
  lift: 'Lifted',
};

const lookupMessages = { 400: 'Enter a username.', 404: 'No player goes by that name.' };

const actMessages = {
  400: 'Write a reason first.',
  403: 'You cannot act on this account.',
  404: 'That player no longer exists.',
  409: 'That was already done, or the player has not been seen signing in from anywhere you can ban.',
};

function standingLine(standing: { state: string; endsAt?: string }): string {
  if (standing.state === 'banned') return 'Banned.';
  if (standing.state === 'frozen' && standing.endsAt) {
    return `Frozen until ${formatDateTime(standing.endsAt, gameClockFormat)}.`;
  }
  return 'In good standing.';
}

function ConductPanel({ member, canLift }: { member: StaffMember; canLift: boolean }) {
  const record = useConductRecord(member.id);
  const act = useConductAction(member.id);
  const [action, setAction] = useState<ConductAction>('warn');
  const [days, setDays] = useState<'1' | '3' | '7'>('1');
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();

  const confirm = (event: React.FormEvent) => {
    event.preventDefault();
    if (trimmed === '') return;
    act.mutate(
      {
        action,
        reason: trimmed,
        ...(action === 'freeze' ? { days: Number(days) as 1 | 3 | 7 } : {}),
      },
      { onSuccess: () => setReason('') }
    );
  };

  let history: React.ReactNode;
  if (record.isPending) {
    history = <SectionLoading label="Loading the record" />;
  } else if (record.isError) {
    const { title, message } = userMessageFor(record.error);
    history = <ErrorState title={title} message={message} />;
  } else {
    history = (
      <>
        <p className="text-[var(--text-primary)]">
          {member.username}: {standingLine(record.data.standing)}
        </p>
        {record.data.records.length === 0 ? (
          <p className="mt-2 text-sm text-role-secondary">Nothing on their record.</p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--border-muted)]">
            {record.data.records.map((entry) => (
              <li key={entry.id} className="py-2 text-sm">
                <span className="text-[var(--text-primary)]">
                  {entryWords[entry.kind]}
                  {entry.kind === 'freeze' && entry.freezeDays
                    ? ` for ${entry.freezeDays} day${entry.freezeDays === 1 ? '' : 's'}`
                    : ''}
                </span>{' '}
                <span className="text-role-secondary">
                  ({formatDateTime(entry.createdAt, gameClockFormat)}): {entry.reason}
                </span>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div>{history}</div>
      <form onSubmit={confirm} className="flex flex-col gap-3" noValidate>
        <FormField label="Action">
          {(field) => (
            <Select
              {...field}
              value={action}
              options={canLift ? [...actionOptions, ...liftOptions] : actionOptions}
              onChange={(event) => setAction(event.target.value as ConductAction)}
            />
          )}
        </FormField>
        {action === 'ban/ip' && (
          <p role="note" className="text-sm text-role-secondary">
            {ipBanWarning}
          </p>
        )}
        {action === 'freeze' && (
          <FormField label="For how long">
            {(field) => (
              <Select
                {...field}
                value={days}
                options={freezeOptions}
                onChange={(event) => setDays(event.target.value as '1' | '3' | '7')}
              />
            )}
          </FormField>
        )}
        <FormField label="Reason" required>
          {(field) => (
            <Textarea
              {...field}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={1000}
            />
          )}
        </FormField>
        <div className="flex flex-col items-start gap-2">
          <Button
            type="submit"
            variant={action === 'warn' || action.startsWith('lift/') ? 'default' : 'destructive'}
            pending={act.isPending}
            disabled={trimmed === ''}
          >
            {[...actionOptions, ...liftOptions].find((option) => option.value === action)?.label ??
              'Confirm'}
          </Button>
          {act.isError && <InlineError message={staffErrorMessage(act.error, actMessages)} />}
          {act.isSuccess && (
            <p className="text-sm text-role-secondary">Done. It is in the ledger.</p>
          )}
        </div>
      </form>
    </div>
  );
}

export interface StaffConductProps {
  onCheckinRequired: () => void;
  /** The viewer holds conduct.lift (the owner and admins). */
  canLift?: boolean;
}

export function StaffConduct({ onCheckinRequired, canLift = false }: StaffConductProps) {
  const lookup = useLookupConductPlayer();
  const [username, setUsername] = useState('');
  const [found, setFound] = useState<StaffMember | null>(null);

  const checkinLapsed = isCheckinRequired(lookup.error);
  useEffect(() => {
    if (checkinLapsed) {
      onCheckinRequired();
    }
  }, [checkinLapsed, onCheckinRequired]);

  const find = (event: React.FormEvent) => {
    event.preventDefault();
    const name = username.trim();
    if (name === '') return;
    setFound(null);
    lookup.mutate(name, { onSuccess: (member) => setFound(member) });
  };

  return (
    <StaffSection
      title="Conduct"
      intro="Warn a player, freeze them for a day, three or seven, or ban them. Every action is written to the ledger."
    >
      <form onSubmit={find} className="flex flex-col gap-2" noValidate>
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="Player to review" className="min-w-0 flex-1">
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
            Find player
          </Button>
        </div>
        {lookup.isError && (
          <InlineError message={staffErrorMessage(lookup.error, lookupMessages)} />
        )}
      </form>
      {found && <ConductPanel key={found.id} member={found} canLift={canLift} />}
    </StaffSection>
  );
}

export default StaffConduct;
