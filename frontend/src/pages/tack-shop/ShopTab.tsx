/**
 * ShopTab (extracted from TackShopPage — Equoria-f5xni)
 *
 * The "Shop" tab: loads live tack inventory, applies a discipline filter,
 * renders functional categories plus a separated Decorative & Parade
 * section (regular + seasonal), and drives the purchase mutation for the
 * currently-selected horse. Owns its own loading / error / success states.
 */

import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Loader2, AlertCircle, CheckCircle, Filter } from 'lucide-react';
import { CardGrid } from '@/components/ui/CardGrid';
import { useTackInventory, usePurchaseTackItem } from '@/hooks/api/useTackShop';
import type { TackItem } from '@/hooks/api/useTackShop';
import type { HorseSummary } from '@/lib/api-client';
import { TackItemCard } from './TackItemCard';
import { DEFAULT_CATEGORY_NAMES, DISCIPLINE_OPTIONS } from './constants';

interface ShopTabProps {
  selectedHorse: HorseSummary | null;
  onSwitchToHorses: () => void;
}

export const ShopTab: React.FC<ShopTabProps> = ({ selectedHorse, onSwitchToHorses }) => {
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
