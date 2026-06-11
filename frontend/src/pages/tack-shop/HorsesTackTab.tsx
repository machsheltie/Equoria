/**
 * HorsesTackTab (extracted from TackShopPage — Equoria-f5xni)
 *
 * The "My Horses" tab: lists the player's horses for selection, surfaces
 * the DecorationsPanel for the selected horse, and offers a "Continue to
 * Shop" affordance. Owns its own loading / error / empty states.
 *
 * Design-system migration (Equoria-o5hub, world-services family): canonical
 * SectionLoading / ErrorState / EmptyState, Button for command actions.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { CardGrid } from '@/components/ui/CardGrid';
import { Button } from '@/components/ui/button';
import { SectionLoading, ErrorState } from '@/components/ui/state';
import EmptyState from '@/components/ui/EmptyState';
import { HorseCard } from '@/components/horse/HorseCard';
import { useHorses } from '@/hooks/api/useHorses';
import type { HorseSummary } from '@/lib/api-client';
import { DecorationsPanel } from './DecorationsPanel';

interface HorsesTackTabProps {
  selectedHorse: HorseSummary | null;
  onSelectHorse: (_horse: HorseSummary) => void;
  onGoToShop: () => void;
}

export const HorsesTackTab: React.FC<HorsesTackTabProps> = ({
  selectedHorse,
  onSelectHorse,
  onGoToShop,
}) => {
  const navigate = useNavigate();
  const { data: horses, isLoading, isError, error, refetch } = useHorses();

  if (isLoading) {
    return (
      <div data-testid="horses-tack-loading">
        <SectionLoading label="Loading your horses" minHeight="256px" />
      </div>
    );
  }

  if (isError) {
    return (
      <div data-testid="horses-tack-error">
        <ErrorState
          title="Unable to Load Horses"
          message={(error as { message?: string })?.message ?? 'Failed to load horses.'}
          retry={{ label: 'Try Again', onClick: () => refetch() }}
        />
      </div>
    );
  }

  if (!horses || horses.length === 0) {
    return (
      <div data-testid="horses-tack-tab">
        <EmptyState
          variant="first-use"
          icon={<ShoppingBag className="w-8 h-8" aria-hidden="true" />}
          title="No Horses Registered"
          description="Visit your stable to equip tack on your horses. Quality saddles and bridles improve training and competition performance."
          primaryAction={{ label: 'Go to Stable', onClick: () => navigate('/stable') }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="horses-tack-tab">
      <p className="text-sm text-[var(--text-muted)]">
        Select a horse, then switch to the Shop tab to purchase tack. Tack condition is visible on
        each horse&rsquo;s detail page.
      </p>
      <CardGrid aria-label="Your horses">
        {horses.map((horse) => (
          <HorseCard
            key={horse.id}
            horse={horse}
            selected={selectedHorse?.id === horse.id}
            onClick={() => onSelectHorse(horse)}
            data-testid={`horse-card-${horse.id}`}
          />
        ))}
      </CardGrid>

      {selectedHorse && (
        <>
          {/* Equoria-n9n8 — decorations management for the selected horse.
              The panel renders an Unequip button per equipped decoration
              (POST /api/v1/tack-shop/unequip-decoration). */}
          <DecorationsPanel horse={selectedHorse} />

          <div className="flex justify-end pt-2">
            <Button type="button" variant="secondary" onClick={onGoToShop}>
              Continue to Shop →
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
