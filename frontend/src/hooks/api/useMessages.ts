/**
 * useMessages hooks (Epic 19B-2)
 *
 * React Query hooks for the direct messages system.
 *   - useInbox()         → { data: InboxResponse, isLoading, error }
 *   - useSentMessages()  → { data: InboxResponse, isLoading, error }
 *   - useUnreadCount()   → { data: { count }, isLoading }
 *   - useSendMessage()   → mutation(SendMessageRequest)
 *   - useMarkRead()      → mutation(messageId)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messagesApi, SendMessageRequest } from '@/lib/api-client';

const INBOX_STALE_TIME = 30_000;
const UNREAD_STALE_TIME = 30_000;

export function useInbox() {
  return useQuery({
    queryKey: ['messages', 'inbox'],
    queryFn: () => messagesApi.getInbox(),
    staleTime: INBOX_STALE_TIME,
  });
}

export function useSentMessages() {
  return useQuery({
    queryKey: ['messages', 'sent'],
    queryFn: () => messagesApi.getSent(),
    staleTime: INBOX_STALE_TIME,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['messages', 'unread-count'],
    queryFn: () => messagesApi.getUnreadCount(),
    staleTime: UNREAD_STALE_TIME,
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
