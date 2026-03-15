/**
 * MessagesPage — Player Inbox / Messages (Epic 11 — Story 11-7)
 *
 * Two-tab inbox:
 *   Inbox — received messages with read/unread state
 *   Sent  — sent messages
 *
 * Wired to live API in Epic 19B-2:
 *   - useInbox() / useSentMessages() replace MOCK_INBOX / MOCK_SENT
 *   - useUnreadCount() drives the header badge
 *   - Loading skeleton and empty states included
 *
 * Uses Celestial Night theme.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Send, PlusCircle, Circle, CheckCircle2, Clock, User } from 'lucide-react';
import { useInbox, useSentMessages, useUnreadCount } from '@/hooks/api/useMessages';
import type { DirectMessage } from '@/lib/api-client';

type MessageTab = 'inbox' | 'sent';

const tagColors: Record<string, string> = {
  Sales: 'bg-emerald-500/20 text-emerald-400',
  Clubs: 'bg-celestial-gold/20 text-celestial-gold',
  Breeding: 'bg-pink-500/20 text-pink-400',
  System: 'bg-blue-500/20 text-blue-400',
  News: 'bg-violet-500/20 text-violet-400',
  Art: 'bg-rose-500/20 text-rose-400',
};

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const days = Math.floor(hr / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

const MessagesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MessageTab>('inbox');

  const { data: inboxData, isLoading: inboxLoading } = useInbox();
  const { data: sentData, isLoading: sentLoading } = useSentMessages();
  const { data: unreadData } = useUnreadCount();

  const inboxMessages = inboxData?.messages ?? [];
  const sentMessages = sentData?.messages ?? [];
  const unreadCount = unreadData?.count ?? 0;

  const messages = activeTab === 'inbox' ? inboxMessages : sentMessages;
  const isLoading = activeTab === 'inbox' ? inboxLoading : sentLoading;

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          <span className="text-white/70">Messages</span>
        </div>

        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <Mail className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white/90">📬 Messages</h1>
              <p className="text-sm text-white/50 mt-0.5">
                {unreadCount > 0
                  ? `${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}`
                  : 'All caught up'}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400/60 text-sm font-medium cursor-not-allowed"
            title="Compose a new message"
            data-testid="compose-button"
          >
            <PlusCircle className="w-4 h-4" />
            Compose
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl mb-6 w-fit"
          role="tablist"
          aria-label="Message folders"
          data-testid="message-tabs"
        >
          <button
            role="tab"
            aria-selected={activeTab === 'inbox'}
            onClick={() => setActiveTab('inbox')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'inbox'
                ? 'bg-white/10 text-white/90 shadow-sm'
                : 'text-white/40 hover:text-white/70'
            }`}
            data-testid="tab-inbox"
          >
            <Mail className="w-4 h-4" />
            Inbox
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold bg-red-500/80 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'sent'}
            onClick={() => setActiveTab('sent')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'sent'
                ? 'bg-white/10 text-white/90 shadow-sm'
                : 'text-white/40 hover:text-white/70'
            }`}
            data-testid="tab-sent"
          >
            <Send className="w-4 h-4" />
            Sent
          </button>
        </div>

        {/* Message List */}
        <div role="tabpanel" data-testid="message-list">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white/5 border border-white/10 rounded-xl p-4 animate-pulse"
                >
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-white/10 rounded w-1/3" />
                      <div className="h-3 bg-white/10 rounded w-2/3" />
                      <div className="h-2 bg-white/10 rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center min-h-48 text-center p-8"
              data-testid="empty-messages"
            >
              <Mail className="w-10 h-10 text-white/20 mb-3" />
              <p className="text-white/50 font-medium">
                {activeTab === 'inbox' ? 'Your inbox is empty' : 'No sent messages'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((message) => (
                <MessageRow key={message.id} message={message} isInbox={activeTab === 'inbox'} />
              ))}
            </div>
          )}
        </div>

        {/* Info Panel */}
        <div className="mt-10 p-5 rounded-xl bg-white/3 border border-white/8 text-sm text-white/40">
          <h3 className="font-semibold text-white/60 mb-2">About Messages</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Send direct messages to other community members</li>
            <li>System messages are sent automatically for competition results and events</li>
            <li>Visit the Message Board to post publicly in community sections</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

const MessageRow: React.FC<{ message: DirectMessage; isInbox: boolean }> = ({
  message,
  isInbox,
}) => {
  const contactName = isInbox ? message.sender.username : `To: ${message.recipient.username}`;
  const preview =
    message.content.length > 120 ? `${message.content.slice(0, 120)}…` : message.content;
  const isUnread = isInbox && !message.isRead;

  return (
    <div
      className={`group bg-white/5 border rounded-xl p-4 transition-all hover:bg-white/8 ${
        isUnread ? 'border-emerald-500/20' : 'border-white/10 hover:border-white/20'
      }`}
      data-testid={`message-${message.id}`}
    >
      <div className="flex items-start gap-3">
        {/* Read indicator */}
        <div className="flex-shrink-0 mt-1">
          {isUnread ? (
            <Circle className="w-2 h-2 fill-emerald-400 text-emerald-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-white/15" />
          )}
        </div>

        {/* Sender avatar */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center border border-white/10">
          <User className="w-4 h-4 text-white/70" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <div className="min-w-0 flex items-center gap-2 flex-wrap">
              <span
                className={`text-sm font-semibold ${isUnread ? 'text-white/90' : 'text-white/70'}`}
              >
                {contactName}
              </span>
              {message.tag && (
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    tagColors[message.tag] ?? 'bg-white/10 text-white/50'
                  }`}
                >
                  {message.tag}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-white/30 flex-shrink-0">
              <Clock className="w-3 h-3" />
              {relativeTime(message.createdAt)}
            </div>
          </div>
          <div
            className={`text-sm mb-1 ${isUnread ? 'font-semibold text-white/80' : 'text-white/60'}`}
          >
            {message.subject}
          </div>
          <p className="text-xs text-white/40 line-clamp-1">{preview}</p>
        </div>
      </div>
    </div>
  );
};

export default MessagesPage;
