/**
 * InventoryPage — Player Inventory (Epic 12 — Story 12-2 / Epic 16 — Story 16-1
 *                                  + feed-system redesign 2026-04-29 — A17)
 *
 * Shows all owned items: tack (saddles, bridles), feed (5 tiers — pooled),
 * consumables, and special.
 *
 * Tack: equipped/unequipped to horses directly from this page.
 * Feed: pooled inventory rendered read-only here; equipping happens per-horse
 *       on the horse Equip page (`/horses/:id/equip`). Feed has no
 *       equippedToHorseId because Horse.equippedFeedType is the per-horse
 *       source of truth, not the inventory row.
 *
 * UI consistency (Equoria-rgke): consumes shared CardGrid + ItemCard + the
 * canonical FantasyTabs filter pattern from StableView.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Package, Shield, Leaf, Sparkles, AlertCircle, Loader2, Wrench } from 'lucide-react';
import { useInventory, useEquipItem, useUnequipItem } from '@/hooks/api/useInventory';
import PageHero from '@/components/layout/PageHero';
import { Button } from '@/components/ui/button';
import { CardGrid } from '@/components/ui/CardGrid';
import { ItemCard } from '@/components/ui/ItemCard';
import { FantasyTabs } from '@/components/FantasyTabs';
import { horsesApi } from '@/lib/api-client';
import type { InventoryItem, FeedItem } from '@/lib/api-client';
import { useQuery } from '@tanstack/react-query';

type InventoryCategory = 'all' | 'saddle' | 'bridle' | 'feed' | 'consumables' | 'special';

const FEED_IMAGES: Record<FeedItem['id'], string> = {
  basic: '/images/feed/basicfeed.png',
  performance: '/images/feed/performancefeed.png',
  performancePlus: '/images/feed/performanceplusfeed.png',
  highPerformance: '/images/feed/highperformancefeed.png',
  elite: '/images/feed/elitefeed.png',
};

// Tack art is shipped per-item-id in /images/tack. Items without art fall
// back to the wrench placeholder. Add new entries here as art is added.
const TACK_IMAGES: Record<string, string> = {
  'dressage-saddle': '/images/tack/dressage-saddle.png',
  'dressage-bridle': '/images/tack/dressage-bridle.png',
};

function getItemImage(item: InventoryItem): string | null {
  if (item.category === 'feed') {
    return FEED_IMAGES[item.itemId as FeedItem['id']] ?? null;
  }
  return TACK_IMAGES[item.itemId] ?? null;
}

// ── Category config ──────────────────────────────────────────────────────────

const CATEGORY_TABS: { value: InventoryCategory; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All Items', icon: <Package className="w-4 h-4" /> },
  { value: 'saddle', label: 'Saddles', icon: <Shield className="w-4 h-4" /> },
  { value: 'bridle', label: 'Bridles', icon: <Shield className="w-4 h-4" /> },
  { value: 'feed', label: 'Feed', icon: <Leaf className="w-4 h-4" /> },
  { value: 'consumables', label: 'Consumables', icon: <Leaf className="w-4 h-4" /> },
  { value: 'special', label: 'Special', icon: <Sparkles className="w-4 h-4" /> },
];

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
      <div className="w-full max-w-sm glass-panel-heavy rounded-xl p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-[var(--cream)] mb-1">Equip Item</h2>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          Select a horse to equip <span className="text-[var(--gold-light)]">{itemName}</span>
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
                <Button
                  type="button"
                  variant={selectedHorseId === horse.id ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => setSelectedHorseId(horse.id)}
                  className="w-full justify-start"
                >
                  {horse.name}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <Button type="button" onClick={onClose} disabled={isPending} className="flex-1">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => selectedHorseId !== null && onConfirm(selectedHorseId)}
            disabled={selectedHorseId === null || isPending}
            className="flex-1"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Equipping…
              </span>
            ) : (
              'Equip'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ── Inventory Card adapter ───────────────────────────────────────────────────
// Wraps the shared ItemCard to apply inventory-specific media, action, and
// quantity badge. Keeps ItemCard's API generic across shops/services/equip.

interface InventoryCardProps {
  item: InventoryItem;
  onEquipRequest: (_item: InventoryItem) => void;
  onUnequip: (_item: InventoryItem) => void;
  isUnequipping: boolean;
}

const InventoryCard: React.FC<InventoryCardProps> = ({
  item,
  onEquipRequest,
  onUnequip,
  isUnequipping,
}) => {
  const isFeed = item.category === 'feed';
  const imageSrc = getItemImage(item);

  const media = imageSrc ? (
    <img src={imageSrc} alt={item.name} loading="lazy" className="w-20 h-20 object-contain" />
  ) : (
    <div className="w-20 h-20 rounded-lg bg-black/20 flex items-center justify-center text-[var(--text-muted)]">
      <Wrench className="w-10 h-10" />
    </div>
  );

  // Quantity rendered as a small neutral badge inline with title — passed via
  // meta so it stays out of the gold "price" slot semantics.
  const meta = (
    <span className="text-[0.65rem] font-bold bg-white/10 text-[var(--cream)]/60 rounded-full px-2 py-0.5">
      ×{item.quantity}
    </span>
  );

  let action: React.ReactNode;
  if (isFeed) {
    action = (
      <p
        className="text-xs text-[var(--text-muted)] italic leading-snug text-center"
        data-testid={`feed-equip-hint-${item.id}`}
      >
        Equipped via the horse&rsquo;s Equip page.
      </p>
    );
  } else if (item.equippedToHorseId) {
    action = (
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--gold-light)] font-medium truncate">
          Equipped: {item.equippedToHorseName ?? `Horse #${item.equippedToHorseId}`}
        </span>
        <Button type="button" size="sm" onClick={() => onUnequip(item)} disabled={isUnequipping}>
          {isUnequipping ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Unequip'}
        </Button>
      </div>
    );
  } else {
    action = (
      <Button
        type="button"
        onClick={() => onEquipRequest(item)}
        data-onboarding-target="inventory-equip-button"
        className="w-full"
      >
        Equip
      </Button>
    );
  }

  return (
    <ItemCard
      data-testid={`inventory-item-${item.id}`}
      media={media}
      title={item.name}
      subtitle={<span className="capitalize">{item.category}</span>}
      description={item.bonus ?? undefined}
      meta={meta}
      action={action}
    />
  );
};

// ── InventoryPage ─────────────────────────────────────────────────────────────

const InventoryPage: React.FC = () => {
  const [equipTarget, setEquipTarget] = useState<InventoryItem | null>(null);
  const [unequippingId, setUnequippingId] = useState<string | null>(null);

  const { items, total, isLoading, error } = useInventory();
  const equipMutation = useEquipItem();
  const unequipMutation = useUnequipItem();

  // ── Handlers ──

  const handleEquipRequest = (item: InventoryItem) => {
    if ((item.category as string) === 'consumables' || (item.category as string) === 'special') {
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

  // Render the grid for a given category — used as each FantasyTab's content.
  const renderGrid = (category: InventoryCategory) => {
    if (isLoading) {
      return (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-white/30" />
        </div>
      );
    }
    if (error) {
      return (
        <div
          className="flex flex-col items-center justify-center min-h-48 text-center p-8"
          data-testid="inventory-error"
        >
          <AlertCircle className="w-10 h-10 text-red-400/50 mb-3" />
          <p className="text-white/50 font-medium">Could not load inventory</p>
          <p className="text-white/30 text-sm mt-1">Please refresh the page and try again.</p>
        </div>
      );
    }
    const filtered =
      category === 'all' ? items : items.filter((item) => item.category === category);
    if (filtered.length === 0) {
      const label = CATEGORY_TABS.find((t) => t.value === category)?.label ?? '';
      return (
        <div
          className="flex flex-col items-center justify-center min-h-48 text-center p-8"
          data-testid="empty-inventory"
        >
          <AlertCircle className="w-10 h-10 text-white/20 mb-3" />
          <p className="text-white/50 font-medium">
            {category === 'all'
              ? 'Your inventory is empty'
              : `No ${label.toLowerCase()} in inventory`}
          </p>
          <p className="text-white/30 text-sm mt-1">
            Visit the Tack Shop or Feed Shop to stock up.
          </p>
        </div>
      );
    }
    return (
      <CardGrid aria-label={`${category} inventory items`}>
        {filtered.map((item) => (
          <InventoryCard
            key={item.id}
            item={item}
            onEquipRequest={handleEquipRequest}
            onUnequip={handleUnequip}
            isUnequipping={unequippingId === item.id && unequipMutation.isPending}
          />
        ))}
      </CardGrid>
    );
  };

  const tabs = CATEGORY_TABS.map((cat) => ({
    value: cat.value,
    label: cat.label,
    icon: cat.icon,
    content: renderGrid(cat.value),
  }));

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
          <div className="flex items-center gap-2 text-sm text-[var(--cream)]/60">
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
        {/* Category filter — FantasyTabs (canonical from StableView) */}
        <div data-testid="inventory-grid">
          <FantasyTabs tabs={tabs} defaultValue="all" />
        </div>

        {/* Info Panel */}
        <div className="mt-10 p-5 rounded-xl glass-panel text-sm text-[var(--text-muted)]">
          <h3 className="font-semibold text-[var(--cream)] mb-2">About Inventory</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Tack items can be equipped to one horse at a time</li>
            <li>Feed is pooled inventory; equip and feed it from each horse&rsquo;s Equip page</li>
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
