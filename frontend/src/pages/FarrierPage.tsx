/**
 * FarrierPage — World > Farrier Location (Epic 10 — Story 10-2;
 * UI consistency 2026-05-05, Equoria-hfqe).
 *
 * Owner ruling 2026-10-23 (Equoria-zmqzf): the farrier has one action. Once a
 * week the player picks a horse and clicks "Shoe horse" for 50 coins; the horse
 * is recorded as shod and, for now, one stat gains +1. The hero layout stays;
 * only the service area is this single action.
 *
 * Design-system migration (Equoria-o5hub, world-services family): PageHero
 * retained (genuine location artwork), PageContainer variants replace local
 * max-w wrappers, Surface replaces local glass recipes, canonical async
 * states (SectionLoading / ErrorState / EmptyState), Currency for prices,
 * Button for command actions.
 *
 * Data sources:
 *   - useHorses()     → user's horses from /api/horses
 *   - useShoeHorse()  → POST /api/v1/farrier/shoe-horse
 */

import { actionMessageFor } from '@/lib/http/actionMessage';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Wrench, CheckCircle, Leaf } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { PageContainer } from '@/components/layout/PageContainer';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/button';
import Currency from '@/components/ui/Currency';
import { CardGrid } from '@/components/ui/CardGrid';
import { SectionLoading, ErrorState } from '@/components/ui/state';
import EmptyState from '@/components/ui/EmptyState';
import { HorseCard } from '@/components/horse/HorseCard';
import { useHorses } from '@/hooks/api/useHorses';
import { useShoeHorse } from '@/hooks/api/useFarrier';

/** Shown on the button; the server charges the same 50 (farrierController SHOEING_COST). */
const SHOEING_COST = 50;

const titleCase = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

// ── Page ──────────────────────────────────────────────────────────────────────

const FarrierPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedHorseId, setSelectedHorseId] = useState<number | null>(null);
  const [shoeingSuccess, setShoeingSuccess] = useState<string | null>(null);

  const { data: horses, isLoading, isError, refetch } = useHorses();
  const shoeMutation = useShoeHorse();

  const selectedHorse = horses?.find((h) => h.id === selectedHorseId) ?? null;

  const handleSelectHorse = (id: number) => {
    setSelectedHorseId((prev) => (prev === id ? null : id));
    setShoeingSuccess(null);
  };

  const handleShoe = () => {
    if (selectedHorseId === null) return;
    setShoeingSuccess(null);

    shoeMutation.mutate(
      { horseId: selectedHorseId },
      {
        onSuccess: (result) => {
          setShoeingSuccess(
            `${result.horse.name} has been shod and gained +1 ${titleCase(result.statGained)}. Remaining balance: ${result.remainingMoney.toLocaleString('en-US')} coins.`
          );
        },
      }
    );
  };

  const renderHorses = () => {
    if (isLoading) {
      return (
        <div data-testid="farrier-horses">
          <SectionLoading label="Loading your horses" minHeight="256px" />
        </div>
      );
    }

    if (isError) {
      return (
        <div data-testid="farrier-horses">
          <ErrorState
            title="Unable to Load Horses"
            message="Unable to load horses. Please try again later."
            retry={{ label: 'Try Again', onClick: () => refetch() }}
          />
        </div>
      );
    }

    if (!horses || horses.length === 0) {
      return (
        <div data-testid="farrier-horses">
          <EmptyState
            variant="first-use"
            icon={<Wrench className="w-8 h-8" aria-hidden="true" />}
            title="No Horses Registered"
            description="Visit your stable to bring a horse in. The farrier shoes each horse once a week."
            primaryAction={{ label: 'Go to Stable', onClick: () => navigate('/stable') }}
          />
        </div>
      );
    }

    return (
      <div data-testid="farrier-horses" className="space-y-4">
        <CardGrid aria-label="Your horses">
          {horses.map((horse) => (
            <HorseCard
              key={horse.id}
              horse={horse}
              selected={horse.id === selectedHorseId}
              onClick={() => handleSelectHorse(horse.id)}
              data-testid={`horse-card-${horse.id}`}
            />
          ))}
        </CardGrid>
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <PageHero
        title="The Farrier"
        subtitle="Shoe your horses once a week"
        icon={<Leaf className="w-7 h-7 text-[var(--gold-400)]" />}
      >
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"
        >
          <Link to="/world" className="hover:text-[var(--text-primary)] transition-colors">
            World
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-[var(--text-primary)]">Farrier</span>
        </nav>
      </PageHero>

      {/* Banner image in glass card */}
      <PageContainer variant="content" padded={false} className="pt-1 pb-4">
        <Surface variant="panel">
          <img
            src="/images/farriershop.webp"
            alt="The Farrier — a skilled craftsman at work in a well-equipped forge and hoof care workshop"
            className="w-full h-auto rounded-[var(--radius-md)]"
          />
        </Surface>
      </PageContainer>

      <PageContainer variant="wide" padded={false} className="pb-8">
        {shoeingSuccess && (
          <div className="mb-6 p-4 rounded-[var(--radius-md)] bg-[var(--role-success-bg)] border border-[var(--role-success-border)] flex items-center gap-2 text-[var(--role-success-text)] text-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            {shoeingSuccess}
          </div>
        )}

        {shoeMutation.isError && (
          <div
            className="mb-6 p-4 rounded-[var(--radius-md)] bg-[var(--role-danger-bg)] border border-[var(--role-danger-border)] text-[var(--role-danger-text)] text-sm"
            role="alert"
          >
            Shoeing failed:{' '}
            {actionMessageFor(shoeMutation.error, {
              400: "The farrier couldn't shoe that horse. Check your balance.",
              404: "That horse couldn't be found. Reload and try again.",
              409: 'That horse has already been shod this week.',
            })}
          </div>
        )}

        <Surface
          variant="subtle"
          className="mb-6 p-4 flex items-center justify-between gap-4"
          data-testid="farrier-shoe-action"
        >
          <p className="text-sm text-[var(--text-muted)]">
            {selectedHorse
              ? `Shoeing: ${selectedHorse.name}`
              : 'Choose a horse below, then shoe it.'}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={selectedHorseId === null || shoeMutation.isPending}
            pending={shoeMutation.isPending}
            onClick={handleShoe}
            className="flex-shrink-0"
            data-onboarding-target="farrier-book-button"
          >
            <span className="flex items-center gap-1.5">
              Shoe horse — <Currency amount={SHOEING_COST} />
            </span>
          </Button>
        </Surface>

        {renderHorses()}

        {/* Info Panel */}
        <Surface variant="panel" as="aside" className="mt-10 text-sm text-[var(--text-muted)]">
          <h3 className="font-semibold text-[var(--text-primary)] mb-2">About the Farrier</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Each horse can be shod once a week, for 50 coins</li>
            <li>A shod horse gains +1 in one stat</li>
          </ul>
        </Surface>
      </PageContainer>
    </div>
  );
};

export default FarrierPage;
