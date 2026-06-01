/**
 * MessageDetailPanel (extracted from MessagesPage — Equoria-w2kyx)
 *
 * Inline expanded view of a single message: loads full content via
 * useMessage, shows sender/recipient/time header and the body. Rendered
 * beneath a selected MessageRow.
 */

import React from 'react';
import { Clock, X } from 'lucide-react';
import { useMessage } from '@/hooks/api/useMessages';
import { relativeTime } from './constants';

export const MessageDetailPanel: React.FC<{ messageId: number; onClose: () => void }> = ({
  messageId,
  onClose,
}) => {
  const { data, isLoading, error } = useMessage(messageId);
  const message = data?.message;

  return (
    <div
      className="mt-2 glass-panel border border-[rgba(200,168,78,0.2)] rounded-xl p-5 space-y-3"
      data-testid={`message-detail-${messageId}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {isLoading && (
            <div className="space-y-2">
              <div className="h-4 bg-white/10 rounded animate-pulse w-2/3" />
              <div className="h-3 bg-white/10 rounded animate-pulse w-1/3" />
            </div>
          )}
          {error && (
            <p className="text-xs text-[var(--status-error)]">Failed to load message content.</p>
          )}
          {message && (
            <>
              <h3
                className="text-base font-semibold text-[var(--cream)] leading-tight"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {message.subject}
              </h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-white/40">
                <span>
                  From: <span className="text-white/60 font-medium">{message.sender.username}</span>
                </span>
                <span>·</span>
                <span>
                  To:{' '}
                  <span className="text-white/60 font-medium">{message.recipient.username}</span>
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {relativeTime(message.createdAt)}
                </span>
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--cream)] hover:bg-white/10 transition-colors"
          aria-label="Close message"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      {message && (
        <div className="border-t border-white/10 pt-3">
          <p className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
      )}
    </div>
  );
};
