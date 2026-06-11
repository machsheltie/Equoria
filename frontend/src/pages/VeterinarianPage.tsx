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
 * Cards share ItemCard / HorseCard / CardGrid; tabs use CanonicalTabs
 * (DECISIONS.md §6, Equoria-o5hub.11).
 *
 * Design-system migration (Equoria-o5hub, world-services family): PageHero
 * retained (genuine location artwork), PageContainer variants replace local
 * max-w wrappers, Surface replaces local glass recipes, canonical async
 * states (SectionLoading / ErrorState / EmptyState), Currency for prices,
 * Button for command actions.
 *
 * Data wired to real API hooks:
 *   useHorses()             → /api/horses
 *   useVetServices()        → /api/vet/services
 *   useBookVetAppointment() → POST /api/vet/book-appointment
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Heart, Activity, Clock, CheckCircle, Leaf } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { PageContainer } from '@/components/layout/PageContainer';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/button';
import Currency from '@/components/ui/Currency';
import { CardGrid } from '@/components/ui/CardGrid';
import { ItemCard } from '@/components/ui/ItemCard';
import { CanonicalTabs } from '@/components/ui/game';
import { SectionLoading, ErrorState } from '@/components/ui/state';
import EmptyState from '@/components/ui/EmptyState';
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
  const navigate = useNavigate();
  const { data: horses, isLoading, isError, refetch } = useHorses();

  if (isLoading) {
    return (
      <div data-testid="horses-health-tab">
        <SectionLoading label="Loading your horses" minHeight="256px" />
      </div>
    );
  }

  if (isError) {
    return (
      <div data-testid="horses-health-tab">
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
      <div data-testid="horses-health-tab">
        <EmptyState
          variant="first-use"
          icon={<Heart className="w-8 h-8" aria-hidden="true" />}
          title="No Horses Registered"
          description="Visit your stable to bring horses in for their first health check. Regular vetting keeps your horses at peak performance."
          primaryAction={{ label: 'Go to Stable', onClick: () => navigate('/stable') }}
        />
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
        <Surface
          variant="panel"
          className="border-[var(--gold-dim)]"
          data-testid="vet-booking-panel"
        >
          <p className="text-sm text-[var(--text-secondary)] mb-3">
            Booking for{' '}
            <span className="font-semibold text-[var(--text-primary)]">{selectedHorse.name}</span>:
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
                  <Button
                    key={service.id}
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isBooking}
                    pending={isThisLoading}
                    onClick={() => onBook(selectedHorse.id, service.id)}
                    className={`w-full justify-between ${
                      isThisBooked
                        ? 'bg-[var(--role-success-bg)] border-[var(--role-success-border)] text-[var(--role-success-text)]'
                        : ''
                    }`}
                    data-testid={`book-btn-${selectedHorse.id}-${service.id}`}
                    data-onboarding-target="vet-book-button"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {isThisBooked && (
                        <CheckCircle
                          className="w-3.5 h-3.5 text-[var(--role-success-text)] shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      <span className="truncate">{service.name}</span>
                    </span>
                    <Currency amount={service.cost} className="shrink-0" />
                  </Button>
                );
              })}
            </div>
          )}
        </Surface>
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
  const { data: services, isLoading, isError, refetch } = useVetServices();

  if (isLoading) {
    return (
      <div data-testid="vet-services-tab">
        <SectionLoading label="Loading services" minHeight="256px" />
      </div>
    );
  }

  if (isError || !services) {
    return (
      <div data-testid="vet-services-tab">
        <ErrorState
          title="Unable to Load Services"
          message="Unable to load services. Please try again later."
          retry={{ label: 'Try Again', onClick: () => refetch() }}
        />
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div data-testid="vet-services-tab">
        <EmptyState
          variant="unavailable"
          icon={<Activity className="w-8 h-8" aria-hidden="true" />}
          title="No Services Available"
          description="No services are available at this time. Check back later."
        />
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
            price={<Currency amount={service.cost} />}
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled
                className="w-full"
                title="Select a horse from My Horses to book"
              >
                Select a Horse to Book
              </Button>
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
          <span className="text-[var(--text-primary)]">Vet Clinic</span>
        </nav>
      </PageHero>

      {/* Banner image in glass card */}
      <PageContainer variant="content" padded={false} className="pt-1 pb-4">
        <Surface variant="panel">
          <img
            src="/images/veterinarian.webp"
            alt="Vet Clinic — a professional veterinarian providing expert care and health assessments for horses"
            className="w-full h-auto rounded-[var(--radius-md)]"
          />
        </Surface>
      </PageContainer>

      <PageContainer variant="wide" padded={false} className="pb-8">
        <CanonicalTabs
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
        <Surface variant="panel" as="aside" className="mt-10 text-sm text-[var(--text-muted)]">
          <h3 className="font-semibold text-[var(--text-primary)] mb-2">About the Vet Clinic</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Regular check-ups prevent undetected health decline</li>
            <li>Injured horses cannot train or compete until treated</li>
            <li>Genetics analysis reveals hidden bloodline traits for breeding decisions</li>
            <li>Vetting certificates are required for prestigious competitions</li>
            <li>Health degrades over time without consistent care and attention</li>
          </ul>
        </Surface>
      </PageContainer>
    </div>
  );
};

export default VeterinarianPage;
