/**
 * MessageThreadPage — Thread detail view (Epic 19B-1)
 *
 * Shows a single forum thread with all its posts and allows replies.
 * Increments view count on mount (deduplicated server-side per hour).
 *
 * Route: /message-board/:threadId
 *
 * Migrated to the canonical design system (Equoria-o5hub community lane):
 * PageContainer(content) + PageHeader, Surface panels for posts/reply box,
 * canonical Textarea, Skeleton / ErrorState / EmptyState async states,
 * role-token colors. Long thread titles and post bodies wrap (break-words).
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { MessageSquare, ArrowLeft, Send, Pin, Clock } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/button';
import { GameBadge } from '@/components/ui/game';
import { Textarea } from '@/components/ui/form';
import { Skeleton, ErrorState } from '@/components/ui/state';
import EmptyState from '@/components/ui/EmptyState';
import { useThread, useCreatePost, useIncrementView } from '@/hooks/api/useForum';
import type { ForumPost } from '@/lib/api-client';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const PostCard: React.FC<{ post: ForumPost; isFirst: boolean }> = ({ post, isFirst }) => (
  <Surface
    variant="panel"
    className={isFirst ? 'border-[var(--role-accent-border)]' : undefined}
    data-testid={`post-${post.id}`}
  >
    <div className="flex items-start gap-3">
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--role-accent-bg)] border border-[var(--role-accent-border)] flex items-center justify-center text-xs font-bold text-[var(--gold-light)] uppercase"
        aria-hidden="true"
      >
        {post.author.username[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="text-sm font-semibold text-role-primary break-words">
            {post.author.username}
          </span>
          {isFirst && (
            <GameBadge variant="primary" className="text-[10px]">
              OP
            </GameBadge>
          )}
          <span className="text-xs text-role-muted flex items-center gap-1">
            <Clock className="w-3 h-3" aria-hidden="true" />
            {relativeTime(post.createdAt)}
          </span>
        </div>
        <p className="text-sm text-role-secondary leading-relaxed whitespace-pre-wrap break-words">
          {post.content}
        </p>
      </div>
    </div>
  </Surface>
);

const MessageThreadPage: React.FC = () => {
  const { threadId } = useParams<{ threadId: string }>();
  const id = parseInt(threadId ?? '0', 10);

  const { thread, posts, isLoading, error } = useThread(id || null);
  const createPost = useCreatePost();
  const incrementView = useIncrementView();
  const queryClient = useQueryClient();

  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) incrementView.mutate(id);
  }, [id]); // incrementView ref is stable — intentionally omitted

  const handleReply = async () => {
    if (!reply.trim() || submitting) return;
    setSubmitting(true);
    try {
      await createPost.mutateAsync({ threadId: id, content: reply.trim() });
      setReply('');
    } finally {
      setSubmitting(false);
    }
  };

  const sectionLabel = thread?.section
    ? thread.section.charAt(0).toUpperCase() + thread.section.slice(1)
    : 'Thread';

  return (
    <div className="min-h-screen">
      <PageContainer variant="content" padded={false} className="pb-8">
        <PageHeader
          title={isLoading ? 'Loading…' : (thread?.title ?? 'Thread not found')}
          subtitle={
            thread
              ? `${posts.length} post${posts.length !== 1 ? 's' : ''} · ${sectionLabel}`
              : undefined
          }
          icon={<MessageSquare className="w-5 h-5 text-[var(--gold-400)]" aria-hidden="true" />}
          breadcrumbs={
            <div className="flex items-center gap-2 min-w-0">
              <Link to="/" className="hover:text-[var(--text-primary)] transition-colors">
                Home
              </Link>
              <span>/</span>
              <Link to="/community" className="hover:text-[var(--text-primary)] transition-colors">
                Community
              </Link>
              <span>/</span>
              <Link
                to="/message-board"
                className="hover:text-[var(--text-primary)] transition-colors"
              >
                Message Board
              </Link>
              <span>/</span>
              <span className="text-[var(--text-primary)] truncate max-w-[200px]">
                {thread?.title ?? '…'}
              </span>
            </div>
          }
          className="mb-6"
        />

        <Link
          to="/message-board"
          className="inline-flex items-center gap-2 text-sm text-role-muted hover:text-[var(--text-secondary)] transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to Message Board
        </Link>

        {thread && (
          <Surface variant="panel" className="flex items-center gap-3 mb-6">
            {thread.isPinned && (
              <Pin className="w-4 h-4 text-[var(--gold-400)] flex-shrink-0" aria-hidden="true" />
            )}
            <div className="text-xs text-role-muted min-w-0 break-words">
              Posted by{' '}
              <span className="text-role-secondary font-medium">{thread.author.username}</span>
              {thread.tags.length > 0 && (
                <span className="ml-2">
                  {thread.tags.map((tag) => (
                    <span
                      key={tag}
                      className="ml-1 px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--role-neutral-bg)] text-[var(--role-neutral-text)] border border-[var(--role-neutral-border)]"
                    >
                      {tag}
                    </span>
                  ))}
                </span>
              )}
            </div>
          </Surface>
        )}

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <Skeleton.Rect key={n} className="h-24" rounded="lg" />
            ))}
          </div>
        )}

        {error && !isLoading && (
          <ErrorState
            title="Could not load thread"
            message="Check your connection and try again."
            retry={{
              label: 'Retry',
              onClick: () => queryClient.invalidateQueries({ queryKey: ['forum', 'thread', id] }),
            }}
          />
        )}

        {!isLoading && !error && !thread && (
          <EmptyState
            variant="unavailable"
            icon={<MessageSquare className="h-8 w-8 text-[var(--gold-400)]" aria-hidden="true" />}
            title="Thread not found"
            description="This thread may have been removed."
          />
        )}

        {!isLoading && !error && posts.length > 0 && (
          <div className="space-y-3 mb-8" data-testid="post-list">
            {posts.map((post, idx) => (
              <PostCard key={post.id} post={post} isFirst={idx === 0} />
            ))}
          </div>
        )}

        {!isLoading && thread && (
          <Surface variant="panel" data-testid="reply-box">
            <h3 className="text-sm font-semibold text-role-secondary mb-3">Leave a reply</h3>
            <Textarea
              className="resize-none mb-3"
              rows={4}
              placeholder="Write your reply…"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              maxLength={10000}
              data-testid="reply-input"
              aria-label="Reply"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-role-muted">{reply.length}/10000</span>
              <Button
                type="button"
                onClick={handleReply}
                disabled={!reply.trim() || submitting}
                data-testid="submit-reply"
              >
                <Send className="w-3.5 h-3.5" />
                {submitting ? 'Posting…' : 'Post Reply'}
              </Button>
            </div>
          </Surface>
        )}
      </PageContainer>
    </div>
  );
};

export default MessageThreadPage;
