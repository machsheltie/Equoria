/**
 * FarrierPage — World > Farrier Location (Epic 10 — Story 10-2;
 * UI consistency 2026-05-05, Equoria-hfqe).
 *
 * The Farrier location in the World hub. Two modes:
 * - My Horses: Hoof status overview per horse, select a horse for booking
 * - Services: Available farrier procedures; book via two-step (horse → service)
 *
 * Cards now share ItemCard + HorseCard + CardGrid; tabs use FantasyTabs in
 * controlled mode so cross-tab buttons can switch programmatically.
 *
 * Data sources:
 *   - useFarrierServices() → real service catalog from /api/farrier/services
 *   - useHorses()          → user's horses from /api/horses
 *   - useBookFarrierService() → POST /api/farrier/book-service
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Heart, Wrench, Clock, CheckCircle, Leaf, Loader2, AlertCircle } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { CardGrid } from '@/components/ui/CardGrid';
import { ItemCard } from '@/components/ui/ItemCard';
import { FantasyTabs } from '@/components/FantasyTabs';
import { HorseCard } from '@/components/horse/HorseCard';
import { useHorses } from '@/hooks/api/useHorses';
import { useFarrierServices, useBookFarrierService } from '@/hooks/api/useFarrier';
import type { FarrierService } from '@/hooks/api/useFarrier';

type FarrierTab = 'horses' | 'services';

// ── Horses Tab ────────────────────────────────────────────────────────────────

interface HorsesHoofTabProps {
  selectedHorseId: number | null;
  onSelectHorse: (_id: number) => void;
  onNavigateToServices: () => void;
}

const HorsesHoofTab: React.FC<HorsesHoofTabProps> = ({
  selectedHorseId,
  onSelectHorse,
  onNavigateToServices,
}) => {
  const { data: horses, isLoading, isError } = useHorses();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64" data-testid="horses-hoof-tab">
        <Loader2 className="w-8 h-8 text-[var(--gold-400)] animate-spin" />
        <span className="ml-3 text-[var(--text-muted)] text-sm">Loading your horses…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-64 gap-3 text-center"
        data-testid="horses-hoof-tab"
      >
        <AlertCircle className="w-10 h-10 text-[var(--status-danger)]/60" />
        <p className="text-[var(--text-secondary)] text-sm">
          Unable to load horses. Please try again later.
        </p>
      </div>
    );
  }

  if (!horses || horses.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-64 p-8 text-center"
        data-testid="horses-hoof-tab"
      >
        <Wrench className="w-12 h-12 text-[var(--gold-400)]/30 mb-4" />
        <h2 className="text-lg font-bold text-[var(--text-secondary)] mb-2">
          No Horses Registered
        </h2>
        <p className="text-sm text-[var(--text-muted)] max-w-sm mb-6">
          Visit your stable to bring horses in for their first hoof care appointment. Regular
          farrier visits keep your horses performing at their best.
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
    <div data-testid="horses-hoof-tab" className="space-y-4">
      {selectedHorseId !== null && (
        <div className="p-4 rounded-xl bg-[var(--status-success)]/10 border border-[var(--status-success)]/20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[var(--status-success)] text-sm font-medium">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Horse selected — choose a service to book
          </div>
          <button
            type="button"
            onClick={onNavigateToServices}
            className="px-4 py-1.5 bg-[var(--status-success)]/10 border border-[var(--status-success)]/20 text-[var(--status-success)] rounded-lg text-sm font-medium hover:bg-[var(--status-success)]/20 transition-colors flex-shrink-0"
          >
            View Services
          </button>
        </div>
      )}

      <CardGrid aria-label="Your horses">
        {horses.map((horse) => (
          <HorseCard
            key={horse.id}
            horse={horse}
            selected={horse.id === selectedHorseId}
            onClick={() => onSelectHorse(horse.id)}
            data-testid={`horse-card-${horse.id}`}
          />
        ))}
      </CardGrid>
    </div>
  );
};

// ── Services Tab ──────────────────────────────────────────────────────────────

interface ServicesTabProps {
  selectedHorseId: number | null;
  selectedHorseName: string | null;
  onBook: (_service: FarrierService) => void;
  isBooking: boolean;
  bookingServiceId: string | null;
  onNavigateToHorses: () => void;
}

const ServicesTab: React.FC<ServicesTabProps> = ({
  selectedHorseId,
  selectedHorseName,
  onBook,
  isBooking,
  bookingServiceId,
  onNavigateToHorses,
}) => {
  const { data: services, isLoading, isError } = useFarrierServices();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64" data-testid="farrier-services-tab">
        <Loader2 className="w-8 h-8 text-[var(--gold-400)] animate-spin" />
        <span className="ml-3 text-[var(--text-muted)] text-sm">Loading services…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-64 gap-3 text-center"
        data-testid="farrier-services-tab"
      >
        <AlertCircle className="w-10 h-10 text-[var(--status-danger)]/60" />
        <p className="text-[var(--text-secondary)] text-sm">
          Unable to load services. Please try again later.
        </p>
      </div>
    );
  }

  if (!services || services.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-64 p-8 text-center"
        data-testid="farrier-services-tab"
      >
        <Wrench className="w-12 h-12 text-[var(--gold-400)]/30 mb-4" />
        <h2 className="text-lg font-bold text-[var(--text-secondary)] mb-2">
          No Services Available
        </h2>
        <p className="text-sm text-[var(--text-muted)] max-w-sm">
          The farrier has no services listed at the moment. Check back later.
        </p>
      </div>
    );
  }

  const canBook = selectedHorseId !== null;

  return (
    <div data-testid="farrier-services-tab" className="space-y-4">
      {!canBook && (
        <div className="p-4 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] flex items-center justify-between gap-4">
          <p className="text-sm text-[var(--text-muted)]">
            Select a horse from the My Horses tab to unlock booking.
          </p>
          <button
            type="button"
            onClick={onNavigateToHorses}
            className="px-4 py-1.5 bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:text-[var(--cream)] transition-colors flex-shrink-0"
          >
            My Horses
          </button>
        </div>
      )}

      {canBook && selectedHorseName && (
        <div className="p-4 rounded-xl bg-[var(--status-success)]/10 border border-[var(--status-success)]/20 flex items-center gap-2 text-[var(--status-success)] text-sm font-medium">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          Booking for: {selectedHorseName}
        </div>
      )}

      <CardGrid aria-label="Farrier services">
        {services.map((service) => {
          const thisIsBooking = isBooking && bookingServiceId === service.id;
          const buttonLabel = thisIsBooking
            ? 'Booking…'
            : canBook
              ? `Book — $${service.cost.toLocaleString()}`
              : 'Select a Horse to Book';

          const action = (
            <button
              type="button"
              disabled={!canBook || isBooking}
              onClick={() => canBook && onBook(service)}
              className={`w-full py-2 text-sm font-medium rounded-lg transition-all ${
                canBook && !isBooking
                  ? 'bg-[var(--status-success)]/10 border border-[var(--status-success)]/20 text-[var(--status-success)] hover:bg-[var(--status-success)]/20 hover:border-[var(--status-success)]/40 cursor-pointer'
                  : 'bg-[var(--status-success)]/10 border border-[var(--status-success)]/20 text-[var(--status-success)]/60 cursor-not-allowed'
              }`}
              title={canBook ? `Book ${service.name}` : 'Select a horse from My Horses to book'}
              data-onboarding-target="farrier-book-button"
            >
              {thisIsBooking ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {buttonLabel}
                </span>
              ) : (
                buttonLabel
              )}
            </button>
          );

          const media = service.icon ? (
            <span
              className="text-3xl w-20 h-20 flex items-center justify-center"
              aria-hidden="true"
            >
              {service.icon}
            </span>
          ) : (
            <div className="w-20 h-20 rounded-lg bg-black/20 flex items-center justify-center text-[var(--gold-400)]/60">
              <Wrench className="w-8 h-8" />
            </div>
          );

          return (
            <ItemCard
              key={service.id}
              data-testid={`farrier-service-${service.id}`}
              media={media}
              title={service.name}
              subtitle={
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {service.duration}
                </span>
              }
              description={service.description}
              price={`$${service.cost.toLocaleString()}`}
              action={action}
            />
          );
        })}
      </CardGrid>
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

const FarrierPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<FarrierTab>('horses');
  const [selectedHorseId, setSelectedHorseId] = useState<number | null>(null);
  const [bookingServiceId, setBookingServiceId] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);

  const { data: horses } = useHorses();
  const bookMutation = useBookFarrierService();

  const selectedHorse = horses?.find((h) => h.id === selectedHorseId) ?? null;

  const handleSelectHorse = (id: number) => {
    setSelectedHorseId((prev) => (prev === id ? null : id));
    setBookingSuccess(null);
  };

  const handleBook = (service: FarrierService) => {
    if (selectedHorseId === null) return;
    setBookingServiceId(service.id);
    setBookingSuccess(null);

    bookMutation.mutate(
      { horseId: selectedHorseId, serviceId: service.id },
      {
        onSuccess: (result) => {
          const msg = `${result.data.service.name} booked for ${result.data.horse.name}. Remaining balance: $${result.data.remainingMoney.toLocaleString()}.`;
          setBookingSuccess(msg);
          setBookingServiceId(null);
          toast.success(msg);
        },
        onError: () => {
          setBookingServiceId(null);
          toast.error('Booking failed. Please try again.');
        },
      }
    );
  };

  return (
    <div className="min-h-screen">
      <PageHero
        title="The Farrier"
        subtitle="Hoof trimming, shoeing, and corrective care for your horses"
        mood="nature"
        icon={<Leaf className="w-7 h-7 text-[var(--gold-400)]" />}
      >
        <div className="flex items-center gap-2 text-sm text-[var(--cream)]/60">
          <Link to="/world" className="hover:text-[var(--cream)] transition-colors">
            World
          </Link>
          <span>/</span>
          <span className="text-[var(--cream)]">Farrier</span>
        </div>
      </PageHero>

      {/* Banner image in glass card */}
      <div className="max-w-[52rem] mx-auto px-4 sm:px-6 lg:px-8 pt-1 pb-4">
        <div className="p-5 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-sm border border-[var(--glass-border)] shadow-lg shadow-black/20">
          <img
            src="/images/farriershop.webp"
            alt="The Farrier — a skilled craftsman at work in a well-equipped forge and hoof care workshop"
            className="w-full h-auto rounded-xl"
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {bookingSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-[var(--status-success)]/10 border border-[var(--status-success)]/20 flex items-center gap-2 text-[var(--status-success)] text-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            {bookingSuccess}
          </div>
        )}

        {bookMutation.isError && (
          <div className="mb-6 p-4 rounded-xl bg-[var(--status-danger)]/10 border border-[var(--status-danger)]/20 text-[var(--status-danger)] text-sm">
            Booking failed:{' '}
            {bookMutation.error?.message ?? 'An unexpected error occurred. Please try again.'}
          </div>
        )}

        <FantasyTabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as FarrierTab)}
          tabs={[
            {
              value: 'horses',
              label: 'My Horses',
              icon: <Heart className="w-4 h-4" />,
              content: (
                <HorsesHoofTab
                  selectedHorseId={selectedHorseId}
                  onSelectHorse={handleSelectHorse}
                  onNavigateToServices={() => setActiveTab('services')}
                />
              ),
            },
            {
              value: 'services',
              label: 'Services',
              icon: <Wrench className="w-4 h-4" />,
              content: (
                <ServicesTab
                  selectedHorseId={selectedHorseId}
                  selectedHorseName={selectedHorse?.name ?? null}
                  onBook={handleBook}
                  isBooking={bookMutation.isPending}
                  bookingServiceId={bookingServiceId}
                  onNavigateToHorses={() => setActiveTab('horses')}
                />
              ),
            },
          ]}
        />

        {/* Info Panel */}
        <div className="mt-10 p-5 rounded-xl glass-panel text-sm text-[var(--text-muted)]">
          <h3 className="font-semibold text-[var(--cream)] mb-2">About the Farrier</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Horses need hoof trims every 6–8 weeks to maintain balance and soundness</li>
            <li>Horses with neglected hooves suffer movement penalties in competition</li>
            <li>Corrective shoeing gradually improves gait quality over multiple visits</li>
            <li>Damaged shoes must be removed before a horse can enter competitions</li>
            <li>Regular farrier care increases horse longevity and reduces injury risk</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FarrierPage;
