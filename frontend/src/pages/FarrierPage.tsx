/**
 * FarrierPage — World > Farrier Location (Epic 10 — Story 10-2;
 * UI consistency 2026-05-05, Equoria-hfqe).
 *
 * The Farrier location in the World hub. Two modes:
 * - My Horses: Hoof status overview per horse, select a horse for booking
 * - Services: Available farrier procedures; book via two-step (horse → service)
 *
 * Cards share ItemCard + HorseCard + CardGrid; tabs use CanonicalTabs
 * (DECISIONS.md §6) in controlled mode so cross-tab buttons can switch
 * programmatically.
 *
 * Design-system migration (Equoria-o5hub, world-services family): PageHero
 * retained (genuine location artwork), PageContainer variants replace local
 * max-w wrappers, Surface replaces local glass recipes, canonical async
 * states (SectionLoading / ErrorState / EmptyState), Currency for prices,
 * Button for command actions.
 *
 * Data sources:
 *   - useFarrierServices() → real service catalog from /api/farrier/services
 *   - useHorses()          → user's horses from /api/horses
 *   - useBookFarrierService() → POST /api/farrier/book-service
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Heart, Wrench, Clock, CheckCircle, Leaf } from 'lucide-react';
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
  const navigate = useNavigate();
  const { data: horses, isLoading, isError, refetch } = useHorses();

  if (isLoading) {
    return (
      <div data-testid="horses-hoof-tab">
        <SectionLoading label="Loading your horses" minHeight="256px" />
      </div>
    );
  }

  if (isError) {
    return (
      <div data-testid="horses-hoof-tab">
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
      <div data-testid="horses-hoof-tab">
        <EmptyState
          variant="first-use"
          icon={<Wrench className="w-8 h-8" aria-hidden="true" />}
          title="No Horses Registered"
          description="Visit your stable to bring horses in for their first hoof care appointment. Regular farrier visits keep your horses performing at their best."
          primaryAction={{ label: 'Go to Stable', onClick: () => navigate('/stable') }}
        />
      </div>
    );
  }

  return (
    <div data-testid="horses-hoof-tab" className="space-y-4">
      {selectedHorseId !== null && (
        <div className="p-4 rounded-[var(--radius-md)] bg-[var(--role-success-bg)] border border-[var(--role-success-border)] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[var(--role-success-text)] text-sm font-medium">
            <CheckCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            Horse selected — choose a service to book
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onNavigateToServices}
            className="flex-shrink-0"
          >
            View Services
          </Button>
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
  const { data: services, isLoading, isError, refetch } = useFarrierServices();

  if (isLoading) {
    return (
      <div data-testid="farrier-services-tab">
        <SectionLoading label="Loading services" minHeight="256px" />
      </div>
    );
  }

  if (isError) {
    return (
      <div data-testid="farrier-services-tab">
        <ErrorState
          title="Unable to Load Services"
          message="Unable to load services. Please try again later."
          retry={{ label: 'Try Again', onClick: () => refetch() }}
        />
      </div>
    );
  }

  if (!services || services.length === 0) {
    return (
      <div data-testid="farrier-services-tab">
        <EmptyState
          variant="unavailable"
          icon={<Wrench className="w-8 h-8" aria-hidden="true" />}
          title="No Services Available"
          description="The farrier has no services listed at the moment. Check back later."
        />
      </div>
    );
  }

  const canBook = selectedHorseId !== null;

  return (
    <div data-testid="farrier-services-tab" className="space-y-4">
      {!canBook && (
        <Surface
          variant="subtle"
          className="p-4 flex items-center justify-between gap-4"
          data-testid="farrier-select-horse-banner"
        >
          <p className="text-sm text-[var(--text-muted)]">
            Select a horse from the My Horses tab to unlock booking.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onNavigateToHorses}
            className="flex-shrink-0"
          >
            My Horses
          </Button>
        </Surface>
      )}

      {canBook && selectedHorseName && (
        <div className="p-4 rounded-[var(--radius-md)] bg-[var(--role-success-bg)] border border-[var(--role-success-border)] flex items-center gap-2 text-[var(--role-success-text)] text-sm font-medium">
          <CheckCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          Booking for: {selectedHorseName}
        </div>
      )}

      <CardGrid aria-label="Farrier services">
        {services.map((service) => {
          const thisIsBooking = isBooking && bookingServiceId === service.id;

          const action = (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!canBook || isBooking}
              pending={thisIsBooking}
              onClick={() => canBook && onBook(service)}
              className="w-full"
              title={canBook ? `Book ${service.name}` : 'Select a horse from My Horses to book'}
              data-onboarding-target="farrier-book-button"
            >
              {canBook ? (
                <span className="flex items-center gap-1.5">
                  Book — <Currency amount={service.cost} />
                </span>
              ) : (
                'Select a Horse to Book'
              )}
            </Button>
          );

          const media = service.icon ? (
            <span
              className="text-3xl w-20 h-20 flex items-center justify-center"
              aria-hidden="true"
            >
              {service.icon}
            </span>
          ) : (
            <div className="w-20 h-20 rounded-[var(--radius-md)] bg-[var(--glass-surface-subtle-bg)] flex items-center justify-center text-[var(--gold-400)]">
              <Wrench className="w-8 h-8" aria-hidden="true" />
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
              price={<Currency amount={service.cost} />}
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
          const msg = `${result.data.service.name} booked for ${result.data.horse.name}. Remaining balance: ${result.data.remainingMoney.toLocaleString('en-US')} coins.`;
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
        {bookingSuccess && (
          <div className="mb-6 p-4 rounded-[var(--radius-md)] bg-[var(--role-success-bg)] border border-[var(--role-success-border)] flex items-center gap-2 text-[var(--role-success-text)] text-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            {bookingSuccess}
          </div>
        )}

        {bookMutation.isError && (
          <div
            className="mb-6 p-4 rounded-[var(--radius-md)] bg-[var(--role-danger-bg)] border border-[var(--role-danger-border)] text-[var(--role-danger-text)] text-sm"
            role="alert"
          >
            Booking failed:{' '}
            {bookMutation.error?.message ?? 'An unexpected error occurred. Please try again.'}
          </div>
        )}

        <CanonicalTabs
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
        <Surface variant="panel" as="aside" className="mt-10 text-sm text-[var(--text-muted)]">
          <h3 className="font-semibold text-[var(--text-primary)] mb-2">About the Farrier</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Horses need hoof trims every 6–8 weeks to maintain balance and soundness</li>
            <li>Horses with neglected hooves suffer movement penalties in competition</li>
            <li>Corrective shoeing gradually improves gait quality over multiple visits</li>
            <li>Damaged shoes must be removed before a horse can enter competitions</li>
            <li>Regular farrier care increases horse longevity and reduces injury risk</li>
          </ul>
        </Surface>
      </PageContainer>
    </div>
  );
};

export default FarrierPage;
