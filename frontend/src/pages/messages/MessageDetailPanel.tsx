/**
 * MessageDetailPanel (extracted from MessagesPage — Equoria-w2kyx)
 *
 * Inline expanded view of a single message: loads full content via
 * useMessage, shows sender/recipient/time header and the body. Rendered
 * beneath a selected MessageRow.
 *
 * Migrated to canonical primitives (Equoria-o5hub community lane):
 * Surface panel (accent border marks the open item), Skeleton loading,
 * InlineError, Button icon close, role-token colors. Message bodies wrap
 * (whitespace-pre-wrap + break-words) so long unbroken content cannot clip.
 */

import React from 'react';
import { Clock, X } from 'lucide-react';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/button';
import { Skeleton, InlineError } from '@/components/ui/state';
import { useMessage } from '@/hooks/api/useMessages';
import { relativeTime } from './constants';

export const MessageDetailPanel: React.FC<{ messageId: number; onClose: () => void }> = ({
  messageId,
  onClose,
}) => {
  const { data, isLoading, error } = useMessage(messageId);
  const message = data?.message;

  return (
    <Surface
      variant="panel"
      className="mt-2 border-[var(--role-accent-border)] space-y-3"
      data-testid={`message-detail-${messageId}`}
      id={`message-detail-${messageId}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {isLoading && (
            <div className="space-y-2">
              <Skeleton.Line className="w-2/3" />
              <Skeleton.Line className="w-1/3" />
            </div>
          )}
          {error && <InlineError message="Failed to load message content." />}
          {message && (
            <>
              <h3
                className="text-base font-semibold text-role-primary leading-tight break-words"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {message.subject}
              </h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-role-muted">
                <span className="break-words">
                  From:{' '}
                  <span className="text-role-secondary font-medium">{message.sender.username}</span>
                </span>
                <span>·</span>
                <span className="break-words">
                  To:{' '}
                  <span className="text-role-secondary font-medium">
                    {message.recipient.username}
                  </span>
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  {relativeTime(message.createdAt)}
                </span>
              </div>
            </>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="flex-shrink-0 h-8 w-8"
          onClick={onClose}
          aria-label="Close message"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Body */}
      {message && (
        <div className="border-t border-[var(--glass-border)] pt-3">
          <p className="text-sm text-role-secondary leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>
      )}
    </Surface>
  );
};
