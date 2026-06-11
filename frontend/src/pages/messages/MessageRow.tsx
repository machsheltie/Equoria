/**
 * MessageRow (extracted from MessagesPage — Equoria-w2kyx)
 *
 * One row in the inbox/sent list: read indicator, avatar, contact, tag,
 * subject, preview, and timestamp. Expands an inline MessageDetailPanel
 * when selected. Pure presentational — selection state and the onSelect
 * callback come from the page container.
 *
 * Migrated to canonical primitives (Equoria-o5hub community lane):
 * Surface(interactive) clickable row, GameBadge tags, role-token colors.
 * Unread indicators use the info role — the single semantic unread
 * treatment shared with the tab badges and notification rows.
 */

import React from 'react';
import { Circle, CheckCircle2, Clock, User } from 'lucide-react';
import { Surface } from '@/components/ui/Surface';
import { GameBadge } from '@/components/ui/game';
import type { DirectMessage } from '@/lib/api-client';
import { tagBadgeVariant, relativeTime } from './constants';
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
      <Surface
        variant="interactive"
        as="button"
        // SurfaceProps is not polymorphically typed over `as` yet; spread
        // passes the button `type` attr (JSX spread is exempt from
        // excess-prop checks). Reported in shared_component_needs.
        {...{ type: 'button' }}
        className={`w-full text-left group ${
          isSelected
            ? 'border-[var(--role-accent-border)]'
            : isUnread
              ? 'border-[var(--role-info-border)]'
              : ''
        }`}
        onClick={() => onSelect(message.id)}
        aria-expanded={isSelected}
        aria-controls={`message-detail-${message.id}`}
      >
        <div className="flex items-start gap-3">
          {/* Read indicator — unread uses the info role (one unread treatment) */}
          <div className="flex-shrink-0 mt-1">
            {isUnread ? (
              <Circle className="w-2 h-2 fill-[var(--status-info)] text-[var(--status-info)]" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-role-disabled" />
            )}
          </div>

          {/* Sender avatar */}
          <div
            className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--role-neutral-bg)] flex items-center justify-center border border-[var(--role-neutral-border)]"
            aria-hidden="true"
          >
            <User className="w-4 h-4 text-role-secondary" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-0.5">
              <div className="min-w-0 flex items-center gap-2 flex-wrap">
                <span
                  className={`text-sm font-semibold break-words min-w-0 ${
                    isUnread ? 'text-role-primary' : 'text-role-secondary'
                  }`}
                >
                  {contactName}
                </span>
                {message.tag && (
                  <GameBadge
                    variant={tagBadgeVariant[message.tag] ?? 'secondary'}
                    className="text-[10px]"
                  >
                    {message.tag}
                  </GameBadge>
                )}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-role-muted flex-shrink-0">
                <Clock className="w-3 h-3" aria-hidden="true" />
                {relativeTime(message.createdAt)}
              </div>
            </div>
            <div
              className={`text-sm mb-1 break-words ${
                isUnread ? 'font-semibold text-role-primary' : 'text-role-secondary'
              }`}
            >
              {message.subject}
            </div>
            <p className="text-xs text-role-muted line-clamp-1">{preview}</p>
          </div>
        </div>
      </Surface>

      {/* Inline detail panel — shown when selected */}
      {isSelected && (
        <MessageDetailPanel messageId={message.id} onClose={() => onSelect(message.id)} />
      )}
    </div>
  );
};
