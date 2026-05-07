import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gameNotificationsApi, GameNotificationsResponse } from '@/lib/api-client';

const STALE_TIME = 30_000;

export function useGameNotifications() {
  return useQuery<GameNotificationsResponse>({
    queryKey: ['game-notifications'],
    queryFn: () => gameNotificationsApi.getAll(),
    staleTime: STALE_TIME,
  });
}

export function useMarkGameNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => gameNotificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['messages', 'unread-count'] });
    },
  });
}
