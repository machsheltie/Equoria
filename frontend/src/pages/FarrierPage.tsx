/**
 * FarrierPage — World > Farrier Location (Epic 10 — Story 10-2)
 *
 * The Farrier location in the World hub. Two modes:
 * - My Horses: Hoof status overview per horse, select a horse for booking
 * - Services: Available farrier procedures; book via two-step (horse → service)
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
import { useHorses } from '@/hooks/api/useHorses';
import { useFarrierServices, useBookFarrierService } from '@/hooks/api/useFarrier';
import type { FarrierService } from '@/hooks/api/useFarrier';
import { getBreedName } from '@/lib/utils';

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
    <div data-testid="horses-hoof-tab">
      {selectedHorseId !== null && (
        <div className="mb-5 p-4 rounded-xl bg-[var(--status-success)]/10 border border-[var(--status-success)]/20 flex items-center justify-between gap-4">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {horses.map((horse) => {
          const isSelected = horse.id === selectedHorseId;
          return (
            <div
              key={horse.id}
              className={`backdrop-blur-sm border rounded-xl p-5 transition-all ${
                isSelected
                  ? 'bg-[var(--status-success)]/10 border-[var(--status-success)]/50'
                  : 'bg-[var(--glass-bg)] border-[var(--glass-border)] hover:border-[var(--glass-hover)]'
              }`}
              data-testid={`horse-card-${horse.id}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-[var(--cream)]">{horse.name}</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {getBreedName(horse.breed)} &middot; Age {horse.age}
                  </p>
                </div>
                {isSelected && (
                  <span className="flex-shrink-0 text-xs font-medium text-[var(--status-success)] bg-[var(--status-success)]/10 border border-[var(--status-success)]/20 px-2 py-0.5 rounded-full">
                    Selected
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-[var(--text-muted)]">Health:</span>
                <span
                  className={`text-xs font-medium ${
                    horse.healthStatus === 'healthy'
                      ? 'text-[var(--status-success)]'
                      : 'text-[var(--status-danger)]'
                  }`}
                >
                  {horse.healthStatus}
                </span>
              </div>

              <button
                type="button"
                onClick={() => onSelectHorse(horse.id)}
                className={`w-full py-2 text-sm font-medium rounded-lg transition-all ${
                  isSelected
                    ? 'bg-[var(--status-success)]/20 border border-[var(--status-success)]/40 text-[var(--status-success)]'
                    : 'bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:bg-[var(--glass-hover)]/20 hover:text-[var(--cream)]'
                }`}
              >
                {isSelected ? 'Selected' : 'Select for Service'}
              </button>
            </div>
          );
        })}
      </div>
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
    <div data-testid="farrier-services-tab">
      {!canBook && (
        <div className="mb-5 p-4 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] flex items-center justify-between gap-4">
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
        <div className="mb-5 p-4 rounded-xl bg-[var(--status-success)]/10 border border-[var(--status-success)]/20 flex items-center gap-2 text-[var(--status-success)] text-sm font-medium">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          Booking for: {selectedHorseName}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {services.map((service) => {
          const thisIsBooking = isBooking && bookingServiceId === service.id;
          return (
            <div
              key={service.id}
              className="bg-[var(--glass-bg)] backdrop-blur-sm border border-[var(--glass-border)] rounded-xl p-5 hover:border-[var(--glass-hover)] transition-all"
              data-testid={`farrier-service-${service.id}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {service.icon ? (
                    <span className="text-2xl" aria-hidden="true">
                      {service.icon}
                    </span>
                  ) : (
                    <Wrench className="w-6 h-6 text-[var(--gold-400)]/60" aria-hidden="true" />
                  )}
                  <div>
                    <h3 className="font-bold text-[var(--cream)]">{service.name}</h3>
                    <span className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {service.duration}
                    </span>
                  </div>
                </div>
                <p className="text-lg font-bold text-[var(--gold-400)]">
                  ${service.cost.toLocaleString()}
                </p>
              </div>
              <p className="text-sm text-[var(--text-muted)] mb-4">{service.description}</p>
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
                    Booking…
                  </span>
                ) : canBook ? (
                  `Book — $${service.cost.toLocaleString()}`
                ) : (
                  'Select a Horse to Book'
                )}
              </button>
            </div>
          );
        })}
      </div>
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
    setSelectedHorseId(id);
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
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
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
        {/* Booking success banner */}
        {bookingSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-[var(--status-success)]/10 border border-[var(--status-success)]/20 flex items-center gap-2 text-[var(--status-success)] text-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            {bookingSuccess}
          </div>
        )}

        {/* Booking error banner */}
        {bookMutation.isError && (
          <div className="mb-6 p-4 rounded-xl bg-[var(--status-danger)]/10 border border-[var(--status-danger)]/20 text-[var(--status-danger)] text-sm">
            Booking failed:{' '}
            {bookMutation.error?.message ?? 'An unexpected error occurred. Please try again.'}
          </div>
        )}

        {/* My Horses / Services Tabs */}
        <div
          className="flex gap-1 p-1 bg-[var(--glass-bg)] backdrop-blur-sm border border-[var(--glass-border)] rounded-xl mb-8 w-fit"
          role="tablist"
          aria-label="Farrier section"
        >
          <button
            role="tab"
            aria-selected={activeTab === 'horses'}
            onClick={() => setActiveTab('horses')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'horses'
                ? 'bg-[var(--glass-bg)] text-[var(--cream)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
            data-testid="horses-tab"
          >
            <Heart className="w-4 h-4" />
            My Horses
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'services'}
            onClick={() => setActiveTab('services')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'services'
                ? 'bg-[var(--glass-bg)] text-[var(--cream)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
            data-testid="services-tab"
          >
            <Wrench className="w-4 h-4" />
            Services
          </button>
        </div>

        {/* Tab Content */}
        <div role="tabpanel">
          {activeTab === 'horses' ? (
            <HorsesHoofTab
              selectedHorseId={selectedHorseId}
              onSelectHorse={handleSelectHorse}
              onNavigateToServices={() => setActiveTab('services')}
            />
          ) : (
            <ServicesTab
              selectedHorseId={selectedHorseId}
              selectedHorseName={selectedHorse?.name ?? null}
              onBook={handleBook}
              isBooking={bookMutation.isPending}
              bookingServiceId={bookingServiceId}
              onNavigateToHorses={() => setActiveTab('horses')}
            />
          )}
        </div>

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
