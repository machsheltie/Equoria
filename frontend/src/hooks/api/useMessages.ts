/**
 * useMessages hooks (Epic 19B-2)
 *
 * React Query hooks for the direct messages system.
 *   - useInbox()         → { data: InboxResponse, isLoading, error }
 *   - useSentMessages()  → { data: InboxResponse, isLoading, error }
 *   - useUnreadCount()   → { data: { count }, isLoading }
 *   - useConversationsCount() → { data: { count }, isLoading }
 *   - useMessage(id)     → { data: { message: DirectMessage }, isLoading, error }
 *   - useSendMessage()   → mutation(SendMessageRequest)
 *   - useMarkRead()      → mutation(messageId)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messagesApi, SendMessageRequest } from '@/lib/api-client';

const inboxStaleTime = 30_000;
const unreadStaleTime = 30_000;
const messageStaleTime = 60_000;

export function useInbox() {
  return useQuery({
    queryKey: ['messages', 'inbox'],
    queryFn: () => messagesApi.getInbox(),
    staleTime: inboxStaleTime,
  });
}

export function useSentMessages() {
  return useQuery({
    queryKey: ['messages', 'sent'],
    queryFn: () => messagesApi.getSent(),
    staleTime: inboxStaleTime,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['messages', 'unread-count'],
    queryFn: () => messagesApi.getUnreadCount(),
    staleTime: unreadStaleTime,
    // Owner ruling 2026-10-23 (Equoria-m00gp, option a): the community hub shows
    // an honest error with Try again when this cannot load. The default
    // networkMode 'online' pauses an offline query (no data, no error) instead.
    networkMode: 'always',
  });
}

/**
 * Distinct correspondents — users the caller has exchanged at least one
 * message with, in either direction (Equoria-r4cyk: backs the community-hub
 * "Conversations" stat with real data).
 */
export function useConversationsCount() {
  return useQuery({
    queryKey: ['messages', 'conversations-count'],
    queryFn: () => messagesApi.getConversationsCount(),
    staleTime: unreadStaleTime,
    // Owner ruling 2026-10-23 (Equoria-m00gp, option a): the community hub shows
    // an honest error with Try again when this cannot load. The default
    // networkMode 'online' pauses an offline query (no data, no error) instead.
    networkMode: 'always',
  });
}

/**
 * Fetch a single message by ID and auto-mark it as read server-side.
 * The backend GET /api/v1/messages/:id marks the message read on access,
 * so we also invalidate the inbox + unread-count queries on success.
 */
export function useMessage(id: number | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['messages', 'detail', id],
    queryFn: async () => {
      const result = await messagesApi.getMessage(id as number);
      // After fetching, the backend has marked it read — refresh counts
      queryClient.invalidateQueries({ queryKey: ['messages', 'inbox'] });
      queryClient.invalidateQueries({ queryKey: ['messages', 'unread-count'] });
      return result;
    },
    enabled: id !== null,
    staleTime: messageStaleTime,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: SendMessageRequest) => messagesApi.sendMessage(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', 'sent'] });
      queryClient.invalidateQueries({ queryKey: ['messages', 'unread-count'] });
    },
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => messagesApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', 'inbox'] });
      queryClient.invalidateQueries({ queryKey: ['messages', 'unread-count'] });
    },
  });
}
