/**
 * CraftingPage — World > Leathersmith Workshop
 *
 * Shows the player's crafting material stockpile, workshop tier, and available recipes.
 * Players can craft items that go directly into their inventory.
 *
 * Sections:
 *   - Workshop header with tier indicator
 *   - Material stockpile at a glance
 *   - Recipe list grouped by tier, with locked/unlocked/affordable state
 *   - Craft button per recipe with confirmation
 *
 * Design-system migration (Equoria-o5hub, world-services family): management
 * page → PageHeader (no location artwork), PageContainer wide, Surface for
 * panels/cards, semantic role tokens for tier/status colors, Currency for
 * recipe costs, canonical SectionLoading / ErrorState / EmptyState.
 */

import React, { useState } from 'react';
import { Wrench, Lock, CheckCircle, Package } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/button';
import Currency from '@/components/ui/Currency';
import { SectionLoading, ErrorState } from '@/components/ui/state';
import EmptyState from '@/components/ui/EmptyState';
import { useCraftingMaterials, useCraftingRecipes, useCraftItem } from '@/hooks/api/useCrafting';
import type { CraftingRecipe, CraftingMaterials } from '@/lib/api-client';

// ── Tier labels ───────────────────────────────────────────────────────────────
const TIER_LABELS: Record<number, string> = {
  0: 'No Workshop',
  1: 'Tier I Workshop',
  2: 'Tier II Workshop',
  3: 'Tier III Workshop (Master)',
};

// Semantic role tokens per workshop tier (DECISIONS.md §7):
// 0 → neutral, 1 → warning (amber), 2 → info (blue), 3 → rare (violet).
const TIER_BADGE_COLORS: Record<number, string> = {
  0: 'bg-[var(--role-neutral-bg)] text-[var(--role-neutral-text)]',
  1: 'bg-[var(--role-warning-bg)] text-[var(--role-warning-text)]',
  2: 'bg-[var(--role-info-bg)] text-[var(--role-info-text)]',
  3: 'bg-[var(--badge-rare-bg)] text-[var(--status-rare)]',
};

// ── Material display ──────────────────────────────────────────────────────────
const MATERIAL_META: Record<string, { label: string; icon: string }> = {
  leather: { label: 'Leather', icon: '🟤' },
  cloth: { label: 'Cloth', icon: '🧵' },
  dye: { label: 'Dye', icon: '🎨' },
  metal: { label: 'Metal', icon: '⚙️' },
  thread: { label: 'Thread', icon: '🪡' },
};

// ── MaterialChip ──────────────────────────────────────────────────────────────
function MaterialChip({ mat, qty }: { mat: string; qty: number }) {
  const meta = MATERIAL_META[mat] ?? { label: mat, icon: '📦' };
  return (
    <Surface variant="subtle" className="flex items-center gap-1.5 px-3 py-2">
      <span className="text-lg" aria-hidden="true">
        {meta.icon}
      </span>
      <div>
        <p className="text-xs text-[var(--text-muted)]">{meta.label}</p>
        <p className="text-sm font-semibold text-[var(--text-primary)]">{qty}</p>
      </div>
    </Surface>
  );
}

// ── MaterialRequirement ────────────────────────────────────────────────────────
function MaterialRequirement({ mat, need, have }: { mat: string; need: number; have: number }) {
  if (need === 0) return null;
  const meta = MATERIAL_META[mat] ?? { label: mat, icon: '📦' };
  const sufficient = have >= need;
  return (
    <span
      className={`text-xs ${sufficient ? 'text-[var(--text-secondary)]' : 'text-[var(--role-danger-text)]'}`}
    >
      {meta.icon} {need} {meta.label}
      {!sufficient && ` (have ${have})`}
    </span>
  );
}

// ── RecipeCard ────────────────────────────────────────────────────────────────
function RecipeCard({
  recipe,
  playerMaterials,
  onCraft,
  isCrafting,
}: {
  recipe: CraftingRecipe;
  playerMaterials: CraftingMaterials;
  onCraft: (_recipeId: string) => void;
  isCrafting: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  const materialKeys = ['leather', 'cloth', 'dye', 'metal', 'thread'];
  const hasMaterials = materialKeys.some(
    (k) => (recipe.materials[k as keyof typeof recipe.materials] ?? 0) > 0
  );

  return (
    <Surface
      variant="subtle"
      className={`p-4 transition-all ${
        recipe.locked
          ? 'opacity-60'
          : recipe.affordable
            ? 'border-[var(--role-accent-border)] bg-[var(--role-accent-bg)]'
            : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {recipe.name}
            </h3>
            {recipe.isCosmetic ? (
              <span className="text-xs px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--badge-rare-bg)] text-[var(--status-rare)] whitespace-nowrap">
                Cosmetic
              </span>
            ) : (
              <span className="text-xs px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--role-success-bg)] text-[var(--role-success-text)] whitespace-nowrap">
                {recipe.bonus}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">{recipe.description}</p>
        </div>
        {recipe.locked ? (
          <Lock className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
        ) : recipe.affordable ? (
          <CheckCircle className="w-4 h-4 text-[var(--role-success-text)] flex-shrink-0 mt-0.5" />
        ) : null}
      </div>

      {/* Cost & materials */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 mb-3 text-xs text-[var(--text-muted)]">
        <Currency amount={recipe.cost} className="font-medium text-[var(--role-accent-text)]" />
        {hasMaterials &&
          materialKeys.map((mat) =>
            (recipe.materials[mat as keyof typeof recipe.materials] ?? 0) > 0 ? (
              <MaterialRequirement
                key={mat}
                mat={mat}
                need={recipe.materials[mat as keyof typeof recipe.materials] ?? 0}
                have={playerMaterials[mat as keyof CraftingMaterials] ?? 0}
              />
            ) : null
          )}
      </div>

      {/* Lock reason */}
      {recipe.locked && (
        <p className="text-xs text-[var(--role-warning-text)] mb-3">{recipe.lockReason}</p>
      )}

      {/* Deficit */}
      {!recipe.locked && !recipe.affordable && recipe.deficit && (
        <p className="text-xs text-[var(--role-danger-text)] mb-3">Need: {recipe.deficit}</p>
      )}

      {/* Craft button */}
      {!recipe.locked &&
        (confirming ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => {
                setConfirming(false);
                onCraft(recipe.id);
              }}
              disabled={isCrafting || !recipe.affordable}
              pending={isCrafting}
            >
              Confirm Craft
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            className="w-full"
            onClick={() => setConfirming(true)}
            disabled={!recipe.affordable || isCrafting}
          >
            Craft
          </Button>
        ))}
    </Surface>
  );
}

const CraftingPage: React.FC = () => {
  const {
    data: materialsData,
    isLoading: matLoading,
    error: matError,
    refetch: refetchMaterials,
  } = useCraftingMaterials();
  const {
    data: recipesData,
    isLoading: recLoading,
    error: recError,
    refetch: refetchRecipes,
  } = useCraftingRecipes();
  const craftMutation = useCraftItem();

  const isLoading = matLoading || recLoading;
  const hasError = matError || recError;

  const workshopTier = materialsData?.workshopTier ?? 0;
  const materials = materialsData?.materials ?? {
    leather: 0,
    cloth: 0,
    dye: 0,
    metal: 0,
    thread: 0,
  };
  const recipes = recipesData?.recipes ?? [];

  // Group recipes by tier
  const byTier: Record<number, CraftingRecipe[]> = {};
  for (const recipe of recipes) {
    if (!byTier[recipe.tier]) byTier[recipe.tier] = [];
    byTier[recipe.tier].push(recipe);
  }
  const tierKeys = Object.keys(byTier).map(Number).sort();

  return (
    <PageContainer variant="wide" padded={false} className="pb-12" data-testid="crafting-page">
      <PageHeader
        title="Leathersmith Workshop"
        subtitle="Craft custom tack from raw materials. Upgrade your workshop to unlock advanced recipes."
        icon={<Wrench className="w-6 h-6 text-[var(--gold-400)]" aria-hidden="true" />}
      />

      <div className="mt-6 space-y-8">
        {isLoading && <SectionLoading label="Loading crafting data" minHeight="200px" />}

        {hasError && !isLoading && (
          <ErrorState
            title="Crafting Data Unavailable"
            message="Failed to load crafting data. Please try again."
            retry={{
              label: 'Try Again',
              onClick: () => {
                refetchMaterials();
                refetchRecipes();
              },
            }}
          />
        )}

        {!isLoading && !hasError && (
          <>
            {/* Workshop tier banner */}
            <Surface variant="panel" className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">Your Workshop</p>
                <span
                  className={`text-sm font-semibold px-2.5 py-1 rounded-[var(--radius-sm)] ${TIER_BADGE_COLORS[workshopTier] ?? TIER_BADGE_COLORS[0]}`}
                >
                  {TIER_LABELS[workshopTier] ?? `Tier ${workshopTier}`}
                </span>
              </div>
              <Wrench className="w-8 h-8 text-[var(--gold-400)]" aria-hidden="true" />
            </Surface>

            {/* Material stockpile */}
            <section>
              <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3 flex items-center gap-2">
                <Package className="w-4 h-4" aria-hidden="true" />
                Material Stockpile
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {Object.entries(MATERIAL_META).map(([mat]) => (
                  <MaterialChip
                    key={mat}
                    mat={mat}
                    qty={materials[mat as keyof typeof materials] ?? 0}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Materials are earned from daily login bonuses, competition placements, and weekly
                stable tasks.
              </p>
            </section>

            {/* Recipe list by tier */}
            {tierKeys.length === 0 ? (
              <EmptyState
                variant="unavailable"
                icon={<Wrench className="w-8 h-8" aria-hidden="true" />}
                title="No Recipes Available"
                description="No recipes available yet. Check back after your next workshop upgrade."
              />
            ) : (
              tierKeys.map((tier) => (
                <section key={tier}>
                  <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
                    {tier === 0
                      ? 'Basic Recipes (No Workshop Needed)'
                      : `${TIER_LABELS[tier] ?? `Tier ${tier}`} Recipes`}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {byTier[tier].map((recipe) => (
                      <RecipeCard
                        key={recipe.id}
                        recipe={recipe}
                        playerMaterials={materials}
                        onCraft={(recipeId) => craftMutation.mutate(recipeId)}
                        isCrafting={craftMutation.isPending}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
};

export default CraftingPage;
