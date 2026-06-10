/**
 * HorseActionBar — sticky bottom quick-actions bar (portaled to body
 * to escape any glass-panel stacking context). Story 12-5.
 * Equoria-kdduk: extracted from HorseDetailPage.tsx.
 *
 * The Feed button calls POST /api/v1/horses/:id/feed via the
 * useFeedHorse mutation. Disabled when no feed equipped, already-fed-
 * today (UTC-day boundary), or horse is retired. Feed-system redesign
 * 2026-04-29 (A16).
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Dumbbell, Heart, Tag, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFeedHorse } from '../../hooks/api/useFeedHorse';
import { useDelistHorse } from '@/hooks/api/useMarketplace';
import type { Horse } from './HorseDetailPageTypes';

interface HorseActionBarProps {
  horse: Horse;
  onAssignRider: () => void;
  onListForSale: () => void;
  refetch: () => void;
}

const HorseActionBar: React.FC<HorseActionBarProps> = ({
  horse,
  onAssignRider,
  onListForSale,
  refetch,
}) => {
  const navigate = useNavigate();
  const feedHorseMutation = useFeedHorse(Number(horse.id));
  const delistHorseMutation = useDelistHorse();

  const isAlreadyFedToday = horse.lastFedDate
    ? new Date(horse.lastFedDate).toISOString().slice(0, 10) ===
      new Date().toISOString().slice(0, 10)
    : false;
  const feedDisabledReason = !horse.equippedFeedType
    ? 'No feed selected. Click Equip first.'
    : isAlreadyFedToday
      ? 'Fed today. Available again at UTC midnight.'
      : horse.feedHealth === 'retired'
        ? 'Retired.'
        : null;

  const handleFeed = () => {
    feedHorseMutation.mutate(undefined, {
      onSuccess: (result) => {
        if (result.skipped === 'retired') {
          toast.info(`${horse.name} is retired and doesn't need to be fed.`);
          return;
        }
        const feedName = result.feed?.name ?? 'feed';
        const remaining = result.remainingUnits ?? 0;
        const statSuffix = result.statBoost
          ? ` +1 ${result.statBoost.stat.charAt(0).toUpperCase() + result.statBoost.stat.slice(1)}!`
          : '';
        toast.success(
          `Fed ${result.horse.name} with ${feedName}. ${remaining} units left.${statSuffix}`,
          { duration: result.statBoost ? 5000 : 3000 }
        );
      },
      onError: (err) => toast.error((err as { message?: string })?.message ?? 'Feeding failed.'),
    });
  };

  return createPortal(
    /* Fully opaque bg: the bar overlays page content (gold CTAs at load) and a
       translucent bg made labels unreadable (Equoria-o5hub.28). No backdrop
       blur — an opaque surface must not blur (D-06). */
    <div
      className="fixed bottom-0 left-0 right-0 z-[var(--z-modal)] bg-[var(--bg-deep-space)] border-t border-burnished-gold/40"
      data-testid="horse-action-bar"
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-center gap-3 overflow-x-auto">
        <span className="text-xs fantasy-caption text-[var(--text-secondary)] whitespace-nowrap mr-1 flex-shrink-0">
          Quick Actions:
        </span>
        <Button
          type="button"
          size="sm"
          onClick={handleFeed}
          disabled={feedDisabledReason !== null || feedHorseMutation.isPending}
          title={feedDisabledReason ?? 'Feed this horse'}
          data-testid="action-feed"
        >
          <span aria-hidden="true">🌾</span>
          {feedHorseMutation.isPending ? 'Feeding…' : 'Feed'}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => navigate(`/training?horseId=${horse.id}`)}
          data-testid="action-train"
        >
          <Dumbbell className="w-3.5 h-3.5" />
          Train
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => navigate(`/breeding?horseId=${horse.id}`)}
          data-testid="action-breed"
        >
          <Heart className="w-3.5 h-3.5" />
          Breed
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onAssignRider}
          title="Assign a rider to this horse"
          data-testid="action-assign-rider"
        >
          <Users className="w-3.5 h-3.5" />
          Assign Rider
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => navigate(`/grooms?horseId=${horse.id}`)}
          title="Assign a groom to this horse"
          data-testid="action-assign-groom"
        >
          <span aria-hidden="true">🧹</span>
          Assign Groom
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => navigate(`/horses/${horse.id}/equip`)}
          title="Manage tack and feed for this horse"
          data-testid="action-equip"
        >
          <span aria-hidden="true">🎒</span>
          Equip
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => navigate(`/farrier?horseId=${horse.id}`)}
          title="Shoe this horse"
          data-testid="action-shoe-horse"
        >
          <span aria-hidden="true">🔧</span>
          Shoe Horse
        </Button>
        {horse.forSale ? (
          <Button
            type="button"
            size="sm"
            onClick={() => delistHorseMutation.mutate(horse.id, { onSuccess: () => refetch() })}
            disabled={delistHorseMutation.isPending}
            data-testid="action-delist"
          >
            <X className="w-3.5 h-3.5" />
            Delist
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={onListForSale}
            data-testid="action-list-for-sale"
          >
            <Tag className="w-3.5 h-3.5" />
            List for Sale
          </Button>
        )}
      </div>
    </div>,
    document.body
  );
};

export default HorseActionBar;
