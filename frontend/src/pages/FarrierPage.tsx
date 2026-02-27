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
import { ArrowLeft, Heart, Wrench, Clock, CheckCircle } from 'lucide-react';
import MainNavigation from '@/components/MainNavigation';
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
      <div
        className="flex flex-col items-center justify-center min-h-64 p-8 text-center"
        data-testid="horses-hoof-tab"
      >
        <div className="w-8 h-8 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin mb-4" />
        <p className="text-sm text-white/40">Loading your horses...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-64 p-8 text-center"
        data-testid="horses-hoof-tab"
      >
        <Wrench className="w-12 h-12 text-red-400/30 mb-4" />
        <h2 className="text-lg font-bold text-white/60 mb-2">Unable to Load Horses</h2>
        <p className="text-sm text-white/40 max-w-sm">
          There was a problem fetching your horses. Please try again later.
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
        <Wrench className="w-12 h-12 text-amber-400/30 mb-4" />
        <h2 className="text-lg font-bold text-white/60 mb-2">No Horses Registered</h2>
        <p className="text-sm text-white/40 max-w-sm mb-6">
          Visit your stable to bring horses in for their first hoof care appointment. Regular
          farrier visits keep your horses performing at their best.
        </p>
        <Link
          to="/stable"
          className="px-5 py-2.5 bg-amber-600/20 border border-amber-500/30 text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-600/30 transition-colors"
        >
          Go to Stable
        </Link>
      </div>
    );
  }

  return (
    <div data-testid="horses-hoof-tab">
      {selectedHorseId !== null && (
        <div className="mb-5 p-4 rounded-xl bg-amber-600/10 border border-amber-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Horse selected — choose a service to book
          </div>
          <button
            type="button"
            onClick={onNavigateToServices}
            className="px-4 py-1.5 bg-amber-600/20 border border-amber-500/40 text-amber-300 rounded-lg text-sm font-medium hover:bg-amber-600/30 transition-colors flex-shrink-0"
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
              className={`bg-white/5 border rounded-xl p-5 transition-all ${
                isSelected
                  ? 'border-amber-500/50 bg-amber-600/10'
                  : 'border-white/10 hover:border-white/20'
              }`}
              data-testid={`horse-card-${horse.id}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-white/90">{horse.name}</h3>
                  <p className="text-xs text-white/40 mt-0.5">
                    {horse.breed} &middot; Age {horse.age}
                  </p>
                </div>
                {isSelected && (
                  <span className="flex-shrink-0 text-xs font-medium text-amber-400 bg-amber-600/20 border border-amber-500/30 px-2 py-0.5 rounded-full">
                    Selected
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-white/40">Health:</span>
                <span
                  className={`text-xs font-medium ${
                    horse.healthStatus === 'healthy' ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {horse.healthStatus}
                </span>
              </div>

              <button
                type="button"
                onClick={() => onSelectHorse(horse.id)}
                className={`w-full py-2 text-sm font-medium rounded-lg transition-colors ${
                  isSelected
                    ? 'bg-amber-600/30 border border-amber-500/50 text-amber-300'
                    : 'bg-amber-600/10 border border-amber-500/20 text-amber-400 hover:bg-amber-600/20 hover:border-amber-500/40'
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
      <div
        className="flex flex-col items-center justify-center min-h-64 p-8 text-center"
        data-testid="farrier-services-tab"
      >
        <div className="w-8 h-8 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin mb-4" />
        <p className="text-sm text-white/40">Loading services...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-64 p-8 text-center"
        data-testid="farrier-services-tab"
      >
        <Wrench className="w-12 h-12 text-red-400/30 mb-4" />
        <h2 className="text-lg font-bold text-white/60 mb-2">Unable to Load Services</h2>
        <p className="text-sm text-white/40 max-w-sm">
          There was a problem fetching available services. Please try again later.
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
        <Wrench className="w-12 h-12 text-amber-400/30 mb-4" />
        <h2 className="text-lg font-bold text-white/60 mb-2">No Services Available</h2>
        <p className="text-sm text-white/40 max-w-sm">
          The farrier has no services listed at the moment. Check back later.
        </p>
      </div>
    );
  }

  const canBook = selectedHorseId !== null;

  return (
    <div data-testid="farrier-services-tab">
      {!canBook && (
        <div className="mb-5 p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-4">
          <p className="text-sm text-white/50">
            Select a horse from the My Horses tab to unlock booking.
          </p>
          <button
            type="button"
            onClick={onNavigateToHorses}
            className="px-4 py-1.5 bg-white/10 border border-white/20 text-white/70 rounded-lg text-sm font-medium hover:bg-white/15 transition-colors flex-shrink-0"
          >
            My Horses
          </button>
        </div>
      )}

      {canBook && selectedHorseName && (
        <div className="mb-5 p-4 rounded-xl bg-amber-600/10 border border-amber-500/30 flex items-center gap-2 text-amber-400 text-sm font-medium">
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
              className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all"
              data-testid={`farrier-service-${service.id}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {service.icon ? (
                    <span className="text-2xl" aria-hidden="true">
                      {service.icon}
                    </span>
                  ) : (
                    <Wrench className="w-6 h-6 text-amber-400/60" aria-hidden="true" />
                  )}
                  <div>
                    <h3 className="font-bold text-white/90">{service.name}</h3>
                    <span className="text-xs text-white/40 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {service.duration}
                    </span>
                  </div>
                </div>
                <p className="text-lg font-bold text-celestial-gold">
                  ${service.cost.toLocaleString()}
                </p>
              </div>
              <p className="text-sm text-white/50 mb-4">{service.description}</p>
              <button
                type="button"
                disabled={!canBook || isBooking}
                onClick={() => canBook && onBook(service)}
                className={`w-full py-2 text-sm font-medium rounded-lg transition-colors ${
                  canBook && !isBooking
                    ? 'bg-amber-600/20 border border-amber-500/40 text-amber-300 hover:bg-amber-600/30 cursor-pointer'
                    : 'bg-amber-600/10 border border-amber-500/20 text-amber-400/60 cursor-not-allowed'
                }`}
                title={canBook ? `Book ${service.name}` : 'Select a horse from My Horses to book'}
                data-onboarding-target="farrier-book-button"
              >
                {thisIsBooking
                  ? 'Booking...'
                  : canBook
                    ? `Book — $${service.cost.toLocaleString()}`
                    : 'Select a Horse to Book'}
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
      <MainNavigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
          <Link to="/world" className="hover:text-white/70 transition-colors">
            World
          </Link>
          <span>/</span>
          <span className="text-white/70">Farrier</span>
        </div>

        {/* Page Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            to="/world"
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all"
            aria-label="Back to World"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white/90">🔨 Farrier</h1>
            <p className="text-sm text-white/50 mt-0.5">
              Hoof trimming, shoeing, and corrective care for your horses
            </p>
          </div>
        </div>

        {/* Booking success banner */}
        {bookingSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-600/10 border border-emerald-500/30 flex items-center gap-2 text-emerald-400 text-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            {bookingSuccess}
          </div>
        )}

        {/* Booking error banner */}
        {bookMutation.isError && (
          <div className="mb-6 p-4 rounded-xl bg-red-600/10 border border-red-500/30 text-red-400 text-sm">
            Booking failed:{' '}
            {bookMutation.error?.message ?? 'An unexpected error occurred. Please try again.'}
          </div>
        )}

        {/* My Horses / Services Tabs */}
        <div
          className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl mb-8 w-fit"
          role="tablist"
          aria-label="Farrier section"
        >
          <button
            role="tab"
            aria-selected={activeTab === 'horses'}
            onClick={() => setActiveTab('horses')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'horses'
                ? 'bg-white/10 text-white/90 shadow-sm'
                : 'text-white/40 hover:text-white/70'
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
                ? 'bg-white/10 text-white/90 shadow-sm'
                : 'text-white/40 hover:text-white/70'
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
        <div className="mt-10 p-5 rounded-xl bg-white/3 border border-white/8 text-sm text-white/40">
          <h3 className="font-semibold text-white/60 mb-2">About the Farrier</h3>
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
