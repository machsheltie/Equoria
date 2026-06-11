/**
 * InventoryPage — Player Inventory (Epic 12 — Story 12-2 / Epic 16 — Story 16-1
 *                                  + feed-system redesign 2026-04-29 — A17
 *                                  + UI cohesion with HorseEquipPage 2026-05-05)
 *
 * Shows all owned items: tack (saddles, bridles), feed (5 tiers — pooled),
 * consumables, and special.
 *
 * Read-only equip view: no "Equip" action here. Equipping happens per-horse on
 * the horse Equip page (`/horses/:id/equip`). Tack unequip remains available.
 *
 * Card style matches HorseEquipPage exactly:
 *   - Same ItemCard layout (image, gold star prefix, title, subtitle, description, meta)
 *   - Feed: subtitle = "N units in stock", meta = stat-roll / pregnancy %, click → popup
 *   - Tack: subtitle = "N in inventory", meta = none, gold border + star if equipped
 */

import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Package, Shield, Leaf, Sparkles, Loader2, Wrench, Star } from 'lucide-react';
import { useInventory, useUnequipItem } from '@/hooks/api/useInventory';
import { useFeedCatalog } from '@/hooks/api/useFeedShop';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/button';
import { CardGrid } from '@/components/ui/CardGrid';
import { ItemCard } from '@/components/ui/ItemCard';
import { CanonicalTabs } from '@/components/ui/game';
import { SectionLoading, ErrorState } from '@/components/ui/state';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
  GameDialogDescription,
} from '@/components/ui/game/GameDialog';
import type { InventoryItem, FeedItem } from '@/lib/api-client';

type InventoryCategory = 'all' | 'saddle' | 'bridle' | 'feed' | 'consumables' | 'special';

const FEED_IMAGES: Record<FeedItem['id'], string> = {
  basic: '/images/feed/basicfeed.png',
  performance: '/images/feed/performancefeed.png',
  performancePlus: '/images/feed/performanceplusfeed.png',
  highPerformance: '/images/feed/highperformancefeed.png',
  elite: '/images/feed/elitefeed.png',
};

const TACK_IMAGES: Record<string, string> = {
  'dressage-saddle': '/images/tack/dressage-saddle.png',
  'dressage-bridle': '/images/tack/dressage-bridle.png',
  'all-purpose-saddle': '/images/tack/allpurposesaddle.png',
};

function getItemImage(item: InventoryItem): string | null {
  if (item.category === 'feed') {
    return FEED_IMAGES[item.itemId as FeedItem['id']] ?? null;
  }
  return TACK_IMAGES[item.itemId] ?? null;
}

const EQUIPPED_STAR = (
  <Star className="w-3.5 h-3.5 text-[var(--gold-primary)] fill-[var(--gold-primary)]" />
);

// ── Category config ──────────────────────────────────────────────────────────

const CATEGORY_TABS: { value: InventoryCategory; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All Items', icon: <Package className="w-4 h-4" /> },
  { value: 'saddle', label: 'Saddles', icon: <Shield className="w-4 h-4" /> },
  { value: 'bridle', label: 'Bridles', icon: <Shield className="w-4 h-4" /> },
  { value: 'feed', label: 'Feed', icon: <Leaf className="w-4 h-4" /> },
  { value: 'consumables', label: 'Consumables', icon: <Leaf className="w-4 h-4" /> },
  { value: 'special', label: 'Special', icon: <Sparkles className="w-4 h-4" /> },
];

// ── InventoryCard adapter ────────────────────────────────────────────────────
// Mirrors HorseEquipPage's card layout exactly. No equip action — this page
// is a read-only view of owned items. Unequip remains for equipped tack.

interface InventoryCardProps {
  item: InventoryItem;
  onUnequip: (_item: InventoryItem) => void;
  isUnequipping: boolean;
  onShowInfo: (_info: { title: string; description: string }) => void;
  feedCatalogById: Partial<Record<FeedItem['id'], FeedItem>>;
}

const InventoryCard: React.FC<InventoryCardProps> = ({
  item,
  onUnequip,
  isUnequipping,
  onShowInfo,
  feedCatalogById,
}) => {
  const isFeed = item.category === 'feed';
  const isEquipped = !!item.equippedToHorseId;
  const imageSrc = getItemImage(item);

  const media = imageSrc ? (
    <img src={imageSrc} alt={item.name} loading="lazy" className="w-20 h-20 object-contain" />
  ) : (
    <div className="w-20 h-20 rounded-[var(--radius-md)] bg-[var(--glass-surface-subtle-bg)] flex items-center justify-center text-[var(--text-muted)]">
      <Wrench className="w-10 h-10" />
    </div>
  );

  // Feed: "N units in stock". Tack: "N in inventory" — quantity in subtitle, no badge.
  const subtitle = isFeed ? `${item.quantity} units in stock` : `${item.quantity} in inventory`;

  // Feed: stat roll / pregnancy % from catalog. Tack: no badge (quantity is in subtitle).
  const feedMeta = isFeed ? feedCatalogById[item.itemId as FeedItem['id']] : undefined;
  const meta: React.ReactNode = isFeed ? (
    feedMeta ? (
      <span className="text-[0.65rem] text-[var(--text-muted)]">
        Stat-roll <strong className="text-[var(--text-secondary)]">{feedMeta.statRollPct}%</strong>{' '}
        · Pregnancy{' '}
        <strong className="text-[var(--text-secondary)]">+{feedMeta.pregnancyBonusPct}%</strong>
      </span>
    ) : undefined
  ) : undefined;

  // Description: feed uses catalog description; tack uses bonus field.
  const description = isFeed
    ? (feedMeta?.description ?? item.bonus ?? undefined)
    : (item.bonus ?? undefined);

  // Action: unequip for equipped tack only; nothing for feed or unequipped tack.
  let action: React.ReactNode;
  if (!isFeed && isEquipped) {
    action = (
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--gold-light)] font-medium truncate">
          {item.equippedToHorseName ?? `Horse #${item.equippedToHorseId}`}
        </span>
        <Button
          type="button"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onUnequip(item);
          }}
          disabled={isUnequipping}
        >
          {isUnequipping ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Unequip'}
        </Button>
      </div>
    );
  }

  const handleClick = description
    ? () => onShowInfo({ title: item.name, description: description as string })
    : undefined;

  return (
    <ItemCard
      data-testid={`inventory-item-${item.id}`}
      media={media}
      titlePrefix={isEquipped ? EQUIPPED_STAR : undefined}
      title={item.name}
      subtitle={subtitle}
      description={description}
      meta={meta}
      selected={isEquipped}
      onClick={handleClick}
      action={action}
    />
  );
};

// ── InventoryPage ─────────────────────────────────────────────────────────────

const InventoryPage: React.FC = () => {
  const [unequippingId, setUnequippingId] = useState<string | null>(null);
  const [activeInfo, setActiveInfo] = useState<{ title: string; description: string } | null>(null);

  const queryClient = useQueryClient();
  const { items, total, isLoading, error } = useInventory();
  const unequipMutation = useUnequipItem();
  const { data: catalog } = useFeedCatalog();

  const catalogById = useMemo(() => {
    const map: Partial<Record<FeedItem['id'], FeedItem>> = {};
    (catalog ?? []).forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [catalog]);

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

  const renderGrid = (category: InventoryCategory) => {
    if (isLoading) {
      return <SectionLoading label="Loading inventory" minHeight="200px" />;
    }
    if (error) {
      return (
        <div data-testid="inventory-error">
          <ErrorState
            title="Could not load inventory"
            message="Check your connection and try again."
            retry={{
              label: 'Try Again',
              onClick: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
            }}
          />
        </div>
      );
    }
    const filtered =
      category === 'all' ? items : items.filter((item) => item.category === category);
    if (filtered.length === 0) {
      const label = CATEGORY_TABS.find((t) => t.value === category)?.label ?? '';
      return (
        <div data-testid="empty-inventory">
          <EmptyState
            variant={category === 'all' ? 'first-use' : 'filtered'}
            icon={<Package className="h-8 w-8" aria-hidden="true" />}
            title={
              category === 'all'
                ? 'Your inventory is empty'
                : `No ${label.toLowerCase()} in inventory`
            }
            description="Visit the Tack Shop or Feed Shop to stock up."
          />
        </div>
      );
    }
    return (
      <CardGrid aria-label={`${category} inventory items`}>
        {filtered.map((item) => (
          <InventoryCard
            key={item.id}
            item={item}
            onUnequip={handleUnequip}
            isUnequipping={unequippingId === item.id && unequipMutation.isPending}
            onShowInfo={setActiveInfo}
            feedCatalogById={catalogById}
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
    <PageContainer variant="wide" data-testid="inventory-page">
      <PageHeader
        title="Inventory"
        subtitle="Manage your tack, consumables, and special items"
        icon={<Package className="w-6 h-6 text-[var(--gold-400)]" aria-hidden="true" />}
        breadcrumbs={
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <Link to="/" className="hover:text-[var(--text-primary)] transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="text-[var(--text-primary)]">Inventory</span>
          </div>
        }
        metadata={
          <span
            className="inline-block px-3 py-1 rounded-[var(--radius-sm)] bg-[var(--glass-surface-subtle-bg)] border border-[var(--glass-border)] text-sm text-[var(--text-muted)]"
            data-testid="item-count"
          >
            {isLoading ? '...' : `${total} items`}
          </span>
        }
      />

      <div className="mt-6 pb-8">
        <div data-testid="inventory-grid">
          <CanonicalTabs tabs={tabs} defaultValue="all" />
        </div>

        <Surface variant="panel" className="mt-10 text-sm text-[var(--text-muted)]">
          <h3 className="type-card-title text-base mb-2">About Inventory</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>
              Tack items can be equipped to one horse at a time — equip from the horse&rsquo;s Equip
              page
            </li>
            <li>
              Feed is pooled inventory; equip and change feed from each horse&rsquo;s Equip page
            </li>
            <li>Consumables are used once and removed from inventory</li>
            <li>Special items unlock unique actions or access</li>
            <li>Items purchased in the Tack Shop and Feed Shop appear here automatically</li>
          </ul>
        </Surface>
      </div>

      {/* Item description popup — matches HorseEquipPage */}
      <GameDialog open={activeInfo !== null} onOpenChange={(open) => !open && setActiveInfo(null)}>
        <GameDialogContent>
          <GameDialogHeader>
            <GameDialogTitle>{activeInfo?.title}</GameDialogTitle>
          </GameDialogHeader>
          <GameDialogDescription className="pt-4 text-[var(--text-secondary)] text-sm leading-relaxed">
            {activeInfo?.description}
          </GameDialogDescription>
        </GameDialogContent>
      </GameDialog>
    </PageContainer>
  );
};

export default InventoryPage;
