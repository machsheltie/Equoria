/**
 * MessagesPage — Player Inbox / Messages (Epic 11 — Story 11-7)
 *
 * Two-tab inbox:
 *   Inbox — received messages with read/unread state
 *   Sent  — sent messages
 *   Notifications — game notifications (stat gains, foal births, …)
 *
 * Wired to live API in Epic 19B-2:
 *   - useInbox() / useSentMessages() read live backend message data
 *   - useUnreadCount() drives the header badge
 *   - Loading skeleton and empty states included
 *
 * Uses Celestial Night theme.
 *
 * Decomposed under Equoria-w2kyx: the sub-components (ComposeModal,
 * MessageRow, MessageDetailPanel, GameNotifRow) and constants/helpers live
 * under `pages/messages/`. This file is now the thin container — tab state,
 * the live queries, and the list/tab rendering.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Send, PlusCircle, Bell } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/game';
import { useInbox, useSentMessages, useUnreadCount } from '@/hooks/api/useMessages';
import {
  useGameNotifications,
  useMarkGameNotificationsRead,
} from '@/hooks/api/useGameNotifications';
import type { GameNotification } from '@/lib/api-client';
import { type MessageTab } from './messages/constants';
import { ComposeModal } from './messages/ComposeModal';
import { MessageRow } from './messages/MessageRow';
import { GameNotifRow } from './messages/GameNotifRow';

const MessagesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MessageTab>('inbox');
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);

  const { data: inboxData, isLoading: inboxLoading } = useInbox();
  const { data: sentData, isLoading: sentLoading } = useSentMessages();
  const { data: unreadData } = useUnreadCount();
  const { data: gameNotifsData, isLoading: gameNotifsLoading } = useGameNotifications();
  const markGameRead = useMarkGameNotificationsRead();
  const { mutate: markGameReadMutate } = markGameRead;

  const inboxMessages = inboxData?.messages ?? [];
  const sentMessages = sentData?.messages ?? [];
  const unreadCount = unreadData?.count ?? 0;
  const gameNotifications: GameNotification[] = gameNotifsData?.notifications ?? [];
  const gameUnreadCount = gameNotifsData?.unreadCount ?? 0;

  const messages = activeTab === 'inbox' ? inboxMessages : sentMessages;
  const isLoading = activeTab === 'inbox' ? inboxLoading : sentLoading;

  const handleSelectMessage = (id: number) => {
    setSelectedMessageId((prev) => (prev === id ? null : id));
  };

  const handleCloseDetail = () => setSelectedMessageId(null);

  useEffect(() => {
    if (activeTab === 'notifications' && gameUnreadCount > 0) {
      markGameReadMutate();
    }
  }, [activeTab, gameUnreadCount, markGameReadMutate]);

  // Shared inbox/sent panel body. `messages` / `isLoading` are derived from
  // activeTab above, and Radix only mounts the active TabsContent, so the
  // active tab's data is what renders.
  const messagesBody = isLoading ? (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="glass-panel animate-pulse">
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
        <MessageRow
          key={message.id}
          message={message}
          isInbox={activeTab === 'inbox'}
          isSelected={selectedMessageId === message.id}
          onSelect={handleSelectMessage}
        />
      ))}
    </div>
  );

  const notificationsBody = gameNotifsLoading ? (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="glass-panel animate-pulse">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-white/10 rounded w-1/3" />
              <div className="h-3 bg-white/10 rounded w-2/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  ) : gameNotifications.length === 0 ? (
    <div
      className="flex flex-col items-center justify-center min-h-48 text-center p-8"
      data-testid="empty-notifications"
    >
      <Bell className="w-10 h-10 text-white/20 mb-3" />
      <p className="text-white/50 font-medium">No game notifications yet</p>
      <p className="text-white/30 text-sm mt-1">Stat gains from feeding will appear here</p>
    </div>
  ) : (
    <div className="space-y-2">
      {[...gameNotifications].reverse().map((notif) => (
        <GameNotifRow key={notif.id} notif={notif} />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen">
      <PageHero
        title="Messages"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}`
            : 'All caught up'
        }
        mood="default"
        icon={<Mail className="w-7 h-7 text-[var(--gold-400)]" />}
      >
        {/* Breadcrumb + Compose */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[var(--cream)]/60">
            <Link to="/" className="hover:text-[var(--cream)] transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link to="/community" className="hover:text-[var(--cream)] transition-colors">
              Community
            </Link>
            <span>/</span>
            <span className="text-[var(--cream)]">Messages</span>
          </div>
          <Button
            type="button"
            onClick={() => setComposeOpen(true)}
            title="Compose a new message"
            data-testid="compose-button"
          >
            <PlusCircle className="w-4 h-4" />
            Compose
          </Button>
        </div>
      </PageHero>

      {/* Compose Modal */}
      {composeOpen && <ComposeModal onClose={() => setComposeOpen(false)} />}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {/* Tab Navigation + Content — CanonicalTabs underline variant (Equoria-o5hub.11) */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v as MessageTab);
            handleCloseDetail();
          }}
        >
          <TabsList aria-label="Message folders" data-testid="message-tabs">
            <TabsTrigger value="inbox" className="gap-2" data-testid="tab-inbox">
              <Mail className="w-4 h-4" />
              Inbox
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold bg-red-500/80 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                  {unreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="sent" className="gap-2" data-testid="tab-sent">
              <Send className="w-4 h-4" />
              Sent
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2" data-testid="tab-notifications">
              <Bell className="w-4 h-4" />
              Notifications
              {gameUnreadCount > 0 && (
                <span className="text-[10px] font-bold bg-blue-500/80 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                  {gameUnreadCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Message / Notification List — only the active panel mounts, so the
              shared data-testid="message-list" is unique in the DOM. */}
          <TabsContent value="inbox" data-testid="message-list">
            {messagesBody}
          </TabsContent>
          <TabsContent value="sent" data-testid="message-list">
            {messagesBody}
          </TabsContent>
          <TabsContent value="notifications" data-testid="message-list">
            {notificationsBody}
          </TabsContent>
        </Tabs>

        {/* Info Panel */}
        <div className="mt-10 p-5 rounded-xl glass-panel text-sm text-[var(--text-muted)]">
          <h3 className="font-semibold text-[var(--cream)] mb-2">About Messages</h3>
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

export default MessagesPage;
