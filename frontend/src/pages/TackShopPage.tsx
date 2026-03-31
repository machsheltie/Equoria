/**
 * TackShopPage — World > Tack Shop Location (Epic 10 — Story 10-4)
 *
 * The Tack Shop location in the World hub. Two modes:
 * - My Horses: Select a horse to equip; shows equipped tack per horse
 * - Shop: Browse tack from the live API across all categories; purchase for selected horse
 *
 * Wired to real API hooks (Story 10-5 wire-up):
 *   useTackInventory()   — GET /api/tack-shop/inventory
 *   usePurchaseTackItem() — POST /api/tack-shop/purchase
 *   useHorses()          — GET /api/horses
 */

import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Heart,
  ShoppingBag,
  Loader2,
  AlertCircle,
  CheckCircle,
  Filter,
  Wrench,
} from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { useTackInventory, usePurchaseTackItem, useRepairTack } from '@/hooks/api/useTackShop';
import { useHorses } from '@/hooks/api/useHorses';
import type { TackItem } from '@/hooks/api/useTackShop';
import type { HorseSummary } from '@/lib/api-client';
import { getBreedName } from '@/lib/utils';

type TackShopTab = 'horses' | 'shop';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fallback display names if backend doesn't provide them */
const DEFAULT_CATEGORY_NAMES: Record<string, string> = {
  saddle: 'Saddles',
  bridle: 'Bridles',
  halter: 'Halters',
  saddle_pad: 'Saddle Pads',
  leg_wraps: 'Leg Wraps & Boots',
  reins: 'Reins',
  girth: 'Girths',
  breastplate: 'Breastplates',
};

/** Fallback emoji icons per category */
const CATEGORY_ICONS: Record<string, string> = {
  saddle: '🪣',
  bridle: '🔗',
  halter: '🐴',
  saddle_pad: '🟫',
  leg_wraps: '🦿',
  reins: '🪢',
  girth: '🟤',
  breastplate: '🛡️',
};

const DISCIPLINE_OPTIONS = [
  'All',
  'Dressage',
  'Show Jumping',
  'Cross-Country',
  'Western Pleasure',
  'Endurance',
  'Racing',
  'Eventing',
  'Reining',
  'Barrel Racing',
  'Hunter',
];

const TIER_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  basic: { bg: 'bg-slate-500/20', text: 'text-slate-300', label: 'Basic' },
  quality: { bg: 'bg-blue-500/20', text: 'text-blue-300', label: 'Quality' },
  premium: { bg: 'bg-amber-500/20', text: 'text-amber-300', label: 'Premium' },
};

// ---------------------------------------------------------------------------
// Condition helpers
// ---------------------------------------------------------------------------

/** Get Tailwind colour classes for a condition value (0–100) */
function conditionColor(condition: number): { bar: string; text: string; label: string } {
  if (condition >= 75) return { bar: 'bg-green-500', text: 'text-green-400', label: 'Good' };
  if (condition >= 50) return { bar: 'bg-yellow-500', text: 'text-yellow-400', label: 'Fair' };
  if (condition >= 25) return { bar: 'bg-orange-500', text: 'text-orange-400', label: 'Poor' };
  return { bar: 'bg-red-500', text: 'text-red-400', label: condition <= 0 ? 'Broken' : 'Critical' };
}

/** Extract condition for a tack category from Horse.tack JSON */
function getTackCondition(tack: Record<string, unknown> | undefined, category: string): number {
  if (!tack) return 100;
  const val = tack[`${category}_condition`];
  return typeof val === 'number' ? val : 100;
}

interface TackConditionChipProps {
  category: string;
  itemId: string;
  condition: number;
  horseId: number;
}

/** Small condition chip with progress bar and optional repair button */
const TackConditionChip: React.FC<TackConditionChipProps> = ({
  category,
  itemId,
  condition,
  horseId,
}) => {
  const repairMutation = useRepairTack();
  const colors = conditionColor(condition);

  const handleRepair = () => {
    repairMutation.mutate(
      { horseId, category },
      {
        onSuccess: (result) => {
          toast.success(`Repaired ${result.item.name} for $${result.repairCost}`);
        },
        onError: (err) => {
          toast.error((err as { message?: string })?.message ?? 'Repair failed.');
        },
      }
    );
  };

  return (
    <div className="flex items-center gap-2 mt-1" data-testid={`condition-chip-${category}`}>
      <span className="text-[10px] text-[var(--text-muted)] capitalize w-12 shrink-0">
        {category}
      </span>
      <div className="flex-1 h-1.5 bg-[var(--glass-bg)] rounded-full overflow-hidden border border-[var(--glass-border)]">
        <div
          className={`h-full transition-all ${colors.bar}`}
          style={{ width: `${Math.max(0, Math.min(100, condition))}%` }}
          role="progressbar"
          aria-valuenow={condition}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${category} condition: ${condition}%`}
        />
      </div>
      <span className={`text-[10px] font-medium w-8 text-right shrink-0 ${colors.text}`}>
        {condition}%
      </span>
      {condition < 100 && (
        <button
          type="button"
          onClick={handleRepair}
          disabled={repairMutation.isPending}
          title={`Repair ${itemId}`}
          className="text-[var(--text-muted)] hover:text-[var(--gold-400)] transition-colors disabled:opacity-40"
          aria-label={`Repair ${category}`}
        >
          {repairMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Wrench className="w-3 h-3" />
          )}
        </button>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface TackItemCardProps {
  item: TackItem;
  selectedHorse: HorseSummary | null;
  onPurchase: (_item: TackItem) => void;
  isPurchasing: boolean;
}

const TackItemCard: React.FC<TackItemCardProps> = ({
  item,
  selectedHorse,
  onPurchase,
  isPurchasing,
}) => {
  const canPurchase = selectedHorse !== null && !isPurchasing;
  const tierStyle = TIER_COLORS[item.tier] ?? TIER_COLORS.basic;

  const buttonLabel = selectedHorse
    ? isPurchasing
      ? 'Purchasing…'
      : `Buy for ${selectedHorse.name}`
    : 'Select a Horse to Purchase';

  return (
    <div
      className="bg-[var(--glass-bg)] backdrop-blur-sm border border-[var(--glass-border)] rounded-xl p-5 hover:border-[var(--glass-hover)] transition-all"
      data-testid={`tack-item-${item.id}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {item.image ? (
            <img src={item.image} alt={item.name} className="w-12 h-12 object-contain" />
          ) : (
            <span className="text-2xl" aria-hidden="true">
              {item.icon ?? CATEGORY_ICONS[item.category] ?? '🏷️'}
            </span>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-[var(--cream)]">{item.name}</h3>
              <span
                className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${tierStyle.bg} ${tierStyle.text}`}
              >
                {tierStyle.label}
              </span>
            </div>
            <span className="text-xs text-[var(--gold-400)] font-medium mt-0.5 block">
              {item.bonus}
            </span>
          </div>
        </div>
        <p className="text-lg font-bold text-[var(--gold-400)]">${item.cost.toLocaleString()}</p>
      </div>

      <p className="text-sm text-[var(--text-muted)] mb-2">{item.description}</p>

      {/* Discipline tags */}
      {item.disciplines.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {item.disciplines.map((d) => (
            <span
              key={d}
              className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-muted)]"
            >
              {d}
            </span>
          ))}
        </div>
      )}

      {/* Age restriction badge */}
      {item.ageRestriction && (
        <div className="mb-3">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-medium">
            For horses age {item.ageRestriction} and under
          </span>
        </div>
      )}

      <button
        type="button"
        disabled={!canPurchase}
        onClick={() => canPurchase && onPurchase(item)}
        className={`w-full py-2 text-sm font-medium rounded-lg transition-all ${
          canPurchase
            ? 'bg-[var(--status-success)]/10 border border-[var(--status-success)]/20 text-[var(--status-success)] hover:bg-[var(--status-success)]/20 hover:border-[var(--status-success)]/40 cursor-pointer'
            : 'bg-[var(--status-success)]/10 border border-[var(--status-success)]/20 text-[var(--status-success)]/60 cursor-not-allowed'
        }`}
        title={
          canPurchase
            ? `Purchase ${item.name} for ${selectedHorse!.name}`
            : 'Select a horse from My Horses to purchase'
        }
      >
        {isPurchasing && canPurchase ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            {buttonLabel}
          </span>
        ) : (
          buttonLabel
        )}
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------

interface ShopTabProps {
  selectedHorse: HorseSummary | null;
  onSwitchToHorses: () => void;
}

const ShopTab: React.FC<ShopTabProps> = ({ selectedHorse, onSwitchToHorses }) => {
  const { data, isLoading, isError, error } = useTackInventory();
  const purchaseMutation = usePurchaseTackItem();
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const [disciplineFilter, setDisciplineFilter] = useState('All');

  const handlePurchase = (item: TackItem) => {
    if (!selectedHorse) return;
    setPurchaseSuccess(null);
    purchaseMutation.mutate(
      { horseId: selectedHorse.id, itemId: item.id },
      {
        onSuccess: (result) => {
          const msg = `Purchased ${result.item.name} for ${result.horse.name}. Remaining balance: $${result.remainingMoney.toLocaleString()}`;
          setPurchaseSuccess(msg);
          toast.success(msg);
        },
        onError: () => {
          toast.error('Purchase failed. Please try again.');
        },
      }
    );
  };

  // Filter functional items by discipline (excludes decorative category)
  const filteredCategories = useMemo(() => {
    if (!data?.categories) return {};
    const result: Record<string, TackItem[]> = {};

    for (const [cat, items] of Object.entries(data.categories)) {
      if (cat === 'decorative') continue; // Rendered separately below
      const filtered =
        disciplineFilter === 'All'
          ? items
          : items.filter(
              (item) => item.disciplines.length === 0 || item.disciplines.includes(disciplineFilter)
            );
      if (filtered.length > 0) {
        result[cat] = filtered;
      }
    }
    return result;
  }, [data?.categories, disciplineFilter]);

  // Decorative items — split into regular and seasonal sub-sections
  const decorativeItems = useMemo(() => {
    const all = (data?.categories?.['decorative'] ?? []) as TackItem[];
    const regular = all.filter((i) => !i.seasonalTag);
    const seasonal = all.filter((i) => !!i.seasonalTag);
    return { regular, seasonal };
  }, [data?.categories]);

  const categoryNames = data?.categoryDisplayNames ?? DEFAULT_CATEGORY_NAMES;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64" data-testid="tack-shop-loading">
        <Loader2 className="w-8 h-8 text-[var(--gold-400)] animate-spin" />
        <span className="ml-3 text-[var(--text-muted)] text-sm">Loading inventory…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-64 gap-3 text-center"
        data-testid="tack-shop-error"
      >
        <AlertCircle className="w-10 h-10 text-red-400/60" />
        <p className="text-[var(--text-secondary)] text-sm">
          {(error as { message?: string })?.message ?? 'Failed to load tack inventory.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="tack-shop-tab">
      {/* Selected horse banner */}
      {selectedHorse ? (
        <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--status-success)]/10 border border-[var(--status-success)]/20 text-[var(--status-success)] text-sm">
          <span>
            Purchasing for: <span className="font-semibold">{selectedHorse.name}</span>
          </span>
          <button
            type="button"
            onClick={onSwitchToHorses}
            className="text-[var(--gold-400)] hover:text-[var(--cream)] underline text-xs transition-colors"
          >
            Change horse
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-muted)] text-sm">
          <span>No horse selected — go to My Horses to pick one</span>
          <button
            type="button"
            onClick={onSwitchToHorses}
            className="text-[var(--gold-400)] hover:text-[var(--cream)] underline text-xs transition-colors"
          >
            Select horse
          </button>
        </div>
      )}

      {/* Discipline filter */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-[var(--text-muted)]" />
        <select
          value={disciplineFilter}
          onChange={(e) => setDisciplineFilter(e.target.value)}
          className="bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--cream)] text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-[var(--gold-400)]"
          aria-label="Filter by discipline"
        >
          {DISCIPLINE_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d === 'All' ? 'All Disciplines' : d}
            </option>
          ))}
        </select>
        {disciplineFilter !== 'All' && (
          <button
            type="button"
            onClick={() => setDisciplineFilter('All')}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--cream)] underline transition-colors"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Purchase success banner */}
      {purchaseSuccess && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--status-success)]/10 border border-[var(--status-success)]/20 text-[var(--status-success)] text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {purchaseSuccess}
        </div>
      )}

      {/* Purchase error banner */}
      {purchaseMutation.isError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--status-danger)]/10 border border-[var(--status-danger)]/20 text-[var(--status-danger)] text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {(purchaseMutation.error as { message?: string })?.message ?? 'Purchase failed.'}
        </div>
      )}

      {/* Dynamic category sections */}
      {Object.entries(filteredCategories).map(([categoryKey, items]) => (
        <section key={categoryKey}>
          <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-4">
            {categoryNames[categoryKey] ?? categoryKey}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items.map((item) => (
              <TackItemCard
                key={item.id}
                item={item}
                selectedHorse={selectedHorse}
                onPurchase={handlePurchase}
                isPurchasing={purchaseMutation.isPending}
              />
            ))}
          </div>
        </section>
      ))}

      {Object.keys(filteredCategories).length === 0 && (
        <p className="text-sm text-[var(--text-muted)] italic text-center py-8">
          No items match the selected discipline filter.
        </p>
      )}

      {/* Decorative & Parade section */}
      {(decorativeItems.regular.length > 0 || decorativeItems.seasonal.length > 0) && (
        <section className="mt-4" data-testid="decorative-tack-section">
          <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-1 flex items-center gap-2">
            ✨ Decorative &amp; Parade
          </h2>
          <p className="text-xs text-[var(--text-muted)] mb-4">
            Cosmetic items that boost parade presentation scores. No effect on regular competition
            scoring.
          </p>

          {/* Regular decorative items */}
          {decorativeItems.regular.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {decorativeItems.regular.map((item) => (
                <TackItemCard
                  key={item.id}
                  item={item}
                  selectedHorse={selectedHorse}
                  onPurchase={handlePurchase}
                  isPurchasing={purchaseMutation.isPending}
                />
              ))}
            </div>
          )}

          {/* Seasonal sub-section */}
          {decorativeItems.seasonal.length > 0 && (
            <>
              <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-3">
                🍂 Seasonal
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {decorativeItems.seasonal.map((item) => (
                  <TackItemCard
                    key={item.id}
                    item={item}
                    selectedHorse={selectedHorse}
                    onPurchase={handlePurchase}
                    isPurchasing={purchaseMutation.isPending}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------

interface HorsesTackTabProps {
  selectedHorse: HorseSummary | null;
  onSelectHorse: (_horse: HorseSummary) => void;
  onGoToShop: () => void;
}

const HorsesTackTab: React.FC<HorsesTackTabProps> = ({
  selectedHorse,
  onSelectHorse,
  onGoToShop,
}) => {
  const { data: horses, isLoading, isError, error } = useHorses();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64" data-testid="horses-tack-loading">
        <Loader2 className="w-8 h-8 text-[var(--gold-400)] animate-spin" />
        <span className="ml-3 text-[var(--text-muted)] text-sm">Loading your horses…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-64 gap-3 text-center"
        data-testid="horses-tack-error"
      >
        <AlertCircle className="w-10 h-10 text-red-400/60" />
        <p className="text-[var(--text-secondary)] text-sm">
          {(error as { message?: string })?.message ?? 'Failed to load horses.'}
        </p>
      </div>
    );
  }

  if (!horses || horses.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-64 p-8 text-center"
        data-testid="horses-tack-tab"
      >
        <ShoppingBag className="w-12 h-12 text-[var(--gold-400)]/30 mb-4" />
        <h2 className="text-lg font-bold text-[var(--text-secondary)] mb-2">
          No Horses Registered
        </h2>
        <p className="text-sm text-[var(--text-muted)] max-w-sm mb-6">
          Visit your stable to equip tack on your horses. Quality saddles and bridles improve
          training and competition performance.
        </p>
        <Link
          to="/stable"
          className="px-5 py-2.5 bg-[var(--status-success)]/10 border border-[var(--status-success)]/20 text-[var(--status-success)] rounded-lg text-sm font-medium hover:bg-[var(--status-success)]/20 transition-all"
        >
          Go to Stable
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="horses-tack-tab">
      <p className="text-sm text-[var(--text-muted)]">
        Select a horse, then switch to the Shop tab to purchase tack.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {horses.map((horse) => {
          const isSelected = selectedHorse?.id === horse.id;
          return (
            <button
              key={horse.id}
              type="button"
              onClick={() => onSelectHorse(horse)}
              className={`text-left p-4 rounded-xl border backdrop-blur-sm transition-all ${
                isSelected
                  ? 'bg-[var(--status-success)]/10 border-[var(--status-success)]/50'
                  : 'bg-[var(--glass-bg)] border-[var(--glass-border)] hover:border-[var(--glass-hover)]'
              }`}
              data-testid={`horse-card-${horse.id}`}
              aria-pressed={isSelected}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl select-none" aria-hidden="true">
                  🐎
                </span>
                <div className="min-w-0">
                  <h3
                    className={`font-bold truncate ${isSelected ? 'text-[var(--status-success)]' : 'text-[var(--cream)]'}`}
                  >
                    {horse.name}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] truncate">
                    {getBreedName(horse.breed)} · {horse.gender}
                  </p>
                </div>
                {isSelected && (
                  <CheckCircle className="w-4 h-4 text-[var(--status-success)] flex-shrink-0 ml-auto" />
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-2">
                <span>Age {horse.age}</span>
                <span
                  className={
                    horse.healthStatus === 'Healthy'
                      ? 'text-[var(--status-success)]/70'
                      : 'text-[var(--status-warning)]/70'
                  }
                >
                  {horse.healthStatus}
                </span>
              </div>

              {/* Tack condition bars for equipped saddle + bridle */}
              {horse.tack && (
                <div className="space-y-0.5">
                  {(['saddle', 'bridle'] as const).map((cat) => {
                    const itemId = horse.tack?.[cat];
                    if (typeof itemId !== 'string') return null;
                    const condition = getTackCondition(horse.tack as Record<string, unknown>, cat);
                    return (
                      <TackConditionChip
                        key={cat}
                        category={cat}
                        itemId={itemId}
                        condition={condition}
                        horseId={horse.id}
                      />
                    );
                  })}
                  {/* Decorations chip */}
                  {Array.isArray((horse.tack as Record<string, unknown>)?.decorations) &&
                    ((horse.tack as Record<string, unknown>).decorations as string[]).length >
                      0 && (
                      <span className="inline-flex items-center gap-1 text-xs bg-purple-900/40 text-purple-300 px-2 py-0.5 rounded-full">
                        ✨{' '}
                        {((horse.tack as Record<string, unknown>).decorations as string[]).length}{' '}
                        Decoration
                        {((horse.tack as Record<string, unknown>).decorations as string[]).length >
                        1
                          ? 's'
                          : ''}
                      </span>
                    )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedHorse && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onGoToShop}
            className="px-5 py-2.5 bg-[var(--status-success)]/10 border border-[var(--status-success)]/20 text-[var(--status-success)] rounded-lg text-sm font-medium hover:bg-[var(--status-success)]/20 hover:border-[var(--status-success)]/40 transition-all"
          >
            Continue to Shop →
          </button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const TackShopPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TackShopTab>('horses');
  const [selectedHorse, setSelectedHorse] = useState<HorseSummary | null>(null);

  const handleSelectHorse = (horse: HorseSummary) => {
    setSelectedHorse(horse);
  };

  const handleGoToShop = () => {
    setActiveTab('shop');
  };

  return (
    <div className="min-h-screen">
      <PageHero
        title="Tack Shop"
        subtitle="Saddles, bridles, and specialist gear to boost your horses in competition"
        mood="golden"
        icon={<ShoppingBag className="w-7 h-7 text-[var(--gold-400)]" />}
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[var(--cream)]/60">
          <Link to="/world" className="hover:text-[var(--cream)] transition-colors">
            World
          </Link>
          <span>/</span>
          <span className="text-[var(--cream)]">Tack Shop</span>
        </div>
      </PageHero>

      {/* Banner image in glass card */}
      <div className="max-w-[52rem] mx-auto px-4 sm:px-6 lg:px-8 pt-1 pb-4">
        <div className="p-5 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-sm border border-[var(--glass-border)] shadow-lg shadow-black/20">
          <img
            src="/images/tackstoreclerk.webp"
            alt="Starlight Tack & Supply — interior view with the shopkeeper and shelves of saddles and bridles"
            className="w-full h-auto rounded-xl"
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {/* My Horses / Shop Tabs */}
        <div
          className="flex gap-1 p-1 bg-[var(--glass-bg)] backdrop-blur-sm border border-[var(--glass-border)] rounded-xl mb-8 w-fit"
          role="tablist"
          aria-label="Tack Shop section"
        >
          <button
            role="tab"
            aria-selected={activeTab === 'horses'}
            onClick={() => setActiveTab('horses')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'horses'
                ? 'bg-[var(--glass-bg)] text-[var(--cream)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
            data-testid="horses-tab"
          >
            <Heart className="w-4 h-4" />
            My Horses
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'shop'}
            onClick={() => setActiveTab('shop')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'shop'
                ? 'bg-[var(--glass-bg)] text-[var(--cream)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
            data-testid="shop-tab"
          >
            <ShoppingBag className="w-4 h-4" />
            Shop
            {selectedHorse && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-[var(--status-success)]/20 text-[var(--status-success)]">
                {selectedHorse.name}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div role="tabpanel">
          {activeTab === 'horses' ? (
            <HorsesTackTab
              selectedHorse={selectedHorse}
              onSelectHorse={handleSelectHorse}
              onGoToShop={handleGoToShop}
            />
          ) : (
            <ShopTab
              selectedHorse={selectedHorse}
              onSwitchToHorses={() => setActiveTab('horses')}
            />
          )}
        </div>

        {/* Info Panel (#7 — accurate descriptions) */}
        <div className="mt-10 p-5 rounded-xl glass-panel text-sm text-[var(--text-muted)]">
          <h3 className="font-semibold text-[var(--cream)] mb-2">About the Tack Shop</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Saddles and bridles provide direct numeric bonuses to competition scoring</li>
            <li>
              Only one item per category can be equipped at a time — purchasing replaces the old
              item
            </li>
            <li>Items with discipline tags give their full bonus in matching competitions</li>
            <li>General items (no discipline tag) work across all events</li>
            <li>
              Manage equipped tack from the{' '}
              <Link
                to="/inventory"
                className="text-[var(--gold-400)] hover:text-[var(--cream)] underline"
              >
                Inventory page
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TackShopPage;
