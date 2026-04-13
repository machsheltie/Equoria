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
 */

import React, { useState } from 'react';
import { Wrench, Lock, CheckCircle, Package, AlertCircle, Loader2 } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { useCraftingMaterials, useCraftingRecipes, useCraftItem } from '@/hooks/api/useCrafting';
import type { CraftingRecipe, CraftingMaterials } from '@/lib/api-client';
import { isBetaMode } from '@/config/betaRouteScope';
import BetaExcludedNotice from '@/components/beta/BetaExcludedNotice';

// ── Tier labels ───────────────────────────────────────────────────────────────
const TIER_LABELS: Record<number, string> = {
  0: 'No Workshop',
  1: 'Tier I Workshop',
  2: 'Tier II Workshop',
  3: 'Tier III Workshop (Master)',
};

const TIER_BADGE_COLORS: Record<number, string> = {
  0: 'bg-gray-700 text-gray-300',
  1: 'bg-amber-900/60 text-amber-300',
  2: 'bg-sky-900/60 text-sky-300',
  3: 'bg-purple-900/60 text-purple-300',
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
    <div className="flex items-center gap-1.5 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg px-3 py-2">
      <span className="text-lg">{meta.icon}</span>
      <div>
        <p className="text-xs text-[var(--text-muted)]">{meta.label}</p>
        <p className="text-sm font-semibold text-[var(--text-primary)]">{qty}</p>
      </div>
    </div>
  );
}

// ── MaterialRequirement ────────────────────────────────────────────────────────
function MaterialRequirement({ mat, need, have }: { mat: string; need: number; have: number }) {
  if (need === 0) return null;
  const meta = MATERIAL_META[mat] ?? { label: mat, icon: '📦' };
  const sufficient = have >= need;
  return (
    <span className={`text-xs ${sufficient ? 'text-[var(--text-secondary)]' : 'text-red-400'}`}>
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
    <div
      className={`rounded-xl border p-4 transition-all ${
        recipe.locked
          ? 'border-[var(--border-subtle)] bg-[var(--bg-card)] opacity-60'
          : recipe.affordable
            ? 'border-amber-600/40 bg-amber-950/20'
            : 'border-[var(--border-subtle)] bg-[var(--bg-card)]'
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
              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300 whitespace-nowrap">
                Cosmetic
              </span>
            ) : (
              <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300 whitespace-nowrap">
                {recipe.bonus}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">{recipe.description}</p>
        </div>
        {recipe.locked ? (
          <Lock className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
        ) : recipe.affordable ? (
          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
        ) : null}
      </div>

      {/* Cost & materials */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 mb-3 text-xs text-[var(--text-muted)]">
        <span className="font-medium text-amber-400">💰 {recipe.cost} coins</span>
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
      {recipe.locked && <p className="text-xs text-amber-500/80 mb-3">{recipe.lockReason}</p>}

      {/* Deficit */}
      {!recipe.locked && !recipe.affordable && recipe.deficit && (
        <p className="text-xs text-red-400 mb-3">Need: {recipe.deficit}</p>
      )}

      {/* Craft button */}
      {!recipe.locked &&
        (confirming ? (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setConfirming(false);
                onCraft(recipe.id);
              }}
              disabled={isCrafting || !recipe.affordable}
              className="flex-1 text-xs px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-white font-medium disabled:opacity-50 transition-colors"
            >
              {isCrafting ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
              Confirm Craft
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-xs px-3 py-2 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            disabled={!recipe.affordable || isCrafting}
            className="w-full text-xs px-3 py-2 rounded-lg bg-amber-800/60 hover:bg-amber-700/60 text-amber-200 font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-amber-700/40"
          >
            Craft
          </button>
        ))}
    </div>
  );
}

// ── CraftingPageContent — rendered only when isBetaMode is false ──────────────
// Hooks must not be called before the beta guard (would fire API calls to
// beta-hidden crafting endpoints). Outer CraftingPage wrapper gate is authoritative.
const CraftingPageContent: React.FC = () => {
  const { data: materialsData, isLoading: matLoading, error: matError } = useCraftingMaterials();
  const { data: recipesData, isLoading: recLoading, error: recError } = useCraftingRecipes();
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
    <div className="min-h-screen" data-testid="crafting-page">
      <PageHero
        title="Leathersmith Workshop"
        subtitle="Craft custom tack from raw materials. Upgrade your workshop to unlock advanced recipes."
        mood="default"
        icon={<Wrench className="w-7 h-7 text-[var(--gold-400)]" aria-hidden="true" />}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 space-y-8">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--text-muted)]" />
          </div>
        )}

        {hasError && !isLoading && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-950/30 border border-red-800/40 text-red-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">Failed to load crafting data. Please refresh.</p>
          </div>
        )}

        {!isLoading && !hasError && (
          <>
            {/* Workshop tier banner */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)]">
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">Your Workshop</p>
                <span
                  className={`text-sm font-semibold px-2.5 py-1 rounded-lg ${TIER_BADGE_COLORS[workshopTier] ?? TIER_BADGE_COLORS[0]}`}
                >
                  {TIER_LABELS[workshopTier] ?? `Tier ${workshopTier}`}
                </span>
              </div>
              <Wrench className="w-8 h-8 text-amber-600/60" />
            </div>

            {/* Material stockpile */}
            <section>
              <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3 flex items-center gap-2">
                <Package className="w-4 h-4" />
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
              <div className="text-center py-12 text-[var(--text-muted)]">
                <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No recipes available yet.</p>
              </div>
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
    </div>
  );
};

// ── CraftingPage — beta gate wrapper ──────────────────────────────────────────
// Beta guard runs before hooks to prevent API calls to beta-hidden endpoints.
const CraftingPage: React.FC = () => {
  if (isBetaMode) {
    return (
      <BetaExcludedNotice
        fullPage
        testId="crafting-beta-excluded"
        redirectTo="/world"
        redirectLabel="Return to World Hub"
      />
    );
  }
  return <CraftingPageContent />;
};

export default CraftingPage;
