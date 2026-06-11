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
 * Decomposed under Equoria-w2kyx: the sub-components (ComposeModal,
 * MessageRow, MessageDetailPanel, GameNotifRow) and constants/helpers live
 * under `pages/messages/`. This file is now the thin container — tab state,
 * the live queries, and the list/tab rendering.
 *
 * Migrated to the canonical design system (Equoria-o5hub community lane):
 * PageContainer(content) + PageHeader (Compose in the actions slot),
 * Skeleton loading rows, EmptyState empties, ONE semantic role treatment
 * for unread-count badges (info role — shared by inbox + notifications).
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Send, PlusCircle, Bell } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/game';
import { Skeleton } from '@/components/ui/state';
import EmptyState from '@/components/ui/EmptyState';
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

/**
 * Unread-count badge — the ONE semantic role treatment for unread indicators
 * across the messaging family (handoff §10): info role tokens, pill shape.
 */
const UnreadCountBadge: React.FC<{ count: number }> = ({ count }) => (
  <span className="text-[10px] font-bold bg-[var(--role-info-bg)] text-[var(--role-info-text)] border border-[var(--role-info-border)] rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
    {count}
  </span>
);

/** Shared loading skeleton for message/notification lists. */
const ListSkeleton: React.FC = () => (
  <div className="space-y-2">
    {[1, 2, 3].map((i) => (
      <Surface key={i} variant="panel">
        <div className="flex gap-3">
          <Skeleton.Circle size={32} />
          <div className="flex-1 space-y-2">
            <Skeleton.Line className="w-1/3" />
            <Skeleton.Line className="w-2/3" />
          </div>
        </div>
      </Surface>
    ))}
  </div>
);

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
    <ListSkeleton />
  ) : messages.length === 0 ? (
    <div data-testid="empty-messages">
      <EmptyState
        variant="first-use"
        icon={<Mail className="h-8 w-8 text-[var(--gold-400)]" aria-hidden="true" />}
        title={activeTab === 'inbox' ? 'Your inbox is empty' : 'No sent messages'}
        description={
          activeTab === 'inbox'
            ? 'Messages from other players will appear here.'
            : 'Messages you send will appear here.'
        }
      />
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
    <ListSkeleton />
  ) : gameNotifications.length === 0 ? (
    <div data-testid="empty-notifications">
      <EmptyState
        variant="first-use"
        icon={<Bell className="h-8 w-8 text-[var(--gold-400)]" aria-hidden="true" />}
        title="No game notifications yet"
        description="Stat gains from feeding will appear here"
      />
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
      <PageContainer variant="content" padded={false} className="pb-8">
        <PageHeader
          title="Messages"
          subtitle={
            unreadCount > 0
              ? `${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}`
              : 'All caught up'
          }
          icon={<Mail className="w-5 h-5 text-[var(--gold-400)]" aria-hidden="true" />}
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
              <span className="text-[var(--text-primary)]">Messages</span>
            </div>
          }
          actions={
            <Button
              type="button"
              onClick={() => setComposeOpen(true)}
              title="Compose a new message"
              data-testid="compose-button"
            >
              <PlusCircle className="w-4 h-4" />
              Compose
            </Button>
          }
          className="mb-6"
        />

        {/* Compose Modal */}
        {composeOpen && <ComposeModal onClose={() => setComposeOpen(false)} />}

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
              {unreadCount > 0 && <UnreadCountBadge count={unreadCount} />}
            </TabsTrigger>
            <TabsTrigger value="sent" className="gap-2" data-testid="tab-sent">
              <Send className="w-4 h-4" />
              Sent
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2" data-testid="tab-notifications">
              <Bell className="w-4 h-4" />
              Notifications
              {gameUnreadCount > 0 && <UnreadCountBadge count={gameUnreadCount} />}
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
        <Surface variant="panel" className="mt-10 text-sm text-role-muted">
          <h3 className="font-semibold text-role-primary mb-2">About Messages</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Send direct messages to other community members</li>
            <li>System messages are sent automatically for competition results and events</li>
            <li>Visit the Message Board to post publicly in community sections</li>
          </ul>
        </Surface>
      </PageContainer>
    </div>
  );
};

export default MessagesPage;
