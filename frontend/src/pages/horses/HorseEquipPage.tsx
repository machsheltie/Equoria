/**
 * HorseEquipPage (feed-system redesign 2026-04-29, Equoria-gav7;
 * inline tack equip 2026-05-04, Equoria-1tho;
 * UI consistency 2026-05-05, Equoria-cj00).
 *
 * Per-horse equip view at /horses/:id/equip. Two sections:
 *   - Tack: items the user owns that are not equipped to a DIFFERENT horse.
 *     Each row has an inline Equip button (or Unequip if it's already on
 *     this horse). No detour through /inventory.
 *   - Feed: the 5 catalog tiers in the user's inventory with quantity > 0.
 *     The active tier renders a gold ★ left of its name and a gold border.
 *
 * Click any card to open a description popup (GameDialog).
 * Both sections consume the shared ItemCard + CardGrid so cards-per-row and
 * text sizing match the rest of the system.
 */

import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, AlertCircle, ArrowLeft, Wrench, Star } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { Button } from '@/components/ui/button';
import { CardGrid } from '@/components/ui/CardGrid';
import { ItemCard } from '@/components/ui/ItemCard';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
  GameDialogDescription,
} from '@/components/ui/game/GameDialog';
import { useEquippable } from '@/hooks/api/useEquippable';
import { useEquipFeed, useUnequipFeed } from '@/hooks/api/useEquipFeed';
import { useEquipItem, useUnequipItem } from '@/hooks/api/useInventory';
import { useFeedCatalog } from '@/hooks/api/useFeedShop';
import { FeedItem } from '@/lib/api-client';

const FEED_IMAGES: Record<FeedItem['id'], string> = {
  basic: '/images/feed/basicfeed.png',
  performance: '/images/feed/performancefeed.png',
  performancePlus: '/images/feed/performanceplusfeed.png',
  highPerformance: '/images/feed/highperformancefeed.png',
  elite: '/images/feed/elitefeed.png',
};

const EQUIPPED_STAR = (
  <Star className="w-3.5 h-3.5 text-[var(--gold-primary)] fill-[var(--gold-primary)]" />
);

interface InfoState {
  title: string;
  description: string;
}

const HorseEquipPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const horseId = Number(id);
  const navigate = useNavigate();
  const { data, isLoading, isError } = useEquippable(horseId);
  const { data: catalog } = useFeedCatalog();
  const equipFeed = useEquipFeed(horseId);
  const unequipFeed = useUnequipFeed(horseId);
  const equipItem = useEquipItem();
  const unequipItem = useUnequipItem();

  const [activeInfo, setActiveInfo] = useState<InfoState | null>(null);

  const catalogById = React.useMemo(() => {
    const map: Partial<Record<FeedItem['id'], FeedItem>> = {};
    (catalog ?? []).forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [catalog]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16" data-testid="horse-equip-loading">
        <Loader2 className="w-8 h-8 animate-spin text-white/30" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="p-8" role="alert" data-testid="horse-equip-error">
        <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
        <p>Could not load equippable items.</p>
      </div>
    );
  }

  const currentlyEquippedFeed = data.feed.find((f) => f.isCurrentlyEquippedToThisHorse);

  return (
    <div>
      <PageHero title="Equip" subtitle="Tack and feed available for this horse">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-[var(--cream)]/60 hover:text-[var(--cream)]"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </PageHero>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* Tack section */}
        <section data-testid="tack-section">
          <h2 className="text-lg font-bold text-[var(--cream)] mb-3">Tack</h2>
          {data.tack.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]" data-testid="tack-empty-state">
              No tack available.{' '}
              <Link to="/tack-shop" className="underline hover:text-[var(--cream)]">
                Visit the Tack Shop
              </Link>
              .
            </p>
          ) : (
            <CardGrid aria-label="Tack available for this horse">
              {data.tack.map((item) => {
                const isEquipped = item.equippedToHorseId === horseId;
                const pendingThisItem =
                  (equipItem.isPending && equipItem.variables?.inventoryItemId === item.id) ||
                  (unequipItem.isPending && unequipItem.variables?.inventoryItemId === item.id);
                const description = item.bonus ?? undefined;

                const action = isEquipped ? (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      unequipItem.mutate(
                        { inventoryItemId: item.id },
                        {
                          onSuccess: () => toast.success(`Unequipped ${item.name}.`),
                          onError: (err) =>
                            toast.error(
                              (err as { message?: string })?.message ?? 'Failed to unequip.'
                            ),
                        }
                      );
                    }}
                    disabled={pendingThisItem}
                    data-testid={`unequip-tack-${item.id}`}
                    className="w-full"
                  >
                    {pendingThisItem ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Unequip'}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      equipItem.mutate(
                        { inventoryItemId: item.id, horseId },
                        {
                          onSuccess: () => toast.success(`Equipped ${item.name}.`),
                          onError: (err) =>
                            toast.error(
                              (err as { message?: string })?.message ?? 'Failed to equip.'
                            ),
                        }
                      );
                    }}
                    disabled={pendingThisItem}
                    data-testid={`equip-tack-${item.id}`}
                    className="w-full"
                  >
                    {pendingThisItem ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Equip'}
                  </Button>
                );

                return (
                  <ItemCard
                    key={item.id}
                    data-testid={`tack-item-${item.id}`}
                    media={
                      <div className="w-20 h-20 rounded-lg bg-black/20 flex items-center justify-center text-[var(--text-muted)]">
                        <Wrench className="w-10 h-10" />
                      </div>
                    }
                    titlePrefix={isEquipped ? EQUIPPED_STAR : undefined}
                    title={item.name}
                    subtitle={<span className="capitalize">{item.category}</span>}
                    description={description}
                    selected={isEquipped}
                    onClick={
                      description
                        ? () => setActiveInfo({ title: item.name, description })
                        : undefined
                    }
                    action={action}
                  />
                );
              })}
            </CardGrid>
          )}
        </section>

        {/* Feed section — unified list. Clicking Equip on any tier switches
            equippedFeedType atomically (backend replaces unconditionally), so
            users never need to Unequip-then-Equip to switch tiers. Clicking
            the card body opens a description popup. */}
        <section data-testid="feed-section">
          <h2 className="text-lg font-bold text-[var(--cream)] mb-3">Feed</h2>

          {data.feed.length === 0 ? (
            <div className="glass-panel text-center" data-testid="no-feed-empty-state">
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                No feed currently selected. Please purchase feed from the feed store and equip it to
                your horse.
              </p>
              <Button asChild>
                <Link to="/feed-shop">Go to Feed Shop</Link>
              </Button>
            </div>
          ) : (
            <CardGrid aria-label="Feed available for this horse">
              {data.feed.map((f) => {
                const isEquipped = f.isCurrentlyEquippedToThisHorse;
                const tierId = f.feedType as FeedItem['id'];
                const feedMeta = catalogById[tierId];
                const description = feedMeta?.description;

                const action = isEquipped ? (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      unequipFeed.mutate(undefined, {
                        onSuccess: () => toast.success('Unequipped.'),
                        onError: (err) =>
                          toast.error(
                            (err as { message?: string })?.message ?? 'Failed to unequip.'
                          ),
                      });
                    }}
                    disabled={unequipFeed.isPending}
                    data-testid="unequip-feed-button"
                    className="w-full"
                  >
                    {unequipFeed.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      'Unequip'
                    )}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      equipFeed.mutate(tierId, {
                        onSuccess: () =>
                          toast.success(
                            currentlyEquippedFeed ? `Switched to ${f.name}.` : `Equipped ${f.name}.`
                          ),
                        onError: (err) =>
                          toast.error((err as { message?: string })?.message ?? 'Failed to equip.'),
                      });
                    }}
                    disabled={equipFeed.isPending}
                    data-testid={`equip-feed-${f.feedType}`}
                    className="w-full"
                  >
                    Equip
                  </Button>
                );

                return (
                  <ItemCard
                    key={f.feedType}
                    data-testid={isEquipped ? 'equipped-feed-card' : `feed-item-${f.feedType}`}
                    media={
                      <img
                        src={FEED_IMAGES[tierId]}
                        alt={`${f.name} feed bag`}
                        loading="lazy"
                        className="w-20 h-20 object-contain"
                      />
                    }
                    titlePrefix={isEquipped ? EQUIPPED_STAR : undefined}
                    title={f.name}
                    subtitle={`${f.quantity} units in stock`}
                    description={description}
                    meta={
                      feedMeta ? (
                        <span className="text-[0.65rem] text-[var(--text-muted)]">
                          Stat-roll{' '}
                          <strong className="text-[var(--text-secondary)]">
                            {feedMeta.statRollPct}%
                          </strong>{' '}
                          · Pregnancy{' '}
                          <strong className="text-[var(--text-secondary)]">
                            +{feedMeta.pregnancyBonusPct}%
                          </strong>
                        </span>
                      ) : undefined
                    }
                    selected={isEquipped}
                    onClick={
                      description ? () => setActiveInfo({ title: f.name, description }) : undefined
                    }
                    action={action}
                  />
                );
              })}
            </CardGrid>
          )}
        </section>
      </div>

      {/* Item description popup */}
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
    </div>
  );
};

export default HorseEquipPage;
