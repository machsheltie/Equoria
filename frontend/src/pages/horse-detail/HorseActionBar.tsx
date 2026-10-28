/**
 * HorseActionBar — bottom quick-actions bar content. Story 12-5.
 * Equoria-kdduk: extracted from HorseDetailPage.tsx.
 *
 * Equoria-o5hub.5 (D-24): no longer portals itself to document.body with
 * its own fixed positioning + z-modal. It is now a plain content bar that
 * HorseDetailPage registers through the DashboardLayout contextual slot
 * (<ContextualBottomActions>), which owns positioning (above BottomNav on
 * mobile, viewport bottom on desktop) at the --z-nav tier so dialogs layer
 * above it. In provider-less renders (tests) the bar renders in place.
 *
 * The Feed button calls POST /api/v1/horses/:id/feed via the
 * useFeedHorse mutation. Disabled when no feed equipped, already-fed-
 * today (Eastern game-day boundary), or horse is retired. Feed-system redesign
 * 2026-04-29 (A16).
 *
 * Owner ruling 2026-10-28 (Equoria-7dje4): once a groom is assigned, the
 * daily Groom Horse press lives here (GroomHorseAction); without a groom the
 * same slot offers Assign Groom.
 *
 * Owner ruling 2026-10-28 (Equoria-k8wxl): the Quick Actions buttons look like
 * the gold Train / Enter Competition buttons, at their own small size, and
 * Enter Competition lives here; the middle of the page no longer carries Train
 * or Enter Competition. Old contract: secondary (frosted) buttons here and the
 * two gold buttons in the middle of the page.
 */

import React from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { gameDateKey } from '@/lib/gameTime';
import { formatHealth } from '@/lib/healthWords';
import { Award, Backpack, Dumbbell, Tag, Users, Wheat, Wrench, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Currency from '@/components/ui/Currency';
import { useHorseTrainer } from '@/hooks/api/useTrainers';
import { useFeedHorse } from '../../hooks/api/useFeedHorse';
import { useDelistHorse } from '@/hooks/api/useMarketplace';
import type { Horse } from './HorseDetailPageTypes';
import GroomHorseAction from './GroomHorseAction';

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
  // Equoria-1poxi: with a trainer assigned the button names the one session charge.
  const {
    assignment: horseTrainer,
    fee: trainerFee,
    isLoading: trainerLoading,
    isError: trainerError,
  } = useHorseTrainer(Number(horse.id));
  // Equoria-r8a6h (q81): a trainer is required to train, so a horse with none offers
  // "Assign Trainer" instead. A trainer list still loading or failed offers the plain
  // button; the server's refusal stays the authority.
  const needsTrainer = !trainerLoading && !trainerError && horseTrainer === null;

  // Hunger is a fill bar (owner ruling 2026-10-23): a horse below Excellent can be
  // fed again today; at Excellent it is fed once per Eastern game day. The level is
  // the server's (feedHealth). Without one, fed today still means no more today.
  const hungerIsFull =
    horse.feedHealth === undefined ||
    horse.feedHealth === null ||
    formatHealth(horse.feedHealth) === 'Excellent';
  const isAlreadyFedToday =
    hungerIsFull && horse.lastFedDate
      ? gameDateKey(horse.lastFedDate) === gameDateKey(new Date())
      : false;
  const feedDisabledReason = !horse.equippedFeedType
    ? 'No feed selected. Click Equip first.'
    : isAlreadyFedToday
      ? 'Fed today. Available again at midnight Eastern time.'
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

  return (
    /* Fully opaque bg: the bar overlays page content (gold CTAs at load) and a
       translucent bg made labels unreadable (Equoria-o5hub.28). No backdrop
       blur — an opaque surface must not blur (D-06). Positioning/z-index are
       owned by the DashboardLayout contextual slot (Equoria-o5hub.5). */
    <div
      className="bg-[var(--bg-deep-space)] border-t border-[var(--alpha-gold-primary-40)]"
      data-testid="horse-action-bar"
    >
      {/* Equoria-o5hub.20: no inner max-w wrapper — the DashboardLayout
          contextual slot owns positioning/width; the bar only lays out its
          own content (D §1: pages don't re-add width constraints). */}
      <div className="px-4 py-3 flex items-center justify-center gap-3 overflow-x-auto">
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
          <Wheat className="w-3.5 h-3.5" />
          {feedHorseMutation.isPending ? 'Feeding…' : 'Feed'}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() =>
            navigate(
              needsTrainer ? `/trainers?horseId=${horse.id}` : `/training?horseId=${horse.id}`
            )
          }
          data-testid="action-train"
        >
          <Dumbbell className="w-3.5 h-3.5" />
          {needsTrainer ? (
            'Assign Trainer'
          ) : trainerFee > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              Train Horse <Currency amount={trainerFee} />
            </span>
          ) : (
            'Train'
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => navigate(`/competitions?horseId=${horse.id}`)}
          data-testid="action-enter-competition"
        >
          <Award className="w-3.5 h-3.5" />
          Enter Competition
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
        <GroomHorseAction horseId={Number(horse.id)} />
        <Button
          type="button"
          size="sm"
          onClick={() => navigate(`/horses/${horse.id}/equip`)}
          title="Manage tack and feed for this horse"
          data-testid="action-equip"
        >
          <Backpack className="w-3.5 h-3.5" />
          Equip
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => navigate(`/farrier?horseId=${horse.id}`)}
          title="Shoe this horse"
          data-testid="action-shoe-horse"
        >
          <Wrench className="w-3.5 h-3.5" />
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
    </div>
  );
};

export default HorseActionBar;
