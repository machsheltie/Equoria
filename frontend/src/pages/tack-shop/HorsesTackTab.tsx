/**
 * HorsesTackTab (extracted from TackShopPage — Equoria-f5xni)
 *
 * The "My Horses" tab: lists the player's horses for selection, surfaces
 * the DecorationsPanel for the selected horse, and offers a "Continue to
 * Shop" affordance. Owns its own loading / error / empty states.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Loader2, AlertCircle } from 'lucide-react';
import { CardGrid } from '@/components/ui/CardGrid';
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
  const { data: horses, isLoading, isError, error } = useHorses();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64" data-testid="horses-tack-loading">
        <Loader2 className="w-8 h-8 text-[var(--gold-400)] animate-spin" />
        <span className="ml-3 text-[var(--text-muted)] text-sm">Loading your horses…</span>
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
        <p className="text-[var(--text-secondary)] text-sm">
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
        <ShoppingBag className="w-12 h-12 text-[var(--gold-400)]/30 mb-4" />
        <h2 className="text-lg font-bold text-[var(--text-secondary)] mb-2">
          No Horses Registered
        </h2>
        <p className="text-sm text-[var(--text-muted)] max-w-sm mb-6">
          Visit your stable to equip tack on your horses. Quality saddles and bridles improve
          training and competition performance.
        </p>
        <Link
          to="/stable"
          className="px-5 py-2.5 bg-[var(--status-success)]/10 border border-[var(--status-success)]/20 text-[var(--status-success)] rounded-lg text-sm font-medium hover:bg-[var(--status-success)]/20 transition-all"
        >
          Go to Stable
        </Link>
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
            <button
              type="button"
              onClick={onGoToShop}
              className="px-5 py-2.5 bg-[var(--status-success)]/10 border border-[var(--status-success)]/20 text-[var(--status-success)] rounded-lg text-sm font-medium hover:bg-[var(--status-success)]/20 hover:border-[var(--status-success)]/40 transition-all"
            >
              Continue to Shop →
            </button>
          </div>
        </>
      )}
    </div>
  );
};
