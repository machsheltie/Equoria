/**
 * ComposeModal (extracted from MessagesPage — Equoria-w2kyx)
 *
 * New-message composer dialog: debounced username search, recipient pick,
 * subject/body fields, and send mutation. Self-contained — owns all of its
 * own state and the useSendMessage mutation.
 *
 * Migrated to GameDialog (canonical dialog base, DECISIONS.md §8) under the
 * Equoria-o5hub community lane — replaces the page-local fixed-inset overlay
 * and nested backdrop-blur. Fields use canonical FormField + Input/Textarea;
 * errors use InlineError. The dialog's accessible name is "Compose Message"
 * (asserted by tests/e2e/community.spec.ts).
 */

import React, { useState, useEffect, useRef } from 'react';
import { Send, User, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
} from '@/components/ui/game';
import { FormField, Input, Textarea } from '@/components/ui/form';
import { InlineError } from '@/components/ui/state';
import { useSendMessage } from '@/hooks/api/useMessages';
import { usersApi } from '@/lib/api-client';

export const ComposeModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [recipientId, setRecipientId] = useState('');
  const [recipientUsername, setRecipientUsername] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; username: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const sendMessage = useSendMessage();
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await usersApi.search(searchQuery);
        setSearchResults(data.users ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery]);

  const selectRecipient = (user: { id: string; username: string }) => {
    setRecipientId(user.id);
    setRecipientUsername(user.username);
    setSearchQuery('');
    setSearchResults([]);
  };

  const canSend = recipientId.trim() && subject.trim() && content.trim();

  const handleSend = () => {
    if (!canSend) return;
    sendMessage.mutate(
      { recipientId: recipientId.trim(), subject: subject.trim(), content: content.trim() },
      {
        onSuccess: () => onClose(),
      }
    );
  };

  return (
    <GameDialog open onOpenChange={(open) => !open && onClose()}>
      <GameDialogContent size="md">
        <GameDialogHeader>
          <GameDialogTitle className="text-lg">Compose Message</GameDialogTitle>
        </GameDialogHeader>

        {/* Fields */}
        <div className="space-y-3 pt-4">
          <div className="relative">
            <FormField label="Recipient" htmlFor="compose-recipient">
              {() =>
                recipientId ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] bg-[var(--glass-surface-subtle-bg)] border border-[var(--role-accent-border)]">
                    <User className="w-3.5 h-3.5 text-[var(--gold-400)]" aria-hidden="true" />
                    <span className="text-sm text-role-primary flex-1 break-words min-w-0">
                      {recipientUsername}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0"
                      onClick={() => {
                        setRecipientId('');
                        setRecipientUsername('');
                      }}
                      aria-label="Clear recipient"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-role-muted z-[1]"
                      aria-hidden="true"
                    />
                    <Input
                      id="compose-recipient"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by username…"
                      className="pl-8"
                      autoComplete="off"
                    />
                    {searching && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-role-muted">
                        …
                      </span>
                    )}
                    {searchResults.length > 0 && (
                      <ul className="absolute z-10 w-full mt-1 rounded-[var(--radius-md)] bg-[var(--bg-midnight)] border border-[var(--glass-border)] shadow-xl overflow-hidden">
                        {searchResults.map((u) => (
                          <li key={u.id}>
                            <button
                              type="button"
                              onClick={() => selectRecipient(u)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-role-primary hover:bg-[var(--glass-surface-subtle-bg)] transition-colors"
                            >
                              <User className="w-3.5 h-3.5 text-role-muted" aria-hidden="true" />
                              {u.username}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              }
            </FormField>
          </div>
          <FormField label="Subject" htmlFor="compose-subject">
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Message subject"
              />
            )}
          </FormField>
          <FormField label="Message" htmlFor="compose-content">
            {(fieldProps) => (
              <Textarea
                {...fieldProps}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your message..."
                rows={5}
                className="resize-none"
              />
            )}
          </FormField>
        </div>

        {/* Error */}
        {sendMessage.isError && (
          <InlineError message="Failed to send message. Please try again." className="mt-3" />
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={!canSend || sendMessage.isPending}
            data-testid="send-message-button"
          >
            <Send className="w-4 h-4" />
            {sendMessage.isPending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </GameDialogContent>
    </GameDialog>
  );
};
