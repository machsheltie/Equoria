/**
 * useCrafting hooks
 * React Query hooks for the Leathersmith Workshop crafting system.
 *
 * Provides:
 *   useCraftingMaterials  — player's material stockpile + workshop tier
 *   useCraftingRecipes    — all recipes with locked/unlocked status
 *   useCraftItem          — mutation to craft an item
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { craftingApi } from '@/lib/api-client';

/**
 * Fetch the player's crafting material stockpile and workshop tier.
 */
export function useCraftingMaterials() {
  return useQuery({
    queryKey: ['crafting', 'materials'],
    queryFn: () => craftingApi.getMaterials(),
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Fetch all crafting recipes with locked/unlocked/affordable status.
 */
export function useCraftingRecipes() {
  return useQuery({
    queryKey: ['crafting', 'recipes'],
    queryFn: () => craftingApi.getRecipes(),
    staleTime: 5 * 60 * 1000, // 5 minutes — recipes rarely change
  });
}

/**
 * Mutation to craft an item from a recipe.
 * On success: invalidates materials + inventory queries and shows a toast.
 */
export function useCraftItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recipeId: string) => craftingApi.craftItem(recipeId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crafting', 'materials'] });
      queryClient.invalidateQueries({ queryKey: ['crafting', 'recipes'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(`You crafted ${data?.item?.name ?? 'an item'}!`);
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to craft item');
    },
  });
}
