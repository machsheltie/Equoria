/**
 * StaffActionLog — the Ledger: the permanent staff action log (Equoria-puj1e.1).
 *
 * A moderator reads their own entries; the admin reads every entry (the server
 * decides). Each entry is one plain sentence — who did what to whom — with the
 * reason and the Eastern game time beneath it. Older entries load from the
 * server's cursor. Names resolve from the staff list when the reader may see
 * it (admin); otherwise an account shows as its role and a short reference.
 */

import React, { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState, InlineError, SectionLoading } from '@/components/ui/state';
import { isCheckinRequired, useStaffList, useStaffLog } from '@/hooks/api/useStaff';
import type { StaffLogEntry } from '@/lib/api/staff';
import { formatDateTime } from '@/lib/formatDate';
import { userMessageFor } from '@/lib/http/userMessage';
import { STAFF_TIME_OPTIONS, staffErrorMessage } from './staffMessages';
import StaffSection from './StaffSection';

const STATUS_WORDS: Record<string, string> = {
  open: 'open',
  in_progress: 'in progress',
  resolved: 'resolved',
  declined: 'declined',
};

type NameOf = (id: string) => string | undefined;

const shortRef = (id: string) => `#${id.slice(0, 8)}`;

function actorText(entry: StaffLogEntry, selfId: string | undefined, nameOf: NameOf): string {
  if (selfId !== undefined && entry.actorId === selfId) {
    return 'You';
  }
  const role = entry.actorRole === 'admin' ? 'The admin' : 'Moderator';
  return nameOf(entry.actorId) ?? `${role} ${shortRef(entry.actorId)}`;
}

function targetText(entry: StaffLogEntry, nameOf: NameOf): string {
  const { targetType, targetId } = entry;
  if (targetId === null) {
    return targetType;
  }
  if (targetType === 'player') {
    return nameOf(targetId) ?? `player ${shortRef(targetId)}`;
  }
  return `${targetType} #${targetId}`;
}

/** One readable sentence for an entry: actor, action, target. */
function describeEntry(entry: StaffLogEntry, selfId: string | undefined, nameOf: NameOf): string {
  const actor = actorText(entry, selfId, nameOf);
  const target = targetText(entry, nameOf);
  const after = entry.after ?? {};
  switch (entry.capability) {
    case 'roles.manage':
      if (after.role === 'moderator') {
        return `${actor} made ${target} a moderator`;
      }
      if (after.role === 'user') {
        return `${actor} revoked ${target}'s moderator role`;
      }
      return `${actor} changed ${target}'s role`;
    case 'ticket.file':
      return `${actor} filed ${target}`;
    case 'ticket.resolve': {
      const word = STATUS_WORDS[String(after.status)];
      return word ? `${actor} marked ${target} ${word}` : `${actor} updated ${target}`;
    }
    default:
      return `${actor} used ${entry.capability} on ${target}`;
  }
}

export interface StaffActionLogProps {
  /** The reader's own account id, so their entries read "You". */
  selfId: string | undefined;
  /** True when the reader may list staff names (roles.manage). */
  canSeeNames: boolean;
  /** The server says this browser must check in again. */
  onCheckinRequired: () => void;
}

export function StaffActionLog({ selfId, canSeeNames, onCheckinRequired }: StaffActionLogProps) {
  const log = useStaffLog();
  const staff = useStaffList(canSeeNames);

  const checkinLapsed = isCheckinRequired(log.error);
  useEffect(() => {
    if (checkinLapsed) {
      onCheckinRequired();
    }
  }, [checkinLapsed, onCheckinRequired]);

  const names = new Map((staff.data?.staff ?? []).map((member) => [member.id, member.username]));
  const nameOf: NameOf = (id) => names.get(id);

  let body: React.ReactNode;
  if (log.isPending) {
    body = <SectionLoading label="Loading the ledger" />;
  } else if (!log.data) {
    const { title, message, retryable } = userMessageFor(log.error);
    body = (
      <ErrorState
        title={title}
        message={message}
        retry={retryable ? { label: 'Try Again', onClick: () => void log.refetch() } : undefined}
      />
    );
  } else {
    const entries = log.data.pages.flatMap((page) => page.entries);
    body =
      entries.length === 0 ? (
        <EmptyState
          variant="first-use"
          title="The ledger is empty"
          description="Every staff action is written here as it happens."
        />
      ) : (
        <>
          <ol className="divide-y divide-[var(--border-muted)]">
            {entries.map((entry) => (
              <li key={entry.id} className="py-3">
                <p className="text-[var(--text-primary)]">
                  {describeEntry(entry, selfId, nameOf)}.
                </p>
                {entry.outcome === 'failed' && (
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-role-danger">
                    <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    It did not go through.
                  </p>
                )}
                {entry.reason && (
                  <p className="mt-1 text-sm text-role-secondary">Reason: {entry.reason}</p>
                )}
                <p className="mt-1 text-sm text-role-secondary">
                  <time dateTime={entry.createdAt}>
                    {formatDateTime(entry.createdAt, STAFF_TIME_OPTIONS)}
                  </time>
                </p>
              </li>
            ))}
          </ol>
          {log.hasNextPage && (
            <div className="mt-3 flex flex-col items-start gap-2">
              <Button
                variant="outline"
                onClick={() => void log.fetchNextPage()}
                pending={log.isFetchingNextPage}
              >
                Show older entries
              </Button>
              {log.isFetchNextPageError && <InlineError message={staffErrorMessage(log.error)} />}
            </div>
          )}
        </>
      );
  }

  return (
    <StaffSection
      title="Ledger"
      intro="The permanent record of staff actions, newest first, in game time."
    >
      {body}
    </StaffSection>
  );
}

export default StaffActionLog;
