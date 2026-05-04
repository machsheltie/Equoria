/**
 * HorseEquipPage (feed-system redesign 2026-04-29, Equoria-gav7).
 *
 * Per-horse equip view at /horses/:id/equip. Two sections:
 *   - Tack: items NOT currently equipped to a different horse, with a
 *     'Equip from Inventory' link (the existing inventory equip flow handles
 *     the actual mutation — this page surfaces what's available).
 *   - Feed: the 5 catalog tiers in the user's inventory with quantity > 0,
 *     plus a 'currently equipped' card if the horse already has a tier set.
 *     Each available tier has an 'Equip' button; the equipped card has an
 *     'Unequip' button.
 *
 * Data hooks:
 *   useEquippable(horseId)  — GET /api/v1/horses/:id/equippable
 *   useEquipFeed(horseId)   — POST /api/v1/horses/:id/equip-feed
 *   useUnequipFeed(horseId) — POST /api/v1/horses/:id/unequip-feed
 */

import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { Button } from '@/components/ui/button';
import { useEquippable } from '@/hooks/api/useEquippable';
import { useEquipFeed, useUnequipFeed } from '@/hooks/api/useEquipFeed';
import { FeedItem } from '@/lib/api-client';

const HorseEquipPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const horseId = Number(id);
  const navigate = useNavigate();
  const { data, isLoading, isError } = useEquippable(horseId);
  const equipFeed = useEquipFeed(horseId);
  const unequipFeed = useUnequipFeed(horseId);

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

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
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
            <ul className="space-y-3">
              {data.tack.map((item) => (
                <li
                  key={item.id}
                  className="glass-panel flex items-center justify-between gap-3"
                  data-testid={`tack-item-${item.id}`}
                >
                  <div>
                    <p className="font-bold text-[var(--cream)] text-sm">{item.name}</p>
                    {item.bonus && (
                      <p className="text-xs text-[var(--gold-light)] mt-0.5">{item.bonus}</p>
                    )}
                  </div>
                  {/* Tack equip uses the existing inventory equip flow; that endpoint already exists. */}
                  <Button asChild size="sm">
                    <Link to="/inventory">Equip from Inventory</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Feed section — unified list. Clicking Equip on any tier switches
            equippedFeedType atomically (backend replaces unconditionally), so
            users never need to Unequip-then-Equip to switch tiers. The
            currently-equipped tier shows a distinct treatment + Unequip button
            for users who want to clear the selection entirely. */}
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
            <ul className="space-y-3">
              {data.feed.map((f) => {
                const isEquipped = f.isCurrentlyEquippedToThisHorse;
                return (
                  <li
                    key={f.feedType}
                    className="glass-panel flex items-center justify-between gap-3"
                    data-testid={isEquipped ? 'equipped-feed-card' : `feed-item-${f.feedType}`}
                  >
                    <div>
                      {isEquipped && (
                        <p className="text-xs text-[var(--gold-light)] uppercase tracking-wide font-semibold">
                          Currently equipped
                        </p>
                      )}
                      <p
                        className="font-bold text-[var(--cream)] text-sm"
                        data-testid={isEquipped ? 'equipped-feed-name' : undefined}
                      >
                        {f.name}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {f.quantity} units in stock
                      </p>
                    </div>
                    {isEquipped ? (
                      <Button
                        size="sm"
                        onClick={() =>
                          unequipFeed.mutate(undefined, {
                            onSuccess: () => toast.success('Unequipped.'),
                            onError: (err) =>
                              toast.error(
                                (err as { message?: string })?.message ?? 'Failed to unequip.'
                              ),
                          })
                        }
                        disabled={unequipFeed.isPending}
                        data-testid="unequip-feed-button"
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
                        onClick={() =>
                          equipFeed.mutate(f.feedType as FeedItem['id'], {
                            onSuccess: () =>
                              toast.success(
                                currentlyEquippedFeed
                                  ? `Switched to ${f.name}.`
                                  : `Equipped ${f.name}.`
                              ),
                            onError: (err) =>
                              toast.error(
                                (err as { message?: string })?.message ?? 'Failed to equip.'
                              ),
                          })
                        }
                        disabled={equipFeed.isPending}
                        data-testid={`equip-feed-${f.feedType}`}
                      >
                        Equip
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default HorseEquipPage;
