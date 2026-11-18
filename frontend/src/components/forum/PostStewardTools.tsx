/**
 * PostStewardTools: a steward edits or removes a forum post where they read it
 * (Equoria-puj1e.3, owner ruling q375).
 *
 * Shown only to stewards, closed until asked for. An edit or a removal needs a
 * reason, which goes to the stewards' ledger. Removing a thread's first post
 * removes the thread. The server decides who may act on whose post (never the
 * owner's, one's own, or another steward's) and its refusals show here. The
 * visible change is the post itself: its new words, or its absence.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField, Textarea } from '@/components/ui/form';
import { InlineError } from '@/components/ui/state';
import { staffErrorMessage } from '@/components/staff/staffMessages';
import { useEditForumPost, useRemoveForumPost } from '@/hooks/api/useStaffContent';

const actMessages = {
  400: 'Write the post and a reason first.',
  403: "You cannot change this player's post.",
  404: 'That post is already gone.',
};

export interface PostStewardToolsProps {
  postId: number;
  content: string;
  /** The thread's first post: removing it removes the thread. */
  isFirst: boolean;
  /** Called once the post (or its thread) is gone. */
  onRemoved?: (removed: 'post' | 'thread') => void;
}

export function PostStewardTools({ postId, content, isFirst, onRemoved }: PostStewardToolsProps) {
  const edit = useEditForumPost();
  const remove = useRemoveForumPost();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(content);
  const [reason, setReason] = useState('');
  const hasReason = reason.trim() !== '';
  const error = edit.error ?? remove.error;

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          setDraft(content);
          setOpen(true);
        }}
      >
        Moderate
      </Button>
    );
  }

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!hasReason || draft.trim() === '') return;
    remove.reset();
    edit.mutate(
      { postId, content: draft.trim(), reason: reason.trim() },
      {
        onSuccess: () => {
          setReason('');
          setOpen(false);
        },
      }
    );
  };

  const removeIt = () => {
    if (!hasReason) return;
    edit.reset();
    remove.mutate(
      { postId, reason: reason.trim() },
      { onSuccess: (result) => onRemoved?.(result.removed) }
    );
  };

  return (
    <form onSubmit={save} className="mt-3 flex flex-col gap-3" noValidate>
      <FormField label="Post">
        {(field) => (
          <Textarea
            {...field}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            maxLength={10000}
          />
        )}
      </FormField>
      <FormField label="Reason" required>
        {(field) => (
          <Textarea
            {...field}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            maxLength={1000}
          />
        )}
      </FormField>
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          pending={edit.isPending}
          disabled={!hasReason || draft.trim() === '' || remove.isPending}
        >
          Save edit
        </Button>
        <Button
          type="button"
          variant="destructive"
          pending={remove.isPending}
          disabled={!hasReason || edit.isPending}
          onClick={removeIt}
        >
          {isFirst ? 'Remove the thread' : 'Remove post'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
      {error && <InlineError message={staffErrorMessage(error, actMessages)} />}
    </form>
  );
}

export default PostStewardTools;
