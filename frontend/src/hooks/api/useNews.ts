/**
 * News hooks (Equoria-wbt8l): the players' Night Road and the staff News Desk.
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { newsApi, type NewsPostEdit, type NewsPostInput } from '@/lib/api/news';

export const newsKeys = {
  all: ['news'] as const,
  feed: ['news', 'feed'] as const,
  desk: ['news', 'desk'] as const,
};

/** Published News, newest first, one page per "Walk further back". */
export function useNewsFeed() {
  return useInfiniteQuery({
    queryKey: newsKeys.feed,
    queryFn: ({ pageParam }) => newsApi.feed(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useNewsDesk(enabled: boolean) {
  return useQuery({ queryKey: newsKeys.desk, queryFn: newsApi.desk, enabled });
}

/** After any desk write, both the desk and the players' feed are stale. */
function useInvalidateNews() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: newsKeys.all });
}

export function useCreateNewsPost() {
  const invalidate = useInvalidateNews();
  return useMutation({
    mutationFn: (input: NewsPostInput) => newsApi.create(input),
    onSuccess: invalidate,
  });
}

export function useUpdateNewsPost() {
  const invalidate = useInvalidateNews();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: NewsPostEdit }) => newsApi.update(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteNewsPost() {
  const invalidate = useInvalidateNews();
  return useMutation({
    mutationFn: (id: number) => newsApi.remove(id),
    onSuccess: invalidate,
  });
}

export function useUploadNewsImage() {
  return useMutation({ mutationFn: (file: File) => newsApi.uploadImage(file) });
}
