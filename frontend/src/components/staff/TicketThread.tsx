/**
 * TicketThread — one ticket opened in place (Equoria-puj1e.1).
 *
 * Loads the ticket with its replies, lets either party reply, and gives the
 * admin (ticket.resolve) the status control. Failures stay at the control;
 * a typed reply is kept until the server accepts it.
 */

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField, Select, Textarea } from '@/components/ui/form';
import { ErrorState, InlineError, SectionLoading } from '@/components/ui/state';
import {
  isCheckinRequired,
  useReplyToTicket,
  useSetTicketStatus,
  useStaffTicket,
} from '@/hooks/api/useStaff';
import type { StaffTicketWithReplies, TicketStatus } from '@/lib/api/staff';
import { formatDateTime } from '@/lib/formatDate';
import { userMessageFor } from '@/lib/http/userMessage';
import {
  FORMER_STEWARD,
  STAFF_TIME_OPTIONS,
  STATUS_LABELS,
  staffErrorMessage,
} from './staffMessages';

const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as TicketStatus[]).map((value) => ({
  value,
  label: STATUS_LABELS[value],
}));

const REPLY_MESSAGES = {
  400: 'Write a reply first (2,000 characters at most).',
  404: 'That ticket is no longer there.',
};

const STATUS_MESSAGES = {
  404: 'That ticket is no longer there.',
  409: 'The ticket changed while you were working. Reload it and try again.',
};

function ReplyForm({ ticketId }: { ticketId: number }) {
  const [body, setBody] = useState('');
  const reply = useReplyToTicket(ticketId);
  const trimmed = body.trim();

  const send = (event: React.FormEvent) => {
    event.preventDefault();
    if (trimmed === '') {
      return;
    }
    reply.mutate(trimmed, { onSuccess: () => setBody('') });
  };

  return (
    <form onSubmit={send} className="flex flex-col gap-2" noValidate>
      <FormField label="Your reply">
        {(field) => (
          <Textarea
            {...field}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            maxLength={2000}
          />
        )}
      </FormField>
      <div className="flex flex-col items-start gap-2">
        <Button
          type="submit"
          variant="secondary"
          pending={reply.isPending}
          disabled={trimmed === ''}
        >
          Send reply
        </Button>
        {reply.isError && <InlineError message={staffErrorMessage(reply.error, REPLY_MESSAGES)} />}
      </div>
    </form>
  );
}

function StatusControl({ ticket }: { ticket: StaffTicketWithReplies }) {
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const update = useSetTicketStatus(ticket.id);

  // Follow the server's status after a refetch.
  useEffect(() => setStatus(ticket.status), [ticket.status]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Status" className="min-w-[12rem]">
          {(field) => (
            <Select
              {...field}
              value={status}
              onChange={(event) => setStatus(event.target.value as TicketStatus)}
              options={STATUS_OPTIONS}
            />
          )}
        </FormField>
        <Button
          variant="secondary"
          onClick={() => update.mutate(status)}
          pending={update.isPending}
          disabled={status === ticket.status}
        >
          Update status
        </Button>
      </div>
      {update.isError && <InlineError message={staffErrorMessage(update.error, STATUS_MESSAGES)} />}
    </div>
  );
}

export interface TicketThreadProps {
  ticketId: number;
  canResolve: boolean;
  onCheckinRequired: () => void;
}

export function TicketThread({ ticketId, canResolve, onCheckinRequired }: TicketThreadProps) {
  const query = useStaffTicket(ticketId);

  const checkinLapsed = isCheckinRequired(query.error);
  useEffect(() => {
    if (checkinLapsed) {
      onCheckinRequired();
    }
  }, [checkinLapsed, onCheckinRequired]);

  if (query.isPending) {
    return <SectionLoading label="Loading the ticket" minHeight="80px" />;
  }
  if (query.isError) {
    const { title, message, retryable } = userMessageFor(query.error);
    return (
      <ErrorState
        title={title}
        message={message}
        retry={retryable ? { label: 'Try Again', onClick: () => void query.refetch() } : undefined}
      />
    );
  }

  const { ticket } = query.data;
  return (
    <div className="flex flex-col gap-4 border-l-2 border-[var(--border-muted)] pl-4">
      <p className="whitespace-pre-wrap text-[var(--text-primary)]">{ticket.note}</p>

      {ticket.replies.length === 0 ? (
        <p className="text-sm text-role-secondary">No replies yet.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {ticket.replies.map((reply) => (
            <li key={reply.id}>
              <p className="text-sm text-role-secondary">
                {reply.author?.username ?? FORMER_STEWARD},{' '}
                <time dateTime={reply.createdAt}>
                  {formatDateTime(reply.createdAt, STAFF_TIME_OPTIONS)}
                </time>
              </p>
              <p className="whitespace-pre-wrap text-[var(--text-primary)]">{reply.body}</p>
            </li>
          ))}
        </ol>
      )}

      <ReplyForm ticketId={ticket.id} />
      {canResolve && <StatusControl ticket={ticket} />}
    </div>
  );
}

export default TicketThread;
