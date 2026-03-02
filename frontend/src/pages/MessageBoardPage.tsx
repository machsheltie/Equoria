/**
 * MessageBoardPage — Community Message Board (Epic 11 + 19B-1)
 *
 * Five-section community board backed by the live /api/forum API.
 *   1. 💬 General Chat
 *   2. 🎨 Art & Photography
 *   3. 🐴 Horse Sales
 *   4. 🛠️ Services
 *   5. 😤 Venting
 *
 * Data source: ForumThread + ForumPost via useThreads() React Query hook.
 * Uses Celestial Night theme.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare,
  Pin,
  MessageCircle,
  Clock,
  ChevronRight,
  PlusCircle,
  Eye,
} from 'lucide-react';
import MainNavigation from '@/components/MainNavigation';
import { useThreads } from '@/hooks/api/useForum';
import type { ForumThread, ForumSection } from '@/lib/api-client';

const sectionConfig: Record<
  ForumSection,
  { label: string; emoji: string; description: string; color: string }
> = {
  general: {
    label: 'General Chat',
    emoji: '💬',
    description: 'Community discussion',
    color: 'violet',
  },
  art: {
    label: 'Art & Photography',
    emoji: '🎨',
    description: 'Share your creations',
    color: 'pink',
  },
  sales: {
    label: 'Horse Sales',
    emoji: '🐴',
    description: 'Buy, sell & rehome',
    color: 'emerald',
  },
  services: {
    label: 'Services',
    emoji: '🛠️',
    description: 'Training, grooms & more',
    color: 'amber',
  },
  venting: {
    label: 'Venting',
    emoji: '😤',
    description: 'Celebrations & frustrations',
    color: 'rose',
  },
};

const sectionAccent: Record<ForumSection, string> = {
  general: 'bg-violet-500/10 border-violet-500/30 text-violet-400',
  art: 'bg-pink-500/10 border-pink-500/30 text-pink-400',
  sales: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  services: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  venting: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
};

const sections: ForumSection[] = ['general', 'art', 'sales', 'services', 'venting'];

/** Format ISO date string as relative time (e.g. "5 min ago") */
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

  const { threads, total, isLoading, error } = useThreads(activeSection);

  const pinnedThreads = threads.filter((t) => t.isPinned);
  const regularThreads = threads.filter((t) => !t.isPinned);

  return (
    <div className="min-h-screen">
      <MainNavigation />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
          <Link to="/" className="hover:text-white/70 transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link to="/community" className="hover:text-white/70 transition-colors">
            Community
          </Link>
          <span>/</span>
          <span className="text-white/70">Message Board</span>
        </div>

        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/30">
              <MessageSquare className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white/90">💬 Message Board</h1>
              <p className="text-sm text-white/50 mt-0.5">
                {total} thread{total !== 1 ? 's' : ''} in {sectionConfig[activeSection].label}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600/10 border border-violet-500/20 text-violet-400/60 text-sm font-medium cursor-not-allowed"
            title="Sign in to post"
            data-testid="new-post-button"
          >
            <PlusCircle className="w-4 h-4" />
            New Post
          </button>
        </div>

        {/* Section Tabs */}
        <div
          className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl mb-6 overflow-x-auto"
          role="tablist"
          aria-label="Board sections"
          data-testid="section-tabs"
        >
          {sections.map((section) => {
            const config = sectionConfig[section];
            return (
              <button
                key={section}
                role="tab"
                aria-selected={activeSection === section}
                onClick={() => setActiveSection(section)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  activeSection === section
                    ? 'bg-white/10 text-white/90 shadow-sm'
                    : 'text-white/40 hover:text-white/70'
                }`}
                data-testid={`section-tab-${section}`}
              >
                <span>{config.emoji}</span>
                <span>{config.label}</span>
              </button>
            );
          })}
        </div>

        {/* Section Description */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-white/40">{sectionConfig[activeSection].description}</p>
        </div>

        {/* Thread List */}
        <div role="tabpanel" data-testid="thread-list">
          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="bg-white/5 border border-white/10 rounded-xl p-4 animate-pulse"
                >
                  <div className="h-4 bg-white/10 rounded w-2/3 mb-2" />
                  <div className="h-3 bg-white/10 rounded w-1/3" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-rose-400/70">
              Failed to load threads. Please try again.
            </div>
          )}

          {!isLoading && !error && threads.length === 0 && (
            <div className="text-center py-12 text-white/30">
              No threads yet in {sectionConfig[activeSection].label}.
            </div>
          )}

          {!isLoading && !error && threads.length > 0 && (
            <>
              {pinnedThreads.length > 0 && (
                <div className="mb-4 space-y-2">
                  {pinnedThreads.map((thread) => (
                    <ThreadRow key={thread.id} thread={thread} section={activeSection} />
                  ))}
                </div>
              )}
              <div className="space-y-2">
                {regularThreads.map((thread) => (
                  <ThreadRow key={thread.id} thread={thread} section={activeSection} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const ThreadRow: React.FC<{ thread: ForumThread; section: ForumSection }> = ({
  thread,
  section,
}) => (
  <div
    className="group bg-white/5 border border-white/10 hover:border-white/20 rounded-xl p-4 transition-all"
    data-testid={`thread-${thread.id}`}
  >
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 mt-0.5">
        {thread.isPinned ? (
          <Pin className="w-4 h-4 text-celestial-gold/70" />
        ) : (
          <MessageCircle className={`w-4 h-4 ${sectionAccent[section].split(' ')[2]}`} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              {thread.isPinned && (
                <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-celestial-gold/20 text-celestial-gold">
                  Pinned
                </span>
              )}
              <h3 className="text-sm font-semibold text-white/90 truncate">{thread.title}</h3>
            </div>
            <div className="flex items-center gap-3 flex-wrap mt-1">
              <span className="text-xs text-white/40">
                by <span className="text-white/60 font-medium">{thread.author.username}</span>
              </span>
              {thread.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/40 border border-white/10"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            <div className="flex items-center gap-3 text-xs text-white/40">
              <span className="flex items-center gap-1">
                <MessageCircle className="w-3 h-3" />
                {thread.replyCount}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {thread.viewCount}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-white/30">
              <Clock className="w-3 h-3" />
              {relativeTime(thread.lastActivityAt)}
            </div>
          </div>
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0 mt-1" />
    </div>
  </div>
);

export default MessageBoardPage;
