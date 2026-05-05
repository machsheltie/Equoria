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
import { Heart, ShoppingBag, Loader2, AlertCircle, CheckCircle, Filter } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { CardGrid } from '@/components/ui/CardGrid';
import { ItemCard } from '@/components/ui/ItemCard';
import { FantasyTabs } from '@/components/FantasyTabs';
import { HorseCard } from '@/components/horse/HorseCard';
import { useTackInventory, usePurchaseTackItem } from '@/hooks/api/useTackShop';
import { useHorses } from '@/hooks/api/useHorses';
import type { TackItem } from '@/hooks/api/useTackShop';
import type { HorseSummary } from '@/lib/api-client';

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
// Sub-components
// ---------------------------------------------------------------------------
// Note: tack-condition chips and the inline repair button were previously
// rendered on each horse-picker card. They were removed here when the picker
// migrated to the shared HorseCard. Re-adding tack-condition info to the
// shared HorseCard (or an accompanying footer slot) is filed as a follow-up
// so every horse-picker surface gets it in one shot.

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
    : 'Select a Horse';

  const media = item.image ? (
    <img src={item.image} alt={item.name} className="w-20 h-20 object-contain" />
  ) : (
    <div className="w-20 h-20 rounded-lg bg-black/20 flex items-center justify-center">
      <span className="text-3xl" aria-hidden="true">
        {item.icon ?? CATEGORY_ICONS[item.category] ?? '🏷️'}
      </span>
    </div>
  );

  const meta = (
    <>
      <span
        className={`text-[0.6rem] font-semibold uppercase px-1.5 py-0.5 rounded ${tierStyle.bg} ${tierStyle.text}`}
      >
        {tierStyle.label}
      </span>
      {item.bonus && (
        <span className="text-[0.65rem] text-[var(--gold-light)] font-medium">{item.bonus}</span>
      )}
      {item.disciplines.map((d) => (
        <span
          key={d}
          className="text-[0.6rem] px-1.5 py-0.5 rounded bg-[var(--glass-glow)] text-[var(--text-muted)]"
        >
          {d}
        </span>
      ))}
      {item.ageRestriction && (
        <span className="text-[0.6rem] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-medium">
          ≤ {item.ageRestriction} yrs
        </span>
      )}
    </>
  );

  const action = (
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
  );

  return (
    <ItemCard
      data-testid={`tack-item-${item.id}`}
      media={media}
      title={item.name}
      description={item.description}
      meta={meta}
      price={`$${item.cost.toLocaleString()}`}
      action={action}
    />
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
          <CardGrid aria-label={`${categoryNames[categoryKey] ?? categoryKey} items`}>
            {items.map((item) => (
              <TackItemCard
                key={item.id}
                item={item}
                selectedHorse={selectedHorse}
                onPurchase={handlePurchase}
                isPurchasing={purchaseMutation.isPending}
              />
            ))}
          </CardGrid>
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
            <div className="mb-6">
              <CardGrid aria-label="Decorative tack">
                {decorativeItems.regular.map((item) => (
                  <TackItemCard
                    key={item.id}
                    item={item}
                    selectedHorse={selectedHorse}
                    onPurchase={handlePurchase}
                    isPurchasing={purchaseMutation.isPending}
                  />
                ))}
              </CardGrid>
            </div>
          )}

          {/* Seasonal sub-section */}
          {decorativeItems.seasonal.length > 0 && (
            <>
              <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-3">
                🍂 Seasonal
              </h3>
              <CardGrid aria-label="Seasonal decorative tack">
                {decorativeItems.seasonal.map((item) => (
                  <TackItemCard
                    key={item.id}
                    item={item}
                    selectedHorse={selectedHorse}
                    onPurchase={handlePurchase}
                    isPurchasing={purchaseMutation.isPending}
                  />
                ))}
              </CardGrid>
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
        Select a horse, then switch to the Shop tab to purchase tack. Tack condition is visible on
        each horse&rsquo;s detail page.
      </p>
      <CardGrid aria-label="Your horses">
        {horses.map((horse) => (
          <HorseCard
            key={horse.id}
            horse={horse}
            selected={selectedHorse?.id === horse.id}
            onClick={() => onSelectHorse(horse)}
            data-testid={`horse-card-${horse.id}`}
          />
        ))}
      </CardGrid>

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
        {/* My Horses / Shop tabs — FantasyTabs (canonical from StableView).
            Controlled so HorsesTackTab's "Continue to Shop" and ShopTab's
            "Change horse" can switch tabs programmatically. */}
        <FantasyTabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TackShopTab)}
          tabs={[
            {
              value: 'horses',
              label: 'My Horses',
              icon: <Heart className="w-4 h-4" />,
              content: (
                <HorsesTackTab
                  selectedHorse={selectedHorse}
                  onSelectHorse={handleSelectHorse}
                  onGoToShop={handleGoToShop}
                />
              ),
            },
            {
              value: 'shop',
              label: 'Shop',
              icon: <ShoppingBag className="w-4 h-4" />,
              content: (
                <ShopTab
                  selectedHorse={selectedHorse}
                  onSwitchToHorses={() => setActiveTab('horses')}
                />
              ),
            },
          ]}
        />

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
