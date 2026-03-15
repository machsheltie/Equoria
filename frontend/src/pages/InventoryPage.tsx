/**
 * InventoryPage — Player Inventory (Epic 12 — Story 12-2 / Epic 16 — Story 16-1)
 *
 * Shows all owned tack items (saddles, bridles, consumables, special).
 * Items can be equipped to / unequipped from horses via live API.
 *
 * Data sources:
 *   GET /api/inventory         → InventoryData  (useInventory hook)
 *   GET /api/horses            → HorseSummary[] (horse picker)
 *   POST /api/inventory/equip  → equip mutation
 *   POST /api/inventory/unequip → unequip mutation
 *
 * Uses Celestial Night theme (consistent with other standalone pages).
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Package, Shield, Leaf, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { useInventory, useEquipItem, useUnequipItem } from '@/hooks/api/useInventory';
import PageHero from '@/components/layout/PageHero';
import { horsesApi } from '@/lib/api-client';
import type { InventoryItem } from '@/lib/api-client';
import { useQuery } from '@tanstack/react-query';

type InventoryCategory = 'all' | 'saddle' | 'bridle' | 'consumables' | 'special';

// ── Category config ──────────────────────────────────────────────────────────

const categoryIcons: Record<InventoryCategory, React.ReactNode> = {
  all: <Package className="w-4 h-4" />,
  saddle: <Shield className="w-4 h-4" />,
  bridle: <Shield className="w-4 h-4" />,
  consumables: <Leaf className="w-4 h-4" />,
  special: <Sparkles className="w-4 h-4" />,
};

const categoryLabels: Record<InventoryCategory, string> = {
  all: 'All Items',
  saddle: 'Saddles',
  bridle: 'Bridles',
  consumables: 'Consumables',
  special: 'Special',
};

// ── HorsePicker modal ────────────────────────────────────────────────────────

interface HorsePickerProps {
  itemName: string;
  onConfirm: (_horseId: number) => void;
  onClose: () => void;
  isPending: boolean;
}

const HorsePicker: React.FC<HorsePickerProps> = ({ itemName, onConfirm, onClose, isPending }) => {
  const [selectedHorseId, setSelectedHorseId] = useState<number | null>(null);

  const { data: horsesData, isLoading } = useQuery({
    queryKey: ['horses-picker'],
    queryFn: () => horsesApi.list(),
    staleTime: 30_000,
  });

  const horses = horsesData ?? [];

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Equip ${itemName}`}
    >
      <div className="w-full max-w-sm bg-[#0f2346] border border-white/10 rounded-xl p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-white/90 mb-1">Equip Item</h2>
        <p className="text-sm text-white/50 mb-4">
          Select a horse to equip <span className="text-violet-300">{itemName}</span>
        </p>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-white/40" />
          </div>
        ) : horses.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-4">
            No horses found. Add a horse first.
          </p>
        ) : (
          <ul className="space-y-2 max-h-56 overflow-y-auto mb-4">
            {horses.map((horse) => (
              <li key={horse.id}>
                <button
                  type="button"
                  onClick={() => setSelectedHorseId(horse.id)}
                  className={`w-full text-left px-4 py-2.5 rounded-lg border transition-all text-sm ${
                    selectedHorseId === horse.id
                      ? 'bg-violet-600/20 border-violet-500/50 text-white/90'
                      : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20 hover:text-white/80'
                  }`}
                >
                  {horse.name}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-white/50 hover:text-white/70 hover:border-white/20 transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => selectedHorseId !== null && onConfirm(selectedHorseId)}
            disabled={selectedHorseId === null || isPending}
            className="flex-1 py-2 rounded-lg bg-violet-600/20 border border-violet-500/30 text-sm font-medium text-violet-300 hover:bg-violet-600/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Equipping…
              </span>
            ) : (
              'Equip'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── InventoryItemCard ─────────────────────────────────────────────────────────

interface ItemCardProps {
  item: InventoryItem;
  onEquipRequest: (_item: InventoryItem) => void;
  onUnequip: (_item: InventoryItem) => void;
  isUnequipping: boolean;
}

const InventoryItemCard: React.FC<ItemCardProps> = ({
  item,
  onEquipRequest,
  onUnequip,
  isUnequipping,
}) => {
  // Icon fallback based on category
  const icon =
    item.category === 'saddle'
      ? '🪣'
      : item.category === 'bridle'
        ? '🔗'
        : item.category === 'consumables'
          ? '💊'
          : '🏅';

  return (
    <div
      className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all"
      data-testid={`inventory-item-${item.id}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">
            {icon}
          </span>
          <div>
            <h3 className="font-bold text-white/90 text-sm">{item.name}</h3>
            {item.bonus && (
              <span className="text-xs text-violet-400/80 font-medium mt-0.5 block">
                {item.bonus}
              </span>
            )}
          </div>
        </div>
        <span className="text-xs font-bold bg-white/10 text-white/60 rounded-full px-2 py-0.5">
          ×{item.quantity}
        </span>
      </div>

      <p className="text-xs text-white/50 mb-3 capitalize">{item.category}</p>

      {item.equippedToHorseId ? (
        <div className="flex items-center justify-between">
          <span className="text-xs text-emerald-400 font-medium">
            Equipped: {item.equippedToHorseName ?? `Horse #${item.equippedToHorseId}`}
          </span>
          <button
            type="button"
            onClick={() => onUnequip(item)}
            disabled={isUnequipping}
            className="text-xs px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white/70 hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isUnequipping ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Unequip'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onEquipRequest(item)}
          data-onboarding-target="inventory-equip-button"
          className="w-full py-1.5 text-xs font-medium rounded-lg bg-violet-600/10 border border-violet-500/20 text-violet-400/80 hover:bg-violet-600/20 hover:text-violet-300 transition-colors"
        >
          Equip
        </button>
      )}
    </div>
  );
};

// ── InventoryPage ─────────────────────────────────────────────────────────────

const InventoryPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<InventoryCategory>('all');
  const [equipTarget, setEquipTarget] = useState<InventoryItem | null>(null);
  const [unequippingId, setUnequippingId] = useState<string | null>(null);

  const { items, total, isLoading, error } = useInventory();
  const equipMutation = useEquipItem();
  const unequipMutation = useUnequipItem();

  const categories: InventoryCategory[] = ['all', 'saddle', 'bridle', 'consumables', 'special'];

  const filteredItems =
    activeCategory === 'all' ? items : items.filter((item) => item.category === activeCategory);

  // ── Handlers ──

  const handleEquipRequest = (item: InventoryItem) => {
    if (item.category === 'consumables' || item.category === 'special') {
      toast.info(
        `To use "${item.name}", purchase it from the Feed Shop or Vet Clinic for a specific horse.`,
        { duration: 5000 }
      );
      return;
    }
    setEquipTarget(item);
  };

  const handleEquipConfirm = (horseId: number) => {
    if (!equipTarget) return;
    equipMutation.mutate(
      { inventoryItemId: equipTarget.id, horseId },
      {
        onSuccess: () => {
          toast.success(`${equipTarget.name} equipped successfully`);
          setEquipTarget(null);
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Failed to equip item';
          toast.error(msg);
        },
      }
    );
  };

  const handleUnequip = (item: InventoryItem) => {
    setUnequippingId(item.id);
    unequipMutation.mutate(
      { inventoryItemId: item.id },
      {
        onSuccess: () => {
          toast.success(`${item.name} unequipped`);
          setUnequippingId(null);
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Failed to unequip item';
          toast.error(msg);
          setUnequippingId(null);
        },
      }
    );
  };

  // ── Render ──

  return (
    <div className="min-h-screen">
      {equipTarget && (
        <HorsePicker
          itemName={equipTarget.name}
          onConfirm={handleEquipConfirm}
          onClose={() => setEquipTarget(null)}
          isPending={equipMutation.isPending}
        />
      )}

      <PageHero
        title="Inventory"
        subtitle="Manage your tack, consumables, and special items"
        mood="golden"
        icon={<Package className="w-7 h-7 text-[var(--gold-400)]" />}
      >
        {/* Breadcrumb + item count */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <Link to="/" className="hover:text-[var(--cream)] transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="text-[var(--cream)]">Inventory</span>
          </div>
          <div
            className="px-4 py-2 glass-panel rounded-lg text-sm text-[var(--text-muted)]"
            data-testid="item-count"
          >
            {isLoading ? '...' : `${total} items`}
          </div>
        </div>
      </PageHero>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {/* Category Filter */}
        <div
          className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl mb-6 w-fit"
          role="tablist"
          aria-label="Inventory categories"
        >
          {categories.map((cat) => (
            <button
              key={cat}
              role="tab"
              aria-selected={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeCategory === cat
                  ? 'bg-white/10 text-white/90 shadow-sm'
                  : 'text-white/40 hover:text-white/70'
              }`}
              data-testid={`category-${cat}`}
            >
              {categoryIcons[cat]}
              {categoryLabels[cat]}
            </button>
          ))}
        </div>

        {/* Inventory Grid */}
        <div role="tabpanel" data-testid="inventory-grid">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-white/30" />
            </div>
          ) : error ? (
            <div
              className="flex flex-col items-center justify-center min-h-48 text-center p-8"
              data-testid="inventory-error"
            >
              <AlertCircle className="w-10 h-10 text-red-400/50 mb-3" />
              <p className="text-white/50 font-medium">Could not load inventory</p>
              <p className="text-white/30 text-sm mt-1">Please refresh the page and try again.</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center min-h-48 text-center p-8"
              data-testid="empty-inventory"
            >
              <AlertCircle className="w-10 h-10 text-white/20 mb-3" />
              <p className="text-white/50 font-medium">
                {activeCategory === 'all'
                  ? 'Your inventory is empty'
                  : `No ${categoryLabels[activeCategory].toLowerCase()} in inventory`}
              </p>
              <p className="text-white/30 text-sm mt-1">
                Visit the Tack Shop or Feed Shop to stock up.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => (
                <InventoryItemCard
                  key={item.id}
                  item={item}
                  onEquipRequest={handleEquipRequest}
                  onUnequip={handleUnequip}
                  isUnequipping={unequippingId === item.id && unequipMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>

        {/* Info Panel */}
        <div className="mt-10 p-5 rounded-xl glass-panel text-sm text-[var(--text-muted)]">
          <h3 className="font-semibold text-[var(--cream)] mb-2">About Inventory</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Tack items can be equipped to one horse at a time</li>
            <li>Consumables are used once and removed from inventory</li>
            <li>Special items unlock unique actions or access</li>
            <li>Items purchased in the Tack Shop and Feed Shop appear here automatically</li>
            <li>Equip and unequip tack directly from this page</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default InventoryPage;
