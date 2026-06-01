/**
 * MessageRow (extracted from MessagesPage — Equoria-w2kyx)
 *
 * One row in the inbox/sent list: read indicator, avatar, contact, tag,
 * subject, preview, and timestamp. Expands an inline MessageDetailPanel
 * when selected. Pure presentational — selection state and the onSelect
 * callback come from the page container.
 */

import React from 'react';
import { Circle, CheckCircle2, Clock, User } from 'lucide-react';
import type { DirectMessage } from '@/lib/api-client';
import { tagColors, relativeTime } from './constants';
import { MessageDetailPanel } from './MessageDetailPanel';

export const MessageRow: React.FC<{
  message: DirectMessage;
  isInbox: boolean;
  isSelected: boolean;
  onSelect: (_id: number) => void;
}> = ({ message, isInbox, isSelected, onSelect }) => {
  const contactName = isInbox ? message.sender.username : `To: ${message.recipient.username}`;
  const preview =
    message.content.length > 120 ? `${message.content.slice(0, 120)}…` : message.content;
  const isUnread = isInbox && !message.isRead;

  return (
    <div data-testid={`message-${message.id}`}>
      <button
        type="button"
        className={`w-full text-left group glass-panel hover:bg-white/8 ${
          isSelected
            ? 'border-[rgba(200,168,78,0.35)] bg-white/5'
            : isUnread
              ? 'border-emerald-500/20'
              : 'hover:border-white/20'
        }`}
        onClick={() => onSelect(message.id)}
        aria-expanded={isSelected}
        aria-controls={`message-detail-${message.id}`}
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
      </button>

      {/* Inline detail panel — shown when selected */}
      {isSelected && (
        <MessageDetailPanel messageId={message.id} onClose={() => onSelect(message.id)} />
      )}
    </div>
  );
};
