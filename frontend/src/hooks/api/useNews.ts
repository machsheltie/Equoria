/**
 * News hooks (Equoria-wbt8l): the players' Night Road and the staff News Desk.
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { newsApi, type NewsPostEdit, type NewsPostInput } from '@/lib/api/news';
import { isCheckinRequired } from '@/hooks/api/useStaff';

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

/**
 * A desk write refused because this browser's staff check-in has lapsed
 * (Equoria-n256i): re-read the desk, whose own refusal returns the page to
 * check-in.
 */
function useRecheckDeskOnLapse() {
  const queryClient = useQueryClient();
  return (error: unknown) => {
    if (isCheckinRequired(error)) {
      void queryClient.invalidateQueries({ queryKey: newsKeys.desk });
    }
  };
}

export function useCreateNewsPost() {
  const invalidate = useInvalidateNews();
  const recheck = useRecheckDeskOnLapse();
  return useMutation({
    mutationFn: (input: NewsPostInput) => newsApi.create(input),
    onSuccess: invalidate,
    onError: recheck,
  });
}

export function useUpdateNewsPost() {
  const invalidate = useInvalidateNews();
  const recheck = useRecheckDeskOnLapse();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: NewsPostEdit }) => newsApi.update(id, input),
    onSuccess: invalidate,
    onError: recheck,
  });
}

export function useDeleteNewsPost() {
  const invalidate = useInvalidateNews();
  const recheck = useRecheckDeskOnLapse();
  return useMutation({
    mutationFn: (id: number) => newsApi.remove(id),
    onSuccess: invalidate,
    onError: recheck,
  });
}

export function useUploadNewsImage() {
  const recheck = useRecheckDeskOnLapse();
  return useMutation({ mutationFn: (file: File) => newsApi.uploadImage(file), onError: recheck });
}
