/**
 * MessagesPage — Player Inbox / Messages (Epic 11 — Story 11-7)
 *
 * Two-tab inbox:
 *   Inbox — received messages with read/unread state
 *   Sent  — sent messages
 *
 * "Compose" button is disabled (mock-ready, pending auth wire-up).
 * All message data uses MOCK_INBOX and MOCK_SENT (labelled for API replacement).
 *
 * Uses Celestial Night theme.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Send, PlusCircle, Circle, CheckCircle2, Clock, User } from 'lucide-react';
import MainNavigation from '@/components/MainNavigation';

type MessageTab = 'inbox' | 'sent';

interface Message {
  id: string;
  subject: string;
  sender: string;
  recipient: string;
  preview: string;
  date: string;
  read: boolean;
  tag?: string;
}

// Mock inbox messages — replace with /api/messages/inbox endpoint
const MOCK_INBOX: Message[] = [
  {
    id: 'msg-1',
    subject: 'Re: Interested in your WB mare',
    sender: 'CrystalMeadows',
    recipient: 'You',
    preview: 'Thanks for the quick reply! I can offer 2,200 coins if you can hold her for 2 days.',
    date: '5 min ago',
    read: false,
    tag: 'Sales',
  },
  {
    id: 'msg-2',
    subject: 'Club invitation — Dressage Society',
    sender: 'SilverSpur',
    recipient: 'You',
    preview:
      'We would love to have you join the Dressage Society. Your competition record speaks for itself!',
    date: '1 hr ago',
    read: false,
    tag: 'Clubs',
  },
  {
    id: 'msg-3',
    subject: 'Stud inquiry for Daybreak',
    sender: 'ThoroughbredElite',
    recipient: 'You',
    preview:
      'Interested in booking a session with Champion Daybreak for my TB mare. Is he available?',
    date: '3 hr ago',
    read: false,
    tag: 'Breeding',
  },
  {
    id: 'msg-4',
    subject: 'Your competition result — Spring Invitational',
    sender: 'EquoriaSystem',
    recipient: 'You',
    preview:
      'Congratulations! Your horse placed 3rd in the Spring Invitational. Prize: 350 coins added to your account.',
    date: 'Yesterday',
    read: true,
    tag: 'System',
  },
  {
    id: 'msg-5',
    subject: 'Groom assignment confirmed',
    sender: 'EquoriaSystem',
    recipient: 'You',
    preview:
      'Your groom Elena has been successfully assigned to foal Starfire. Enrichment begins tomorrow.',
    date: 'Yesterday',
    read: true,
    tag: 'System',
  },
  {
    id: 'msg-6',
    subject: 'Monthly newsletter — February 2026',
    sender: 'EquoriaMod',
    recipient: 'You',
    preview:
      'February update: new competition schedule, Spring Classic registration open, breed club elections.',
    date: '2 days ago',
    read: true,
    tag: 'News',
  },
  {
    id: 'msg-7',
    subject: 'Training services for hire',
    sender: 'GoldBridleTraining',
    recipient: 'You',
    preview:
      'Hi! I saw your post in Services. I offer custom training plans for all disciplines — very reasonable rates.',
    date: '3 days ago',
    read: true,
  },
  {
    id: 'msg-8',
    subject: 'Art commission — interested?',
    sender: 'CanvasAndCanter',
    recipient: 'You',
    preview:
      'Love your stable! Would you be interested in a custom portrait of your champion mare? Check my portfolio.',
    date: '4 days ago',
    read: true,
    tag: 'Art',
  },
];

// Mock sent messages — replace with /api/messages/sent endpoint
const MOCK_SENT: Message[] = [
  {
    id: 'sent-1',
    subject: 'Re: Stud inquiry for Daybreak',
    sender: 'You',
    recipient: 'ThoroughbredElite',
    preview:
      'Yes, Daybreak is available next week. DM me your mare details and I can confirm the booking.',
    date: '2 hr ago',
    read: true,
  },
  {
    id: 'sent-2',
    subject: 'WB mare — is she still available?',
    sender: 'You',
    recipient: 'MidnightMane',
    preview:
      'Just saw your Sales post. Lovely mare! Is she still available? I can offer 2,300 coins.',
    date: 'Yesterday',
    read: true,
  },
  {
    id: 'sent-3',
    subject: 'Club membership question',
    sender: 'You',
    recipient: 'SilverSpur',
    preview:
      "Hi! I'd love to join the Dressage Society. What's the process? Do I need a minimum competition rank?",
    date: '2 days ago',
    read: true,
  },
  {
    id: 'sent-4',
    subject: 'Congratulations on the championship!',
    sender: 'You',
    recipient: 'RiverbendStables',
    preview: "Saw your post about Celestia winning the Grand Prix — that's incredible! Congrats!",
    date: '3 days ago',
    read: true,
  },
];

const tagColors: Record<string, string> = {
  Sales: 'bg-emerald-500/20 text-emerald-400',
  Clubs: 'bg-celestial-gold/20 text-celestial-gold',
  Breeding: 'bg-pink-500/20 text-pink-400',
  System: 'bg-blue-500/20 text-blue-400',
  News: 'bg-violet-500/20 text-violet-400',
  Art: 'bg-rose-500/20 text-rose-400',
};

const MessagesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MessageTab>('inbox');

  const messages = activeTab === 'inbox' ? MOCK_INBOX : MOCK_SENT;
  const unreadCount = MOCK_INBOX.filter((m) => !m.read).length;

  return (
    <div className="min-h-screen">
      <MainNavigation />

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
            title="Sign in to compose messages"
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
          {messages.length === 0 ? (
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
            <li>Direct messaging between community members is coming in a future update</li>
            <li>System messages are sent automatically for competition results and events</li>
            <li>Visit the Message Board to post publicly in community sections</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

const MessageRow: React.FC<{ message: Message; isInbox: boolean }> = ({ message, isInbox }) => (
  <div
    className={`group bg-white/5 border rounded-xl p-4 transition-all hover:bg-white/8 ${
      !message.read && isInbox ? 'border-emerald-500/20' : 'border-white/10 hover:border-white/20'
    }`}
    data-testid={`message-${message.id}`}
  >
    <div className="flex items-start gap-3">
      {/* Read indicator */}
      <div className="flex-shrink-0 mt-1">
        {!message.read && isInbox ? (
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
              className={`text-sm font-semibold ${!message.read && isInbox ? 'text-white/90' : 'text-white/70'}`}
            >
              {isInbox ? message.sender : `To: ${message.recipient}`}
            </span>
            {message.tag && (
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${tagColors[message.tag] ?? 'bg-white/10 text-white/50'}`}
              >
                {message.tag}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-white/30 flex-shrink-0">
            <Clock className="w-3 h-3" />
            {message.date}
          </div>
        </div>
        <div
          className={`text-sm mb-1 ${!message.read && isInbox ? 'font-semibold text-white/80' : 'text-white/60'}`}
        >
          {message.subject}
        </div>
        <p className="text-xs text-white/40 line-clamp-1">{message.preview}</p>
      </div>
    </div>
  </div>
);

export default MessagesPage;
