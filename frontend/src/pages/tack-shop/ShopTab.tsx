/**
 * ShopTab (extracted from TackShopPage — Equoria-f5xni)
 *
 * The "Shop" tab: loads live tack inventory, applies a discipline filter,
 * renders functional categories plus a separated Decorative & Parade
 * section (regular + seasonal), and drives the purchase mutation for the
 * currently-selected horse. Owns its own loading / error / success states.
 *
 * Design-system migration (Equoria-o5hub, world-services family): canonical
 * SectionLoading / ErrorState, form Select for the discipline filter,
 * semantic role tokens for banners, Button for command actions, coin
 * terminology (no USD formatting).
 */

import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle, Filter } from 'lucide-react';
import { CardGrid } from '@/components/ui/CardGrid';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form';
import { SectionLoading, ErrorState } from '@/components/ui/state';
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
  const { data, isLoading, isError, error, refetch } = useTackInventory();
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
          const msg = `Purchased ${result.item.name} for ${result.horse.name}. Remaining balance: ${result.remainingMoney.toLocaleString('en-US')} coins`;
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
      <div data-testid="tack-shop-loading">
        <SectionLoading label="Loading inventory" minHeight="256px" />
      </div>
    );
  }

  if (isError) {
    return (
      <div data-testid="tack-shop-error">
        <ErrorState
          title="Unable to Load Inventory"
          message={(error as { message?: string })?.message ?? 'Failed to load tack inventory.'}
          retry={{ label: 'Try Again', onClick: () => refetch() }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="tack-shop-tab">
      {/* Selected horse banner */}
      {selectedHorse ? (
        <div className="flex items-center justify-between p-3 rounded-[var(--radius-md)] bg-[var(--role-success-bg)] border border-[var(--role-success-border)] text-[var(--role-success-text)] text-sm">
          <span>
            Purchasing for: <span className="font-semibold">{selectedHorse.name}</span>
          </span>
          <Button type="button" variant="link" size="sm" onClick={onSwitchToHorses}>
            Change horse
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between p-3 rounded-[var(--radius-md)] bg-[var(--role-neutral-bg)] border border-[var(--role-neutral-border)] text-[var(--text-muted)] text-sm">
          <span>No horse selected — go to My Horses to pick one</span>
          <Button type="button" variant="link" size="sm" onClick={onSwitchToHorses}>
            Select horse
          </Button>
        </div>
      )}

      {/* Discipline filter */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
        <Select
          value={disciplineFilter}
          onChange={(e) => setDisciplineFilter(e.target.value)}
          aria-label="Filter by discipline"
          className="w-auto"
        >
          {DISCIPLINE_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d === 'All' ? 'All Disciplines' : d}
            </option>
          ))}
        </Select>
        {disciplineFilter !== 'All' && (
          <Button type="button" variant="link" size="sm" onClick={() => setDisciplineFilter('All')}>
            Clear filter
          </Button>
        )}
      </div>

      {/* Purchase success banner */}
      {purchaseSuccess && (
        <div className="flex items-center gap-2 p-3 rounded-[var(--radius-md)] bg-[var(--role-success-bg)] border border-[var(--role-success-border)] text-[var(--role-success-text)] text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          {purchaseSuccess}
        </div>
      )}

      {/* Purchase error banner */}
      {purchaseMutation.isError && (
        <div
          className="flex items-center gap-2 p-3 rounded-[var(--radius-md)] bg-[var(--role-danger-bg)] border border-[var(--role-danger-border)] text-[var(--role-danger-text)] text-sm"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
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
              <h3 className="text-xs font-semibold text-[var(--role-warning-text)] uppercase tracking-widest mb-3">
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
