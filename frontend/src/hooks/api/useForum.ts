/**
 * useForum hooks (Epic 19B-1)
 *
 * React Query hooks for the community message board.
 *   - useThreads(section?, page?)   → { threads, total, page, isLoading, error }
 *   - useThread(id)                 → { thread, posts, isLoading, error }
 *   - useCreateThread()             → mutation(CreateThreadRequest)
 *   - useCreatePost()               → mutation({ threadId, content })
 *   - useIncrementView()            → mutation(threadId)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { forumApi, ForumSection, CreateThreadRequest } from '@/lib/api-client';

/** Threads stay fresh for 60 s — active board, but no need to hammer the API */
const THREADS_STALE_TIME = 60_000;
/** Thread detail stays fresh for 30 s so new replies appear quickly */
const THREAD_STALE_TIME = 30_000;

export function useThreads(section?: ForumSection, page = 1) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['forum', 'threads', section, page],
    queryFn: () => forumApi.getThreads(section, page),
    staleTime: THREADS_STALE_TIME,
  });

  return {
    threads: data?.threads ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    isLoading,
    error,
  };
}

export function useThread(id: number | null) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['forum', 'thread', id],
    queryFn: () => forumApi.getThread(id!),
    staleTime: THREAD_STALE_TIME,
    enabled: id != null,
  });

  return {
    thread: data?.thread ?? null,
    posts: data?.posts ?? [],
    isLoading,
    error,
  };
}

export function useCreateThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (req: CreateThreadRequest) => forumApi.createThread(req),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['forum', 'threads', variables.section] });
    },
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ threadId, content }: { threadId: number; content: string }) =>
      forumApi.createPost(threadId, content),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['forum', 'thread', variables.threadId] });
    },
  });
}

export function useIncrementView() {
  return useMutation({
    mutationFn: (threadId: number) => forumApi.incrementView(threadId),
  });
}
