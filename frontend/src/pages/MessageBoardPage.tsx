/**
 * MessageBoardPage — Community Message Board (Epic 11 — Stories 11-1 + 11-2)
 *
 * Five-section community board:
 *   1. 💬 General Chat   — general community discussion
 *   2. 🎨 Art & Photography — player art, photos, and screenshots
 *   3. 🐴 Horse Sales     — buy/sell/rehome horses
 *   4. 🛠️ Services        — training, grooming, stud, and other services
 *   5. 😤 Venting         — frustrations, celebrations, off-topic
 *
 * "New Post" button is disabled (mock-ready, pending auth wire-up).
 * All thread data uses MOCK_THREADS (labelled for easy API replacement).
 *
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

type BoardSection = 'general' | 'art' | 'sales' | 'services' | 'venting';

interface Thread {
  id: string;
  section: BoardSection;
  title: string;
  author: string;
  tags: string[];
  replyCount: number;
  viewCount: number;
  lastActivity: string;
  pinned?: boolean;
  preview: string;
}

// Mock thread data — replace with live /api/community/threads endpoint
const MOCK_THREADS: Thread[] = [
  // General Chat
  {
    id: 'thread-1',
    section: 'general',
    title: 'Welcome to the General Chat section!',
    author: 'EquoriaMod',
    tags: ['pinned', 'welcome'],
    replyCount: 23,
    viewCount: 412,
    lastActivity: '5 min ago',
    pinned: true,
    preview: 'Introduce yourself, ask questions, and chat with the community.',
  },
  {
    id: 'thread-2',
    section: 'general',
    title: 'Anyone else excited for the Spring Classic next month?',
    author: 'StarlightStables',
    tags: ['competition', 'discussion'],
    replyCount: 14,
    viewCount: 187,
    lastActivity: '12 min ago',
    preview: 'Been training my mare for months — fingers crossed for a top-three finish!',
  },
  {
    id: 'thread-3',
    section: 'general',
    title: 'Tips for new players — megathread',
    author: 'CopperCreekFarm',
    tags: ['guide', 'tips'],
    replyCount: 67,
    viewCount: 1240,
    lastActivity: '1 hr ago',
    pinned: true,
    preview: 'Compiled list of tips from veterans. Feel free to add your own!',
  },
  {
    id: 'thread-4',
    section: 'general',
    title: 'What breed is everyone currently focusing on?',
    author: 'AquaEquine',
    tags: ['breeds', 'poll'],
    replyCount: 31,
    viewCount: 320,
    lastActivity: '3 hr ago',
    preview: 'Curious what the community is breeding right now. Poll in thread.',
  },
  // Art & Photography
  {
    id: 'thread-5',
    section: 'art',
    title: 'Drew my bay gelding Copperfield — digital art',
    author: 'CanvasAndCanter',
    tags: ['digital art', 'commission'],
    replyCount: 8,
    viewCount: 94,
    lastActivity: '28 min ago',
    preview: 'First time drawing in this style. Feedback and critique welcome!',
  },
  {
    id: 'thread-6',
    section: 'art',
    title: 'Monthly Art Challenge — February: Moonlight Gallop',
    author: 'EquoriaMod',
    tags: ['challenge', 'official'],
    replyCount: 42,
    viewCount: 503,
    lastActivity: '2 hr ago',
    pinned: true,
    preview: 'Submit your moonlit horse artwork before February 28th. Winners get 500 coins.',
  },
  {
    id: 'thread-7',
    section: 'art',
    title: 'Screenshot thread — share your prettiest horses!',
    author: 'PrairieBreeze',
    tags: ['screenshots', 'show off'],
    replyCount: 55,
    viewCount: 720,
    lastActivity: '4 hr ago',
    preview: 'Let us see your beautiful horses. No breed restrictions.',
  },
  // Horse Sales
  {
    id: 'thread-8',
    section: 'sales',
    title: 'WB mare 5yo Dressage-bred — 2,400 coins',
    author: 'MidnightMane',
    tags: ['warmblood', 'mare', 'dressage'],
    replyCount: 3,
    viewCount: 67,
    lastActivity: '30 min ago',
    preview: 'Excellent pedigree, moderate training done. Stats in post. Quick sale preferred.',
  },
  {
    id: 'thread-9',
    section: 'sales',
    title: 'Rehoming: 2 arabians + 1 QH — reasonable offers',
    author: 'SunsetCorral',
    tags: ['arabian', 'quarter horse', 'rehome'],
    replyCount: 7,
    viewCount: 115,
    lastActivity: '1 hr ago',
    preview: 'Scaling down stable size. All well-trained, prefer them to go together.',
  },
  {
    id: 'thread-10',
    section: 'sales',
    title: 'Stud for hire — Champion Thoroughbred Daybreak',
    author: 'ThoroughbredElite',
    tags: ['stud', 'thoroughbred', 'racing'],
    replyCount: 12,
    viewCount: 203,
    lastActivity: '5 hr ago',
    preview: '3x competition champion, excellent racing stats. Fee: 800 coins per session.',
  },
  // Services
  {
    id: 'thread-11',
    section: 'services',
    title: 'Offering: professional training plans (all disciplines)',
    author: 'GoldBridleTraining',
    tags: ['training', 'service'],
    replyCount: 5,
    viewCount: 88,
    lastActivity: '2 hr ago',
    preview: '10+ years in-game experience. Custom plans for any horse. DM for rates.',
  },
  {
    id: 'thread-12',
    section: 'services',
    title: 'Looking for: experienced groom for my foal barn',
    author: 'EmeraldMeadows',
    tags: ['wanted', 'groom'],
    replyCount: 9,
    viewCount: 142,
    lastActivity: '3 hr ago',
    preview: 'Need reliable groom to handle foal enrichment. Willing to pay premium.',
  },
  // Venting
  {
    id: 'thread-13',
    section: 'venting',
    title: 'Lost my best competition horse to an injury — heartbroken',
    author: 'BlueSkyRanch',
    tags: ['sad', 'support'],
    replyCount: 18,
    viewCount: 210,
    lastActivity: '45 min ago',
    preview: 'Thunder was my best horse. Just needed to share with people who understand.',
  },
  {
    id: 'thread-14',
    section: 'venting',
    title: 'Finally got my first championship win! 🏆',
    author: 'RiverbendStables',
    tags: ['celebration', 'milestone'],
    replyCount: 25,
    viewCount: 310,
    lastActivity: '1 hr ago',
    preview: 'After 3 months of trying, Celestia finally placed first in the Grand Prix!',
  },
];

const sectionConfig: Record<
  BoardSection,
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

const sectionAccent: Record<BoardSection, string> = {
  general: 'bg-violet-500/10 border-violet-500/30 text-violet-400',
  art: 'bg-pink-500/10 border-pink-500/30 text-pink-400',
  sales: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  services: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  venting: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
};

const sections: BoardSection[] = ['general', 'art', 'sales', 'services', 'venting'];

const MessageBoardPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<BoardSection>('general');

  const filteredThreads = MOCK_THREADS.filter((t) => t.section === activeSection);
  const pinnedThreads = filteredThreads.filter((t) => t.pinned);
  const regularThreads = filteredThreads.filter((t) => !t.pinned);

  const totalThreads = MOCK_THREADS.length;

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
                {totalThreads} threads across {sections.length} sections
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
            const threadCount = MOCK_THREADS.filter((t) => t.section === section).length;
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
                <span className="text-[10px] bg-white/10 text-white/50 rounded-full px-1.5 py-0.5 font-bold">
                  {threadCount}
                </span>
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
          {/* Pinned Threads */}
          {pinnedThreads.length > 0 && (
            <div className="mb-4 space-y-2">
              {pinnedThreads.map((thread) => (
                <ThreadRow key={thread.id} thread={thread} section={activeSection} />
              ))}
            </div>
          )}

          {/* Regular Threads */}
          <div className="space-y-2">
            {regularThreads.map((thread) => (
              <ThreadRow key={thread.id} thread={thread} section={activeSection} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ThreadRow: React.FC<{ thread: Thread; section: BoardSection }> = ({ thread, section }) => (
  <div
    className="group bg-white/5 border border-white/10 hover:border-white/20 rounded-xl p-4 transition-all"
    data-testid={`thread-${thread.id}`}
  >
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 mt-0.5">
        {thread.pinned ? (
          <Pin className="w-4 h-4 text-celestial-gold/70" />
        ) : (
          <MessageCircle className={`w-4 h-4 ${sectionAccent[section].split(' ')[2]}`} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              {thread.pinned && (
                <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-celestial-gold/20 text-celestial-gold">
                  Pinned
                </span>
              )}
              <h3 className="text-sm font-semibold text-white/90 truncate">{thread.title}</h3>
            </div>
            <p className="text-xs text-white/45 mb-2 line-clamp-1">{thread.preview}</p>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-white/40">
                by <span className="text-white/60 font-medium">{thread.author}</span>
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
              {thread.lastActivity}
            </div>
          </div>
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0 mt-1" />
    </div>
  </div>
);

export default MessageBoardPage;
