/**
 * ComposeModal (extracted from MessagesPage — Equoria-w2kyx)
 *
 * New-message composer modal: debounced username search, recipient pick,
 * subject/body fields, and send mutation. Self-contained — owns all of its
 * own state and the useSendMessage mutation.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Send, User, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Compose message"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg glass-panel rounded-2xl border border-[rgba(200,168,78,0.2)] p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2
            className="text-lg font-bold text-[var(--cream)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            New Message
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--cream)] hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-3">
          <div className="relative">
            <label
              htmlFor="compose-recipient"
              className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1"
            >
              Recipient
            </label>
            {recipientId ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(10,22,50,0.5)] border border-[rgba(200,168,78,0.4)]">
                <User className="w-3.5 h-3.5 text-[var(--gold-400)]" />
                <span className="text-sm text-[var(--cream)] flex-1">{recipientUsername}</span>
                <button
                  type="button"
                  onClick={() => {
                    setRecipientId('');
                    setRecipientUsername('');
                  }}
                  className="text-[var(--text-muted)] hover:text-[var(--cream)] transition-colors"
                  aria-label="Clear recipient"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
                <input
                  id="compose-recipient"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by username…"
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-[rgba(10,22,50,0.5)] border border-[rgba(100,130,165,0.25)] text-[var(--cream)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[rgba(200,168,78,0.4)] transition-colors"
                />
                {searching && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]">
                    …
                  </span>
                )}
                {searchResults.length > 0 && (
                  <ul className="absolute z-10 w-full mt-1 rounded-lg bg-[rgba(10,22,50,0.95)] border border-[rgba(100,130,165,0.25)] shadow-xl overflow-hidden">
                    {searchResults.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => selectRecipient(u)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--cream)] hover:bg-white/10 transition-colors"
                        >
                          <User className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                          {u.username}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <div>
            <label
              htmlFor="compose-subject"
              className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1"
            >
              Subject
            </label>
            <input
              id="compose-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Message subject"
              className="w-full px-3 py-2 rounded-lg bg-[rgba(10,22,50,0.5)] border border-[rgba(100,130,165,0.25)] text-[var(--cream)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[rgba(200,168,78,0.4)] transition-colors"
            />
          </div>
          <div>
            <label
              htmlFor="compose-content"
              className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1"
            >
              Message
            </label>
            <textarea
              id="compose-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your message..."
              rows={5}
              className="w-full px-3 py-2 rounded-lg bg-[rgba(10,22,50,0.5)] border border-[rgba(100,130,165,0.25)] text-[var(--cream)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[rgba(200,168,78,0.4)] transition-colors resize-none"
            />
          </div>
        </div>

        {/* Error */}
        {sendMessage.isError && (
          <p className="text-xs text-[var(--status-error)]">
            Failed to send message. Please try again.
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-1">
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
      </div>
    </div>
  );
};
