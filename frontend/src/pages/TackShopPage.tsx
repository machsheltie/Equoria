/**
 * TackShopPage — World > Tack Shop Location (Epic 10 — Story 10-4)
 *
 * The Tack Shop location in the World hub. Two modes:
 * - My Horses: Select a horse to equip; shows equipped tack per horse
 * - Shop: Browse saddles and bridles from the live API; purchase for selected horse
 *
 * Wired to real API hooks (Story 10-5 wire-up):
 *   useTackInventory()   — GET /api/tack-shop/inventory
 *   usePurchaseTackItem() — POST /api/tack-shop/purchase
 *   useHorses()          — GET /api/horses
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Heart, ShoppingBag, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useTackInventory, usePurchaseTackItem } from '@/hooks/api/useTackShop';
import { useHorses } from '@/hooks/api/useHorses';
import type { TackItem } from '@/hooks/api/useTackShop';
import type { HorseSummary } from '@/lib/api-client';

type TackShopTab = 'horses' | 'shop';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a fallback emoji icon based on the tack category. */
function categoryIcon(category: 'saddle' | 'bridle'): string {
  return category === 'saddle' ? '🪣' : '🔗';
}

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
  const buttonLabel = selectedHorse
    ? isPurchasing
      ? 'Purchasing…'
      : `Buy for ${selectedHorse.name}`
    : 'Select a Horse to Purchase';

  return (
    <div
      className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all"
      data-testid={`tack-item-${item.id}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">
            {item.icon ?? categoryIcon(item.category)}
          </span>
          <div>
            <h3 className="font-bold text-white/90">{item.name}</h3>
            <span className="text-xs text-sky-400/80 font-medium mt-0.5 block">{item.bonus}</span>
          </div>
        </div>
        <p className="text-lg font-bold text-celestial-gold">${item.cost.toLocaleString()}</p>
      </div>
      <p className="text-sm text-white/50 mb-4">{item.description}</p>
      <button
        type="button"
        disabled={!canPurchase}
        onClick={() => canPurchase && onPurchase(item)}
        className={`w-full py-2 text-sm font-medium rounded-lg transition-colors ${
          canPurchase
            ? 'bg-sky-600/20 border border-sky-500/30 text-sky-400 hover:bg-sky-600/30 cursor-pointer'
            : 'bg-sky-600/10 border border-sky-500/20 text-sky-400/60 cursor-not-allowed'
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

  const handlePurchase = (item: TackItem) => {
    if (!selectedHorse) return;
    setPurchaseSuccess(null);
    purchaseMutation.mutate(
      { horseId: selectedHorse.id, itemId: item.id },
      {
        onSuccess: (result) => {
          const msg = `Purchased ${result.data.item.name} for ${result.data.horse.name}. Remaining balance: $${result.data.remainingMoney.toLocaleString()}`;
          setPurchaseSuccess(msg);
          toast.success(msg);
        },
        onError: () => {
          toast.error('Purchase failed. Please try again.');
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64" data-testid="tack-shop-loading">
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
        <span className="ml-3 text-white/50 text-sm">Loading inventory…</span>
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
        <p className="text-white/60 text-sm">
          {(error as { message?: string })?.message ?? 'Failed to load tack inventory.'}
        </p>
      </div>
    );
  }

  const saddles = data?.categories.saddles ?? [];
  const bridles = data?.categories.bridles ?? [];

  return (
    <div className="space-y-8" data-testid="tack-shop-tab">
      {/* Selected horse banner */}
      {selectedHorse ? (
        <div className="flex items-center justify-between p-3 rounded-lg bg-sky-600/10 border border-sky-500/20 text-sky-300 text-sm">
          <span>
            Purchasing for: <span className="font-semibold">{selectedHorse.name}</span>
          </span>
          <button
            type="button"
            onClick={onSwitchToHorses}
            className="text-sky-400/70 hover:text-sky-300 underline text-xs transition-colors"
          >
            Change horse
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 text-white/40 text-sm">
          <span>No horse selected — go to My Horses to pick one</span>
          <button
            type="button"
            onClick={onSwitchToHorses}
            className="text-sky-400/70 hover:text-sky-300 underline text-xs transition-colors"
          >
            Select horse
          </button>
        </div>
      )}

      {/* Purchase success banner */}
      {purchaseSuccess && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-600/10 border border-emerald-500/20 text-emerald-300 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {purchaseSuccess}
        </div>
      )}

      {/* Purchase error banner */}
      {purchaseMutation.isError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-600/10 border border-red-500/20 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {(purchaseMutation.error as { message?: string })?.message ?? 'Purchase failed.'}
        </div>
      )}

      {/* Saddles */}
      <section>
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-4">
          Saddles
        </h2>
        {saddles.length === 0 ? (
          <p className="text-sm text-white/30 italic">No saddles available.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {saddles.map((item) => (
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
      </section>

      {/* Bridles */}
      <section>
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-4">
          Bridles
        </h2>
        {bridles.length === 0 ? (
          <p className="text-sm text-white/30 italic">No bridles available.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {bridles.map((item) => (
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
      </section>
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
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
        <span className="ml-3 text-white/50 text-sm">Loading your horses…</span>
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
        <p className="text-white/60 text-sm">
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
        <ShoppingBag className="w-12 h-12 text-sky-400/30 mb-4" />
        <h2 className="text-lg font-bold text-white/60 mb-2">No Horses Registered</h2>
        <p className="text-sm text-white/40 max-w-sm mb-6">
          Visit your stable to equip tack on your horses. Quality saddles and bridles improve
          training and competition performance.
        </p>
        <Link
          to="/stable"
          className="px-5 py-2.5 bg-sky-600/20 border border-sky-500/30 text-sky-400 rounded-lg text-sm font-medium hover:bg-sky-600/30 transition-colors"
        >
          Go to Stable
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="horses-tack-tab">
      <p className="text-sm text-white/40">
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
              className={`text-left p-4 rounded-xl border transition-all ${
                isSelected
                  ? 'bg-sky-600/15 border-sky-500/50 ring-1 ring-sky-500/30'
                  : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/8'
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
                    className={`font-bold truncate ${isSelected ? 'text-sky-300' : 'text-white/90'}`}
                  >
                    {horse.name}
                  </h3>
                  <p className="text-xs text-white/40 truncate">
                    {horse.breed} · {horse.gender}
                  </p>
                </div>
                {isSelected && (
                  <CheckCircle className="w-4 h-4 text-sky-400 flex-shrink-0 ml-auto" />
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-white/40">
                <span>Age {horse.age}</span>
                <span
                  className={
                    horse.healthStatus === 'Healthy' ? 'text-emerald-400/70' : 'text-amber-400/70'
                  }
                >
                  {horse.healthStatus}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {selectedHorse && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onGoToShop}
            className="px-5 py-2.5 bg-sky-600/20 border border-sky-500/30 text-sky-400 rounded-lg text-sm font-medium hover:bg-sky-600/30 transition-colors"
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
          <Link to="/world" className="hover:text-white/70 transition-colors">
            World
          </Link>
          <span>/</span>
          <span className="text-white/70">Tack Shop</span>
        </div>

        {/* Page Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            to="/world"
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all"
            aria-label="Back to World"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white/90">🧴 Tack Shop</h1>
            <p className="text-sm text-white/50 mt-0.5">
              Saddles, bridles, and specialist gear to boost your horses in competition
            </p>
          </div>
        </div>

        {/* My Horses / Shop Tabs */}
        <div
          className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl mb-8 w-fit"
          role="tablist"
          aria-label="Tack Shop section"
        >
          <button
            role="tab"
            aria-selected={activeTab === 'horses'}
            onClick={() => setActiveTab('horses')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'horses'
                ? 'bg-white/10 text-white/90 shadow-sm'
                : 'text-white/40 hover:text-white/70'
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
                ? 'bg-white/10 text-white/90 shadow-sm'
                : 'text-white/40 hover:text-white/70'
            }`}
            data-testid="shop-tab"
          >
            <ShoppingBag className="w-4 h-4" />
            Shop
            {selectedHorse && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-sky-500/20 text-sky-300">
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

        {/* Info Panel */}
        <div className="mt-10 p-5 rounded-xl bg-white/3 border border-white/8 text-sm text-white/40">
          <h3 className="font-semibold text-white/60 mb-2">About the Tack Shop</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Only one saddle and one bridle can be equipped per horse at a time</li>
            <li>Competition gear provides direct bonuses to show scoring</li>
            <li>Training saddles increase XP gain rate during training sessions</li>
            <li>Higher-tier bridles improve obedience and rider communication</li>
            <li>Tack can be swapped between horses at no cost</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TackShopPage;
