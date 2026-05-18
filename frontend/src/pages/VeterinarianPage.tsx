/**
 * VeterinarianPage — World > Vet Clinic Location (Epic 10 — Story 10-1;
 * UI consistency 2026-05-05, Equoria-mlao).
 *
 * The Vet Clinic location in the World hub. Two tabs:
 * - My Horses: Lists the user's horses with health status. Selecting a horse
 *   reveals a service booking panel BELOW the grid (was inline-expand which
 *   broke card consistency).
 * - Services: Shows available vet procedures fetched from /api/vet/services.
 *
 * Cards now share ItemCard / HorseCard / CardGrid so this page no longer
 * renders giant 2-col cards on desktop. Tabs use CelestialTabs (canonical).
 *
 * Data wired to real API hooks:
 *   useHorses()             → /api/horses
 *   useVetServices()        → /api/vet/services
 *   useBookVetAppointment() → POST /api/vet/book-appointment
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Heart, Activity, Clock, CheckCircle, Loader2, Leaf, AlertCircle } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { CardGrid } from '@/components/ui/CardGrid';
import { ItemCard } from '@/components/ui/ItemCard';
import { CelestialTabs } from '@/components/ui/game';
import { HorseCard } from '@/components/horse/HorseCard';
import { useHorses } from '@/hooks/api/useHorses';
import { useVetServices, useBookVetAppointment } from '@/hooks/api/useVet';
import type { VetService } from '@/hooks/api/useVet';
import type { HorseSummary } from '@/lib/api-client';

type VetTab = 'horses' | 'services';

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

  const selectedHorse = horses.find((h: HorseSummary) => h.id === selectedHorseId) ?? null;

  return (
    <div data-testid="horses-health-tab" className="space-y-6">
      <CardGrid aria-label="Your horses">
        {horses.map((horse: HorseSummary) => (
          <HorseCard
            key={horse.id}
            horse={horse}
            selected={selectedHorseId === horse.id}
            onClick={() => onSelectHorse(horse.id)}
            data-testid={`horse-card-${horse.id}`}
          />
        ))}
      </CardGrid>

      {/* Booking panel — appears below the grid when a horse is selected. Was
          previously expanded inline inside each card; pulled out so cards
          stay the same height. */}
      {selectedHorse ? (
        <div
          className="rounded-xl border border-[var(--gold-dim)] bg-[var(--glass-bg)] backdrop-blur-sm p-5"
          data-testid="vet-booking-panel"
        >
          <p className="text-sm text-[var(--text-secondary)] mb-3">
            Booking for{' '}
            <span className="font-semibold text-[var(--cream)]">{selectedHorse.name}</span>:
          </p>
          {services.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">Loading services…</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {services.map((service: VetService) => {
                const isThisBooked =
                  confirmedHorseId === selectedHorse.id && confirmedServiceId === service.id;
                const isThisLoading =
                  isBooking &&
                  bookingHorseId === selectedHorse.id &&
                  bookingServiceId === service.id;

                return (
                  <button
                    key={service.id}
                    type="button"
                    disabled={isBooking}
                    onClick={() => onBook(selectedHorse.id, service.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm border transition-all ${
                      isThisBooked
                        ? 'bg-[var(--status-success)]/20 border-[var(--status-success)]/40 text-[var(--status-success)]'
                        : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-secondary)] hover:bg-[var(--glass-hover)]/20 hover:text-[var(--cream)] disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                    data-testid={`book-btn-${selectedHorse.id}-${service.id}`}
                    data-onboarding-target="vet-book-button"
                  >
                    <span className="flex items-center gap-2">
                      {isThisBooked && (
                        <CheckCircle className="w-3.5 h-3.5 text-[var(--status-success)] shrink-0" />
                      )}
                      {isThisLoading && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
                      <span className="truncate">{service.name}</span>
                    </span>
                    <span className="text-[var(--gold-400)] font-semibold shrink-0">
                      ${service.cost.toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-[var(--text-muted)] text-center">
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
    <div data-testid="vet-services-tab">
      <CardGrid aria-label="Vet services">
        {services.map((service: VetService) => (
          <ItemCard
            key={service.id}
            data-testid={`vet-service-${service.id}`}
            title={service.name}
            subtitle={
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {service.duration}
              </span>
            }
            description={service.description}
            price={`$${service.cost.toLocaleString()}`}
            action={
              <button
                type="button"
                disabled
                className="w-full py-2 text-sm font-medium rounded-lg bg-[var(--status-success)]/10 border border-[var(--status-success)]/20 text-[var(--status-success)]/60 cursor-not-allowed"
                title="Select a horse from My Horses to book"
              >
                Select a Horse to Book
              </button>
            }
          />
        ))}
      </CardGrid>
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
    setSelectedHorseId((prev: number | null) => (prev === id ? null : id));
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
          const service = services.find((s: VetService) => s.id === serviceId);
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
        <CelestialTabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as VetTab)}
          tabs={[
            {
              value: 'horses',
              label: 'My Horses',
              icon: <Heart className="w-4 h-4" />,
              content: (
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
              ),
            },
            {
              value: 'services',
              label: 'Services',
              icon: <Activity className="w-4 h-4" />,
              content: <ServicesTab />,
            },
          ]}
        />

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
