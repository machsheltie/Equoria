/**
 * StaffTickets — moderator → admin tickets (Equoria-puj1e.1).
 *
 * Moderators (ticket.file) file a ticket about a player, post, horse or show
 * and see their own; the admin (ticket.resolve) sees every ticket and sets its
 * status. A ticket opens in place to show its note and replies.
 */

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField, Input, Select, Textarea } from '@/components/ui/form';
import { GameCollapsibleTrigger } from '@/components/ui/game/GameCollapsible';
import { ErrorState, InlineError, SectionLoading } from '@/components/ui/state';
import { isCheckinRequired, useFileTicket, useStaffTickets } from '@/hooks/api/useStaff';
import type { StaffTicket, TicketTargetType } from '@/lib/api/staff';
import { formatDateTime } from '@/lib/formatDate';
import { userMessageFor } from '@/lib/http/userMessage';
import {
  FORMER_STEWARD,
  STAFF_TIME_OPTIONS,
  STATUS_LABELS,
  staffErrorMessage,
} from './staffMessages';
import StaffSection from './StaffSection';
import TicketThread from './TicketThread';

const TARGET_LABELS: Record<TicketTargetType, string> = {
  user: 'Player',
  post: 'Post',
  horse: 'Horse',
  show: 'Show',
};

const TARGET_OPTIONS = (Object.keys(TARGET_LABELS) as TicketTargetType[]).map((value) => ({
  value,
  label: TARGET_LABELS[value],
}));

type PlayerLookup = 'name' | 'id';

const LOOKUP_OPTIONS = [
  { value: 'name', label: 'By username' },
  { value: 'id', label: 'By ID' },
];

const FILE_MESSAGES = {
  400: 'Fill in every field. The note can be up to 2,000 characters.',
};

// The refusals that belong at the subject field, not at the button, keyed by
// the backend's own code; a revoked steward's 404 has no such code.
const SUBJECT_MESSAGES = new Map<unknown, string>([
  ['NO_PLAYER', 'No player by that name or ID.'],
  ['NOT_A_PLAYER', 'Tickets can only be about players, not stewards or yourself.'],
  ['NO_TARGET', 'Nothing by that ID.'],
]);

const subjectRefusal = (error: unknown) =>
  SUBJECT_MESSAGES.get((error as { code?: unknown } | null)?.code);

function FileTicketForm() {
  const [targetType, setTargetType] = useState<TicketTargetType>('user');
  const [lookup, setLookup] = useState<PlayerLookup>('name');
  // One value per way of naming, so switching never carries text across.
  const [username, setUsername] = useState('');
  const [targetId, setTargetId] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const file = useFileTicket();

  const subjectError = file.isError ? subjectRefusal(file.error) : undefined;
  const byName = targetType === 'user' && lookup === 'name';
  const subjectValue = byName ? username : targetId;
  const ready = subjectValue.trim() !== '' && category.trim() !== '' && note.trim() !== '';

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready) {
      return;
    }
    const subject = byName ? 'targetUsername' : 'targetId';
    file.mutate(
      {
        targetType,
        [subject]: subjectValue.trim(),
        category: category.trim(),
        note: note.trim(),
      },
      {
        onSuccess: () => {
          setTargetType('user');
          setLookup('name');
          setUsername('');
          setTargetId('');
          setCategory('');
          setNote('');
        },
      }
    );
  };

  return (
    <form onSubmit={submit} className="mt-8 flex flex-col gap-3" noValidate>
      <h3 className="font-semibold text-[var(--text-primary)]">File a ticket</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="About">
          {(field) => (
            <Select
              {...field}
              value={targetType}
              onChange={(event) => {
                file.reset();
                setTargetType(event.target.value as TicketTargetType);
              }}
              options={TARGET_OPTIONS}
            />
          )}
        </FormField>
        {targetType === 'user' && (
          <FormField label="Find the player">
            {(field) => (
              <Select
                {...field}
                value={lookup}
                onChange={(event) => {
                  file.reset();
                  setLookup(event.target.value as PlayerLookup);
                }}
                options={LOOKUP_OPTIONS}
              />
            )}
          </FormField>
        )}
        <FormField label={byName ? 'Their username' : 'Their ID'} error={subjectError}>
          {(field) => (
            <Input
              {...field}
              value={subjectValue}
              onChange={(event) => {
                file.reset();
                (byName ? setUsername : setTargetId)(event.target.value);
              }}
              maxLength={byName ? 100 : 64}
              autoComplete="off"
            />
          )}
        </FormField>
      </div>
      <FormField label="Category">
        {(field) => (
          <Input
            {...field}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            maxLength={40}
            autoComplete="off"
          />
        )}
      </FormField>
      <FormField label="Note">
        {(field) => (
          <Textarea
            {...field}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            maxLength={2000}
          />
        )}
      </FormField>
      <div className="flex flex-col items-start gap-2">
        <Button type="submit" pending={file.isPending} disabled={!ready}>
          File ticket
        </Button>
        {file.isError && !subjectError && (
          <InlineError message={staffErrorMessage(file.error, FILE_MESSAGES)} />
        )}
      </div>
    </form>
  );
}

/** "Player Willow", "Horse 345"; a player whose account is gone reads as a former player. */
function subjectOf(ticket: StaffTicket): string {
  if (ticket.targetType === 'user') {
    return ticket.targetUsername ? `Player ${ticket.targetUsername}` : 'a former player';
  }
  return `${TARGET_LABELS[ticket.targetType] ?? ticket.targetType} ${ticket.targetId}`;
}

function TicketRow({
  ticket,
  canResolve,
  onCheckinRequired,
}: {
  ticket: StaffTicket;
  canResolve: boolean;
  onCheckinRequired: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="py-3">
      <Collapsible open={open} onOpenChange={setOpen}>
        <GameCollapsibleTrigger className="min-h-11 flex-col items-start gap-1 text-left">
          <span className="text-base text-[var(--text-primary)]">
            Ticket #{ticket.id}: {ticket.category}
          </span>
          <span className="text-sm font-normal text-role-secondary">
            {subjectOf(ticket)}
            {` · filed by ${ticket.filedBy?.username ?? FORMER_STEWARD}`} ·{' '}
            {formatDateTime(ticket.createdAt, STAFF_TIME_OPTIONS)} ·{' '}
            {STATUS_LABELS[ticket.status] ?? ticket.status}
          </span>
        </GameCollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          {open && (
            <TicketThread
              ticketId={ticket.id}
              canResolve={canResolve}
              onCheckinRequired={onCheckinRequired}
            />
          )}
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

export interface StaffTicketsProps {
  canFile: boolean;
  canResolve: boolean;
  onCheckinRequired: () => void;
}

export function StaffTickets({ canFile, canResolve, onCheckinRequired }: StaffTicketsProps) {
  const tickets = useStaffTickets();

  const checkinLapsed = isCheckinRequired(tickets.error);
  useEffect(() => {
    if (checkinLapsed) {
      onCheckinRequired();
    }
  }, [checkinLapsed, onCheckinRequired]);

  let list: React.ReactNode;
  if (tickets.isPending) {
    list = <SectionLoading label="Loading tickets" />;
  } else if (tickets.isError) {
    const { title, message, retryable } = userMessageFor(tickets.error);
    list = (
      <ErrorState
        title={title}
        message={message}
        retry={
          retryable ? { label: 'Try Again', onClick: () => void tickets.refetch() } : undefined
        }
      />
    );
  } else if (tickets.data.tickets.length === 0) {
    list = (
      <EmptyState
        variant="first-use"
        title="No tickets yet"
        description={
          canFile
            ? 'Tickets you file for the admin appear here.'
            : 'Tickets the moderators file appear here.'
        }
      />
    );
  } else {
    list = (
      <ul className="divide-y divide-[var(--border-muted)]">
        {tickets.data.tickets.map((ticket) => (
          <TicketRow
            key={ticket.id}
            ticket={ticket}
            canResolve={canResolve}
            onCheckinRequired={onCheckinRequired}
          />
        ))}
      </ul>
    );
  }

  return (
    <StaffSection
      title="Tickets"
      intro={
        canFile
          ? 'Notes to the admin about a player, post, horse or show.'
          : 'Notes from the moderators. Open one to reply or set its status.'
      }
    >
      {list}
      {canFile && <FileTicketForm />}
    </StaffSection>
  );
}

export default StaffTickets;
