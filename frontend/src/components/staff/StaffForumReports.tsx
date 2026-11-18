/**
 * StaffForumReports: posts players have reported (Equoria-puj1e.3, owner ruling
 * q382). Moderators, admins and the owner.
 *
 * Oldest first: who reported whose post, why (and their note for Other), the post
 * itself and a link to its thread, where the Moderate tools edit or remove it.
 * Mark resolved when something was done; Dismiss when nothing needed doing. An
 * optional note goes to the stewards' ledger. A decided report leaves the list,
 * which is the visible change; removing the post removes its reports too.
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form';
import { ErrorState, InlineError, SectionLoading } from '@/components/ui/state';
import { reportReasonLabels } from '@/components/forum/forumModeration';
import { isCheckinRequired } from '@/hooks/api/useStaff';
import { useDecideForumReport, useForumReports } from '@/hooks/api/useStaffContent';
import type { ForumReportView } from '@/lib/api/staffContent';
import { formatDateTime } from '@/lib/formatDate';
import { userMessageFor } from '@/lib/http/userMessage';
import { staffErrorMessage, staffTimeOptions } from './staffMessages';
import StaffSection from './StaffSection';

const decideMessages = {
  403: 'You cannot decide a report about this post.',
  404: 'This report is gone: the post was removed.',
  409: 'Another steward has already decided this report.',
};

function ReportRow({ report }: { report: ForumReportView }) {
  const decide = useDecideForumReport();
  const [note, setNote] = useState('');
  const { post } = report;
  const send = (decision: 'resolve' | 'dismiss') =>
    decide.mutate({ reportId: report.id, decision, reason: note.trim() || undefined });

  return (
    <li className="py-4" data-testid={`forum-report-${report.id}`}>
      <p className="text-sm text-role-secondary">
        {report.reporter.username} reported {post.author.username}&apos;s post in{' '}
        <Link to={`/message-board/${post.thread.id}`} className="underline">
          {post.thread.title}
        </Link>{' '}
        ({formatDateTime(report.createdAt, staffTimeOptions)})
      </p>
      <p className="mt-2 text-sm text-[var(--text-primary)]">
        <strong>{reportReasonLabels[report.reason] ?? 'Other'}</strong>
        {report.note ? `: ${report.note}` : ''}
      </p>
      <blockquote className="mt-2 whitespace-pre-wrap break-words border-l-2 border-[var(--border-muted)] pl-3 text-role-secondary">
        {post.content}
      </blockquote>
      <div className="mt-3 flex flex-col gap-3">
        <FormField label="Note for the ledger (optional)">
          {(field) => (
            <Input
              {...field}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={1000}
            />
          )}
        </FormField>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            pending={decide.isPending && decide.variables?.decision === 'resolve'}
            disabled={decide.isPending}
            onClick={() => send('resolve')}
          >
            Mark resolved
          </Button>
          <Button
            type="button"
            variant="secondary"
            pending={decide.isPending && decide.variables?.decision === 'dismiss'}
            disabled={decide.isPending}
            onClick={() => send('dismiss')}
          >
            Dismiss
          </Button>
        </div>
      </div>
      {decide.isError && (
        <InlineError className="mt-2" message={staffErrorMessage(decide.error, decideMessages)} />
      )}
    </li>
  );
}

export interface StaffForumReportsProps {
  onCheckinRequired: () => void;
}

export function StaffForumReports({ onCheckinRequired }: StaffForumReportsProps) {
  const reports = useForumReports();
  const lapsed = isCheckinRequired(reports.error);
  useEffect(() => {
    if (lapsed) {
      onCheckinRequired();
    }
  }, [lapsed, onCheckinRequired]);

  let body: React.ReactNode;
  if (reports.isPending) {
    body = <SectionLoading label="Loading reported posts" />;
  } else if (reports.isError) {
    const { title, message } = userMessageFor(reports.error);
    body = <ErrorState title={title} message={message} />;
  } else {
    const rows = reports.data.pages.flatMap((page) => page.reports);
    body =
      rows.length === 0 ? (
        <p className="text-sm text-role-secondary">No reports are waiting.</p>
      ) : (
        <>
          <ul className="divide-y divide-[var(--border-muted)]">
            {rows.map((report) => (
              <ReportRow key={report.id} report={report} />
            ))}
          </ul>
          {reports.hasNextPage && (
            <Button
              type="button"
              variant="secondary"
              className="mt-3"
              pending={reports.isFetchingNextPage}
              onClick={() => reports.fetchNextPage()}
            >
              Show more
            </Button>
          )}
        </>
      );
  }

  return (
    <StaffSection
      title="Reported posts"
      intro="Posts players have reported. Moderate the post from its thread, then mark the report resolved; dismiss it if nothing needs doing."
    >
      {body}
    </StaffSection>
  );
}

export default StaffForumReports;
