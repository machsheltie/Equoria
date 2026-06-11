/**
 * MessageBoardPage — Community Message Board (Epic 11 + 19B-1)
 *
 * Five-section community board backed by the live /api/forum API.
 * Features: thread list (paginated), create thread modal, clickable thread rows.
 *
 * Data source: ForumThread + ForumPost via useThreads() / useCreateThread() hooks.
 *
 * Migrated to the canonical design system (Equoria-o5hub community lane):
 * PageContainer(content) + PageHeader, Surface interactive thread rows,
 * GameDialog new-thread composer, canonical form controls, Skeleton /
 * ErrorState / EmptyState async states, role-token colors (the per-section
 * palette accent map was removed — section identity comes from the emoji).
 */

import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  Pin,
  MessageCircle,
  Clock,
  ChevronRight,
  PlusCircle,
  Eye,
  ChevronLeft,
} from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/button';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  GameBadge,
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
} from '@/components/ui/game';
import { FormField, Input, Textarea } from '@/components/ui/form';
import { Skeleton, ErrorState } from '@/components/ui/state';
import EmptyState from '@/components/ui/EmptyState';
import { useThreads, useCreateThread } from '@/hooks/api/useForum';
import type { ForumThread, ForumSection } from '@/lib/api-client';

const THREADS_PER_PAGE = 20;

const sectionConfig: Record<ForumSection, { label: string; emoji: string; description: string }> = {
  general: {
    label: 'General Chat',
    emoji: '💬',
    description: 'Community discussion',
  },
  art: {
    label: 'Art & Photography',
    emoji: '🎨',
    description: 'Share your creations',
  },
  sales: {
    label: 'Horse Sales',
    emoji: '🐴',
    description: 'Buy, sell & rehome',
  },
  services: {
    label: 'Services',
    emoji: '🛠️',
    description: 'Training, grooms & more',
  },
  venting: {
    label: 'Venting',
    emoji: '😤',
    description: 'Celebrations & frustrations',
  },
};

const sections: ForumSection[] = ['general', 'art', 'sales', 'services', 'venting'];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const MessageBoardPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<ForumSection>('general');
  const [page, setPage] = useState(1);
  const [showNewThread, setShowNewThread] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  const { threads, total, isLoading, error } = useThreads(activeSection, page);
  const createThread = useCreateThread();
  const queryClient = useQueryClient();

  const totalPages = Math.max(1, Math.ceil(total / THREADS_PER_PAGE));
  const pinnedThreads = threads.filter((t) => t.isPinned);
  const regularThreads = threads.filter((t) => !t.isPinned);

  const handleSectionChange = useCallback((section: ForumSection) => {
    setActiveSection(section);
    setPage(1);
  }, []);

  const handlePost = async () => {
    if (!newTitle.trim() || !newContent.trim() || createThread.isPending) return;
    await createThread.mutateAsync({
      section: activeSection,
      title: newTitle.trim(),
      content: newContent.trim(),
    });
    setShowNewThread(false);
    setNewTitle('');
    setNewContent('');
    setPage(1);
  };

  const closeNewThread = () => {
    setShowNewThread(false);
    setNewTitle('');
    setNewContent('');
  };

  return (
    <div className="min-h-screen">
      <PageContainer variant="content" padded={false} className="pb-8">
        <PageHeader
          title="Message Board"
          subtitle={`${total} thread${total !== 1 ? 's' : ''} in ${sectionConfig[activeSection].label}`}
          icon={<MessageSquare className="w-5 h-5 text-[var(--gold-400)]" aria-hidden="true" />}
          breadcrumbs={
            <div className="flex items-center gap-2">
              <Link to="/" className="hover:text-[var(--text-primary)] transition-colors">
                Home
              </Link>
              <span>/</span>
              <Link to="/community" className="hover:text-[var(--text-primary)] transition-colors">
                Community
              </Link>
              <span>/</span>
              <span className="text-[var(--text-primary)]">Message Board</span>
            </div>
          }
          actions={
            <Button
              type="button"
              onClick={() => setShowNewThread(true)}
              data-testid="new-post-button"
            >
              <PlusCircle className="w-4 h-4" />
              New Post
            </Button>
          }
          className="mb-6"
        />

        {/* Section Tabs + Thread List — CanonicalTabs underline variant (Equoria-o5hub.11) */}
        <Tabs value={activeSection} onValueChange={(v) => handleSectionChange(v as ForumSection)}>
          <TabsList aria-label="Board sections" data-testid="section-tabs">
            {sections.map((section) => {
              const config = sectionConfig[section];
              return (
                <TabsTrigger
                  key={section}
                  value={section}
                  className="gap-2"
                  data-testid={`section-tab-${section}`}
                >
                  <span>{config.emoji}</span>
                  <span>{config.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Section Description */}
          <div className="flex items-center justify-between mt-5">
            <p className="text-sm text-role-muted">{sectionConfig[activeSection].description}</p>
          </div>

          {/* Thread List — only the active section's panel mounts, so the shared
              data-testid="thread-list" is unique in the DOM. Thread data comes
              from useThreads(activeSection) above. */}
          {sections.map((section) => (
            <TabsContent key={section} value={section} data-testid="thread-list">
              {isLoading && (
                <div className="space-y-2">
                  {[1, 2, 3].map((n) => (
                    <Skeleton.Rect key={n} className="h-16" rounded="lg" />
                  ))}
                </div>
              )}

              {error && (
                <ErrorState
                  title="Could not load threads"
                  message="Check your connection and try again."
                  retry={{
                    label: 'Retry',
                    onClick: () =>
                      queryClient.invalidateQueries({ queryKey: ['forum', 'threads'] }),
                  }}
                />
              )}

              {!isLoading && !error && threads.length === 0 && (
                <EmptyState
                  variant="first-use"
                  icon={
                    <MessageSquare className="h-8 w-8 text-[var(--gold-400)]" aria-hidden="true" />
                  }
                  title={`No threads yet in ${sectionConfig[activeSection].label}`}
                  description="Be the first to post!"
                />
              )}

              {!isLoading && !error && threads.length > 0 && (
                <>
                  {pinnedThreads.length > 0 && (
                    <div className="mb-4 space-y-2">
                      {pinnedThreads.map((thread) => (
                        <ThreadRow key={thread.id} thread={thread} />
                      ))}
                    </div>
                  )}
                  <div className="space-y-2">
                    {regularThreads.map((thread) => (
                      <ThreadRow key={thread.id} thread={thread} />
                    ))}
                  </div>
                </>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Pagination — navigation actions are secondary-tier (D-08) */}
        {!isLoading && !error && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </Button>
            <span className="text-sm text-role-muted">
              {page} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </PageContainer>

      {/* New Thread Dialog — canonical GameDialog (DECISIONS.md §8) */}
      <GameDialog open={showNewThread} onOpenChange={(open) => !open && closeNewThread()}>
        <GameDialogContent size="md">
          <GameDialogHeader>
            <GameDialogTitle className="text-base">
              New Thread in {sectionConfig[activeSection].label}
            </GameDialogTitle>
          </GameDialogHeader>
          <div className="pt-4 space-y-3">
            <FormField label="Title">
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  placeholder="Thread title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  maxLength={200}
                  data-testid="new-thread-title"
                />
              )}
            </FormField>
            <FormField label="Post">
              {(fieldProps) => (
                <Textarea
                  {...fieldProps}
                  className="resize-none h-32"
                  placeholder="Write your post…"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  maxLength={10000}
                  data-testid="new-thread-content"
                />
              )}
            </FormField>
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="secondary" onClick={closeNewThread}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!newTitle.trim() || !newContent.trim() || createThread.isPending}
                onClick={handlePost}
                data-testid="submit-new-thread"
              >
                {createThread.isPending ? 'Posting…' : 'Post Thread'}
              </Button>
            </div>
          </div>
        </GameDialogContent>
      </GameDialog>
    </div>
  );
};

const ThreadRow: React.FC<{ thread: ForumThread }> = ({ thread }) => (
  <Surface
    variant="interactive"
    as={Link}
    to={`/message-board/${thread.id}`}
    className="group block"
    data-testid={`thread-${thread.id}`}
  >
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 mt-0.5">
        {thread.isPinned ? (
          <Pin className="w-4 h-4 text-[var(--gold-400)]" aria-hidden="true" />
        ) : (
          <MessageCircle className="w-4 h-4 text-role-muted" aria-hidden="true" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              {thread.isPinned && <GameBadge className="text-[10px]">Pinned</GameBadge>}
              <h3 className="text-sm font-semibold text-role-primary break-words min-w-0">
                {thread.title}
              </h3>
            </div>
            <div className="flex items-center gap-3 flex-wrap mt-1">
              <span className="text-xs text-role-muted break-words">
                by <span className="text-role-secondary font-medium">{thread.author.username}</span>
              </span>
              {thread.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--role-neutral-bg)] text-[var(--role-neutral-text)] border border-[var(--role-neutral-border)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            <div className="flex items-center gap-3 text-xs text-role-muted">
              <span className="flex items-center gap-1">
                <MessageCircle className="w-3 h-3" aria-hidden="true" />
                {thread.replyCount}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" aria-hidden="true" />
                {thread.viewCount}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-role-muted">
              <Clock className="w-3 h-3" aria-hidden="true" />
              {relativeTime(thread.lastActivityAt)}
            </div>
          </div>
        </div>
      </div>

      <ChevronRight
        className="w-4 h-4 text-role-muted group-hover:text-[var(--text-secondary)] transition-colors flex-shrink-0 mt-1"
        aria-hidden="true"
      />
    </div>
  </Surface>
);

export default MessageBoardPage;
