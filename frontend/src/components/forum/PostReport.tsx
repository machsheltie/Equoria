/**
 * PostReport: a player reports someone else's forum post to the moderators
 * (Equoria-puj1e.3, owner ruling q382).
 *
 * Closed until asked for. The reasons are a short list: Rude or bullying, Spam or
 * selling, Personal information, or Other with a note. Sending it closes the form
 * and the post then says it was reported (the visible change; no receipt). A
 * problem shows in words beside the form. One open report per post: the server
 * refuses a second, and a post the player already reported shows that instead of
 * the button.
 */

import React, { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField, Textarea } from '@/components/ui/form';
import { InlineError } from '@/components/ui/state';
import { useReportPost } from '@/hooks/api/useForum';
import { forumReportReasons, type ForumReportReason } from '@/lib/api/forum';
import type { ApiError } from '@/lib/http/types';
import { userMessageFor } from '@/lib/http/userMessage';
import { reportReasonLabels } from './forumModeration';
import '@/styles/forumReport.css';

const maxNote = 500;

export const reportedMessage = 'Reported. A moderator will take a look.';

function reportErrorMessage(error: unknown): string {
  const apiError = (error ?? {}) as Partial<ApiError>;
  if (apiError.code === 'forumReportDuplicate') return 'You have already reported this post.';
  if (apiError.statusCode === 404) return 'This post is no longer here.';
  if (apiError.code === 'forumReportNote') return 'Say a few words about what is wrong.';
  return userMessageFor(error).message;
}

export interface PostReportProps {
  threadId: number;
  postId: number;
  /** The viewer already has an open report on this post. */
  reported: boolean;
}

export function PostReport({ threadId, postId, reported }: PostReportProps) {
  const send = useReportPost();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ForumReportReason | null>(null);
  const [note, setNote] = useState('');
  const name = useId();

  if (reported || send.isSuccess) {
    return (
      <p className="forum-report forum-report-done" role="status">
        {reportedMessage}
      </p>
    );
  }

  if (!open) {
    return (
      <div className="forum-report">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
          Report
        </Button>
      </div>
    );
  }

  const needsNote = reason === 'other';
  const ready = reason !== null && (!needsNote || note.trim() !== '');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (reason === null || !ready || send.isPending) return;
    send.mutate({ threadId, postId, reason, note: needsNote ? note.trim() : undefined });
  };

  return (
    <form className="forum-report forum-report-form" onSubmit={submit} noValidate>
      <fieldset className="forum-report-reasons">
        <legend>Why are you reporting this post?</legend>
        {forumReportReasons.map((choice) => (
          <label key={choice} className="forum-report-reason">
            <input
              type="radio"
              name={name}
              value={choice}
              checked={reason === choice}
              onChange={() => setReason(choice)}
            />
            <span>{reportReasonLabels[choice]}</span>
          </label>
        ))}
      </fieldset>
      {needsNote && (
        <FormField label="What is wrong?" required>
          {(field) => (
            <Textarea
              {...field}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              maxLength={maxNote}
            />
          )}
        </FormField>
      )}
      <div className="forum-report-actions">
        <Button
          type="submit"
          variant="secondary"
          pending={send.isPending}
          disabled={!ready || send.isPending}
        >
          Send report
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            send.reset();
            setOpen(false);
          }}
        >
          Cancel
        </Button>
      </div>
      {send.isError && <InlineError message={reportErrorMessage(send.error)} />}
    </form>
  );
}

export default PostReport;
