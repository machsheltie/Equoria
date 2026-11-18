/**
 * Steward's Office content-moderation hooks (Equoria-puj1e.3, owner rulings q375/q376).
 *
 * Every change refreshes the ledger; post changes also refresh the forum caches so
 * the thread a steward is reading shows the change at once.
 */

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffContentApi } from '@/lib/api/staffContent';
import { staffKeys } from './useStaff';

export const heldPostsKey = ['staff', 'forum-held'] as const;
const forumKey = ['forum'] as const;

function useRefresh() {
  const queryClient = useQueryClient();
  return (alsoForum: boolean) => {
    queryClient.invalidateQueries({ queryKey: staffKeys.log });
    if (alsoForum) {
      queryClient.invalidateQueries({ queryKey: forumKey });
      queryClient.invalidateQueries({ queryKey: heldPostsKey });
    }
  };
}

export function useLookupHorseName() {
  return useMutation({
    mutationKey: [...staffKeys.all, 'horse-name'],
    mutationFn: (horseId: number) => staffContentApi.horse(horseId),
  });
}

export function useLookupShowName() {
  return useMutation({
    mutationKey: [...staffKeys.all, 'show-name'],
    mutationFn: (showId: number) => staffContentApi.show(showId),
  });
}

export function useRenameHorse() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (args: { horseId: number; name: string; reason: string }) =>
      staffContentApi.renameHorse(args.horseId, args.name, args.reason),
    onSuccess: () => refresh(false),
  });
}

export function useRenameShow() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (args: { showId: number; name: string; reason: string }) =>
      staffContentApi.renameShow(args.showId, args.name, args.reason),
    onSuccess: () => refresh(false),
  });
}

export function useRenamePlayer() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (args: { username: string; newUsername: string; reason: string }) =>
      staffContentApi.renamePlayer(args.username, args.newUsername, args.reason),
    onSuccess: () => refresh(false),
  });
}

export function useEditForumPost() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (args: { postId: number; content: string; reason: string }) =>
      staffContentApi.editPost(args.postId, args.content, args.reason),
    onSuccess: () => refresh(true),
  });
}

export function useRemoveForumPost() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (args: { postId: number; reason: string }) =>
      staffContentApi.removePost(args.postId, args.reason),
    onSuccess: () => refresh(true),
  });
}

export function useHeldPosts() {
  return useInfiniteQuery({
    queryKey: heldPostsKey,
    queryFn: ({ pageParam }) => staffContentApi.heldPosts(pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextAfter ?? undefined,
  });
}

export function useDecideHeldPost() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (args: { postId: number; decision: 'accept' | 'reject'; reason?: string }) =>
      args.decision === 'accept'
        ? staffContentApi.acceptPost(args.postId)
        : staffContentApi.rejectPost(args.postId, args.reason ?? ''),
    onSuccess: () => refresh(true),
  });
}
