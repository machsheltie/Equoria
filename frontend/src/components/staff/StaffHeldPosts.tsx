/**
 * StaffHeldPosts: forum posts waiting for a moderator (Equoria-puj1e.3, owner
 * rulings q375 and q376).
 *
 * Oldest first. Until a moderator accepts a held post only its author sees it.
 * Accept publishes it to everyone; Reject removes it (the whole thread when it is
 * the thread's first post) and leaves the author a short note. A rejection needs a
 * reason for the ledger; the author's note does not carry it. A decided post
 * leaves the list, which is the visible change.
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { FormField, Textarea } from '@/components/ui/form';
import { ErrorState, InlineError, SectionLoading } from '@/components/ui/state';
import { isCheckinRequired } from '@/hooks/api/useStaff';
import { useDecideHeldPost, useHeldPosts } from '@/hooks/api/useStaffContent';
import type { HeldPost } from '@/lib/api/staffContent';
import { formatDateTime } from '@/lib/formatDate';
import { userMessageFor } from '@/lib/http/userMessage';
import { staffErrorMessage, staffTimeOptions } from './staffMessages';
import StaffSection from './StaffSection';

const decideMessages = {
  400: 'Write a reason first.',
  403: 'You cannot decide this post.',
  404: 'Another steward has already decided this post.',
  409: 'Another steward has already decided this post.',
};

function HeldPostRow({ post }: { post: HeldPost }) {
  const decide = useDecideHeldPost();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const reject = (event: React.FormEvent) => {
    event.preventDefault();
    if (reason.trim() === '') return;
    decide.mutate({ postId: post.id, decision: 'reject', reason: reason.trim() });
  };

  return (
    <li className="py-4" data-testid={`held-post-${post.id}`}>
      <p className="text-sm text-role-secondary">
        {post.author.username}
        {post.startsThread ? ' started ' : ' replied in '}
        <Link to={`/message-board/${post.thread.id}`} className="underline">
          {post.thread.title}
        </Link>{' '}
        ({formatDateTime(post.createdAt, staffTimeOptions)})
      </p>
      <p className="mt-2 whitespace-pre-wrap break-words text-[var(--text-primary)]">
        {post.content}
      </p>
      <div className="mt-3 flex flex-wrap items-start gap-3">
        <Button
          type="button"
          pending={decide.isPending && decide.variables?.decision === 'accept'}
          disabled={decide.isPending}
          onClick={() => decide.mutate({ postId: post.id, decision: 'accept' })}
        >
          Accept
        </Button>
        {!rejecting && (
          <Button
            type="button"
            variant="secondary"
            disabled={decide.isPending}
            onClick={() => setRejecting(true)}
          >
            Reject
          </Button>
        )}
      </div>
      {rejecting && (
        <form onSubmit={reject} className="mt-3 flex flex-col gap-3" noValidate>
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
              variant="destructive"
              pending={decide.isPending && decide.variables?.decision === 'reject'}
              disabled={reason.trim() === '' || decide.isPending}
            >
              {post.startsThread ? 'Reject and remove the thread' : 'Reject and remove'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setRejecting(false)}>
              Keep it waiting
            </Button>
          </div>
        </form>
      )}
      {decide.isError && (
        <InlineError className="mt-2" message={staffErrorMessage(decide.error, decideMessages)} />
      )}
    </li>
  );
}

export interface StaffHeldPostsProps {
  onCheckinRequired: () => void;
}

export function StaffHeldPosts({ onCheckinRequired }: StaffHeldPostsProps) {
  const held = useHeldPosts();
  const lapsed = isCheckinRequired(held.error);
  useEffect(() => {
    if (lapsed) {
      onCheckinRequired();
    }
  }, [lapsed, onCheckinRequired]);

  let body: React.ReactNode;
  if (held.isPending) {
    body = <SectionLoading label="Loading held posts" />;
  } else if (held.isError) {
    const { title, message } = userMessageFor(held.error);
    body = <ErrorState title={title} message={message} />;
  } else {
    const posts = held.data.pages.flatMap((page) => page.posts);
    body =
      posts.length === 0 ? (
        <p className="text-sm text-role-secondary">No posts are waiting.</p>
      ) : (
        <>
          <ul className="divide-y divide-[var(--border-muted)]">
            {posts.map((post) => (
              <HeldPostRow key={post.id} post={post} />
            ))}
          </ul>
          {held.hasNextPage && (
            <Button
              type="button"
              variant="secondary"
              className="mt-3"
              pending={held.isFetchingNextPage}
              onClick={() => held.fetchNextPage()}
            >
              Show more
            </Button>
          )}
        </>
      );
  }

  return (
    <StaffSection
      title="Held posts"
      intro="Forum posts waiting for a moderator. Only their authors see them until you accept them."
    >
      {body}
    </StaffSection>
  );
}

export default StaffHeldPosts;
