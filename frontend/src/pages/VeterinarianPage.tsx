/**
 * VeterinarianPage — World > Vet Clinic Location (Epic 10 — Story 10-1)
 *
 * The Vet Clinic location in the World hub. Two tabs:
 * - My Horses: Lists the user's horses with health status and a "Book" button per horse.
 *   Selecting a horse then a service triggers useBookVetAppointment.
 * - Services: Shows available vet procedures fetched from /api/vet/services.
 *
 * Data is wired to real API hooks:
 *   useHorses()            → /api/horses
 *   useVetServices()       → /api/vet/services
 *   useBookVetAppointment()→ POST /api/vet/book-appointment
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Heart, Activity, Clock, CheckCircle, Loader2, Leaf, AlertCircle } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { useHorses } from '@/hooks/api/useHorses';
import { useVetServices, useBookVetAppointment } from '@/hooks/api/useVet';
import type { VetService } from '@/hooks/api/useVet';
import type { HorseSummary } from '@/lib/api-client';
import { getBreedName } from '@/lib/utils';

type VetTab = 'horses' | 'services';

// ─── Health status badge ──────────────────────────────────────────────────────

function healthBadgeClasses(status: string): string {
  const s = status.toLowerCase();
  if (s === 'excellent' || s === 'good')
    return 'bg-[var(--status-success)]/20 text-[var(--status-success)] border-[var(--status-success)]/30';
  if (s === 'fair') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  if (s === 'poor' || s === 'injured')
    return 'bg-[var(--status-danger)]/20 text-[var(--status-danger)] border-[var(--status-danger)]/30';
  return 'bg-[var(--glass-bg)] text-[var(--text-muted)] border-[var(--glass-border)]';
}

// ─── My Horses Tab ────────────────────────────────────────────────────────────

interface HorsesHealthTabProps {
  selectedHorseId: number | null;
  onSelectHorse: (_id: number) => void;
  onBook: (_horseId: number, _serviceId: string) => void;
  isBooking: boolean;
  bookingServiceId: string | null;
  bookingHorseId: number | null;
  confirmedHorseId: number | null;
  confirmedServiceId: string | null;
  services: VetService[];
}

const HorsesHealthTab: React.FC<HorsesHealthTabProps> = ({
  selectedHorseId,
  onSelectHorse,
  onBook,
  isBooking,
  bookingServiceId,
  bookingHorseId,
  confirmedHorseId,
  confirmedServiceId,
  services,
}) => {
  const { data: horses, isLoading, isError } = useHorses();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64" data-testid="horses-health-tab">
        <Loader2 className="w-8 h-8 text-[var(--gold-400)] animate-spin" />
        <span className="ml-3 text-[var(--text-muted)] text-sm">Loading your horses…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-64 gap-3 text-center"
        data-testid="horses-health-tab"
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
        data-testid="horses-health-tab"
      >
        <Heart className="w-12 h-12 text-[var(--gold-400)]/30 mb-4" />
        <h2 className="text-lg font-bold text-[var(--text-secondary)] mb-2">
          No Horses Registered
        </h2>
        <p className="text-sm text-[var(--text-muted)] max-w-sm mb-6">
          Visit your stable to bring horses in for their first health check. Regular vetting keeps
          your horses at peak performance.
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
    <div data-testid="horses-health-tab">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {horses.map((horse: HorseSummary) => {
          const isSelected = selectedHorseId === horse.id;
          return (
            <div
              key={horse.id}
              className={`backdrop-blur-sm border rounded-xl p-5 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[var(--status-success)]/10 border-[var(--status-success)]/50'
                  : 'bg-[var(--glass-bg)] border-[var(--glass-border)] hover:border-[var(--glass-hover)]'
              }`}
              onClick={() => onSelectHorse(horse.id)}
              data-testid={`horse-card-${horse.id}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-[var(--cream)]">{horse.name}</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {getBreedName(horse.breed)} &middot; Age {horse.age}
                  </p>
                </div>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border ${healthBadgeClasses(horse.healthStatus)}`}
                >
                  {horse.healthStatus}
                </span>
              </div>

              {isSelected && services.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-[var(--glass-border)] pt-3">
                  <p className="text-xs text-[var(--text-muted)] mb-2">Select a service to book:</p>
                  {services.map((service: VetService) => {
                    const isThisBooked =
                      confirmedHorseId === horse.id && confirmedServiceId === service.id;
                    const isThisLoading =
                      isBooking && bookingHorseId === horse.id && bookingServiceId === service.id;

                    return (
                      <button
                        key={service.id}
                        type="button"
                        disabled={isBooking}
                        onClick={(e) => {
                          e.stopPropagation();
                          onBook(horse.id, service.id);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm border transition-all ${
                          isThisBooked
                            ? 'bg-[var(--status-success)]/20 border-[var(--status-success)]/40 text-[var(--status-success)]'
                            : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-secondary)] hover:bg-[var(--glass-hover)]/20 hover:text-[var(--cream)] disabled:opacity-50 disabled:cursor-not-allowed'
                        }`}
                        data-testid={`book-btn-${horse.id}-${service.id}`}
                        data-onboarding-target="vet-book-button"
                      >
                        <span className="flex items-center gap-2">
                          {isThisBooked && (
                            <CheckCircle className="w-3.5 h-3.5 text-[var(--status-success)] shrink-0" />
                          )}
                          {isThisLoading && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                          )}
                          {service.name}
                        </span>
                        <span className="text-[var(--gold-400)] font-semibold">
                          ${service.cost.toLocaleString()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {isSelected && services.length === 0 && (
                <p className="text-xs text-[var(--text-muted)] mt-3 border-t border-[var(--glass-border)] pt-3">
                  Loading services…
                </p>
              )}
            </div>
          );
        })}
      </div>

      {selectedHorseId === null && (
        <p className="text-sm text-[var(--text-muted)] text-center mt-4">
          Click a horse card to select it and choose a service.
        </p>
      )}
    </div>
  );
};

// ─── Services Tab ─────────────────────────────────────────────────────────────

const ServicesTab: React.FC = () => {
  const { data: services, isLoading, isError } = useVetServices();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64" data-testid="vet-services-tab">
        <Loader2 className="w-8 h-8 text-[var(--gold-400)] animate-spin" />
        <span className="ml-3 text-[var(--text-muted)] text-sm">Loading services…</span>
      </div>
    );
  }

  if (isError || !services) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-64 gap-3 text-center"
        data-testid="vet-services-tab"
      >
        <AlertCircle className="w-10 h-10 text-[var(--status-danger)]/60" />
        <p className="text-[var(--text-secondary)] text-sm">
          Unable to load services. Please try again later.
        </p>
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-64 p-8 text-center"
        data-testid="vet-services-tab"
      >
        <Activity className="w-12 h-12 text-[var(--gold-400)]/30 mb-4" />
        <h2 className="text-lg font-bold text-[var(--text-secondary)] mb-2">
          No Services Available
        </h2>
        <p className="text-sm text-[var(--text-muted)] max-w-sm">
          No services are available at this time. Check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="vet-services-tab">
      {services.map((service: VetService) => (
        <div
          key={service.id}
          className="bg-[var(--glass-bg)] backdrop-blur-sm border border-[var(--glass-border)] rounded-xl p-5 hover:border-[var(--glass-hover)] transition-all"
          data-testid={`vet-service-${service.id}`}
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-bold text-[var(--cream)]">{service.name}</h3>
              <span className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                {service.duration}
              </span>
            </div>
            <p className="text-lg font-bold text-[var(--gold-400)]">
              ${service.cost.toLocaleString()}
            </p>
          </div>
          <p className="text-sm text-[var(--text-muted)] mb-4">{service.description}</p>
          <button
            type="button"
            disabled
            className="w-full py-2 text-sm font-medium rounded-lg bg-[var(--status-success)]/10 border border-[var(--status-success)]/20 text-[var(--status-success)]/60 cursor-not-allowed"
            title="Select a horse from My Horses to book"
          >
            Select a Horse to Book
          </button>
        </div>
      ))}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const VeterinarianPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<VetTab>('horses');
  const [selectedHorseId, setSelectedHorseId] = useState<number | null>(null);
  const [confirmedHorseId, setConfirmedHorseId] = useState<number | null>(null);
  const [confirmedServiceId, setConfirmedServiceId] = useState<string | null>(null);
  const [bookingServiceId, setBookingServiceId] = useState<string | null>(null);

  const { data: services = [] } = useVetServices();
  const {
    mutate: bookAppointment,
    isPending: isBooking,
    variables: bookingVars,
  } = useBookVetAppointment();

  const handleSelectHorse = (id: number) => {
    setSelectedHorseId((prev) => (prev === id ? null : id));
  };

  const handleBook = (horseId: number, serviceId: string) => {
    setBookingServiceId(serviceId);
    bookAppointment(
      { horseId, serviceId },
      {
        onSuccess: () => {
          setConfirmedHorseId(horseId);
          setConfirmedServiceId(serviceId);
          setBookingServiceId(null);
          const service = services.find((s) => s.id === serviceId);
          toast.success(`Appointment booked${service ? ` — ${service.name}` : ''}!`);
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
        title="Vet Clinic"
        subtitle="Health checks, treatments, and genetics analysis for your horses"
        mood="nature"
        icon={<Leaf className="w-7 h-7 text-[var(--gold-400)]" />}
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[var(--cream)]/60">
          <Link to="/world" className="hover:text-[var(--cream)] transition-colors">
            World
          </Link>
          <span>/</span>
          <span className="text-[var(--cream)]">Vet Clinic</span>
        </div>
      </PageHero>

      {/* Banner image in glass card */}
      <div className="max-w-[52rem] mx-auto px-4 sm:px-6 lg:px-8 pt-1 pb-4">
        <div className="p-5 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-sm border border-[var(--glass-border)] shadow-lg shadow-black/20">
          <img
            src="/images/veterinarian.webp"
            alt="Vet Clinic — a professional veterinarian providing expert care and health assessments for horses"
            className="w-full h-auto rounded-xl"
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {/* My Horses / Services Tabs */}
        <div
          className="flex gap-1 p-1 bg-[var(--glass-bg)] backdrop-blur-sm border border-[var(--glass-border)] rounded-xl mb-8 w-fit"
          role="tablist"
          aria-label="Vet Clinic section"
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
            <Activity className="w-4 h-4" />
            Services
          </button>
        </div>

        {/* Tab Content */}
        <div role="tabpanel">
          {activeTab === 'horses' ? (
            <HorsesHealthTab
              selectedHorseId={selectedHorseId}
              onSelectHorse={handleSelectHorse}
              onBook={handleBook}
              isBooking={isBooking}
              bookingServiceId={bookingServiceId}
              bookingHorseId={bookingVars?.horseId ?? null}
              confirmedHorseId={confirmedHorseId}
              confirmedServiceId={confirmedServiceId}
              services={services}
            />
          ) : (
            <ServicesTab />
          )}
        </div>

        {/* Info Panel */}
        <div className="mt-10 p-5 rounded-xl glass-panel text-sm text-[var(--text-muted)]">
          <h3 className="font-semibold text-[var(--cream)] mb-2">About the Vet Clinic</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Regular check-ups prevent undetected health decline</li>
            <li>Injured horses cannot train or compete until treated</li>
            <li>Genetics analysis reveals hidden bloodline traits for breeding decisions</li>
            <li>Vetting certificates are required for prestigious competitions</li>
            <li>Health degrades over time without consistent care and attention</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default VeterinarianPage;
