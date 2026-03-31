/**
 * MessageThreadPage — Thread detail view (Epic 19B-1)
 *
 * Shows a single forum thread with all its posts and allows replies.
 * Increments view count on mount (deduplicated server-side per hour).
 *
 * Route: /message-board/:threadId
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MessageSquare, ArrowLeft, Send, Pin, Clock } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
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
  <div
    className={`p-4 rounded-xl border transition-all ${isFirst ? 'bg-white/8 border-white/15' : 'bg-white/5 border-white/10'}`}
    data-testid={`post-${post.id}`}
  >
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-xs font-bold text-violet-300 uppercase">
        {post.author.username[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm font-semibold text-white/80">{post.author.username}</span>
          {isFirst && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 border border-violet-500/20">
              OP
            </span>
          )}
          <span className="text-xs text-white/30 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {relativeTime(post.createdAt)}
          </span>
        </div>
        <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{post.content}</p>
      </div>
    </div>
  </div>
);

const MessageThreadPage: React.FC = () => {
  const { threadId } = useParams<{ threadId: string }>();
  const id = parseInt(threadId ?? '0', 10);

  const { thread, posts, isLoading, error } = useThread(id || null);
  const createPost = useCreatePost();
  const incrementView = useIncrementView();

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
      <PageHero
        title={isLoading ? 'Loading…' : (thread?.title ?? 'Thread not found')}
        subtitle={
          thread ? `${posts.length} post${posts.length !== 1 ? 's' : ''} · ${sectionLabel}` : ''
        }
        mood="default"
        icon={<MessageSquare className="w-7 h-7 text-[var(--gold-400)]" />}
      >
        <div className="flex items-center gap-2 text-sm text-[var(--cream)]/60">
          <Link to="/" className="hover:text-[var(--cream)] transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link to="/community" className="hover:text-[var(--cream)] transition-colors">
            Community
          </Link>
          <span>/</span>
          <Link to="/message-board" className="hover:text-[var(--cream)] transition-colors">
            Message Board
          </Link>
          <span>/</span>
          <span className="text-[var(--cream)] truncate max-w-[200px]">{thread?.title ?? '…'}</span>
        </div>
      </PageHero>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <Link
          to="/message-board"
          className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Message Board
        </Link>

        {thread && (
          <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-white/3 border border-white/8">
            {thread.isPinned && <Pin className="w-4 h-4 text-celestial-gold/60 flex-shrink-0" />}
            <div className="text-xs text-white/40">
              Posted by <span className="text-white/60 font-medium">{thread.author.username}</span>
              {thread.tags.length > 0 && (
                <span className="ml-2">
                  {thread.tags.map((tag) => (
                    <span
                      key={tag}
                      className="ml-1 px-1.5 py-0.5 rounded bg-white/8 text-white/40 border border-white/10"
                    >
                      {tag}
                    </span>
                  ))}
                </span>
              )}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-white/5 border border-white/10 rounded-xl p-4 animate-pulse h-24"
              />
            ))}
          </div>
        )}

        {error && !isLoading && (
          <div className="text-center py-12 text-rose-400/70">
            Failed to load thread. Please try again.
          </div>
        )}

        {!isLoading && !error && !thread && (
          <div className="text-center py-12 text-white/30">Thread not found.</div>
        )}

        {!isLoading && !error && posts.length > 0 && (
          <div className="space-y-3 mb-8" data-testid="post-list">
            {posts.map((post, idx) => (
              <PostCard key={post.id} post={post} isFirst={idx === 0} />
            ))}
          </div>
        )}

        {!isLoading && thread && (
          <div className="p-4 rounded-xl bg-white/5 border border-white/10" data-testid="reply-box">
            <h3 className="text-sm font-semibold text-white/60 mb-3">Leave a reply</h3>
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/30 focus:outline-none focus:border-violet-500/40 resize-none mb-3"
              rows={4}
              placeholder="Write your reply…"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              maxLength={10000}
              data-testid="reply-input"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/30">{reply.length}/10000</span>
              <button
                type="button"
                onClick={handleReply}
                disabled={!reply.trim() || submitting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-300 text-sm font-medium hover:bg-violet-600/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid="submit-reply"
              >
                <Send className="w-3.5 h-3.5" />
                {submitting ? 'Posting…' : 'Post Reply'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageThreadPage;
