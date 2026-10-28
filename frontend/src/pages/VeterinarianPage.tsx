/**
 * VeterinarianPage — World > Vet Clinic (owner ruling 2026-10-26, q78,
 * Equoria-7dmzp).
 *
 * No My Horses tab. The vet sells exactly two services, each a centred box with
 * a dropdown of the player's horses and one priced button:
 *   - General Health Check ("Vet Horse"): records today as the horse's vet date,
 *     which drives its health.
 *   - Genetic Testing ("Run Panel"): marks the horse colour-genetics-tested.
 * A horse already vetted (vet health still Excellent) or already tested is greyed
 * out; a horse too old (21+, retired) is not listed. The server decides both.
 *
 * Old contract: My Horses / Services tabs and four bookable services.
 *
 * PageHero retained (genuine location artwork).
 *
 * Data wired to real API hooks:
 *   useVetServices()        -> GET  /api/v1/vet/services
 *   useVetHorses()          -> GET  /api/v1/vet/horses
 *   useBookVetAppointment() -> POST /api/v1/vet/book-appointment
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Activity, Leaf } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { PageContainer } from '@/components/layout/PageContainer';
import { Surface } from '@/components/ui/Surface';
import { SectionLoading, ErrorState } from '@/components/ui/state';
import EmptyState from '@/components/ui/EmptyState';
import { ServiceHorseBox } from '@/components/world/ServiceHorseBox';
import type { ServiceHorseOption } from '@/components/world/ServiceHorseBox';
import { actionMessageFor } from '@/lib/http/actionMessage';
import { userMessageFor } from '@/lib/http/userMessage';
import { useVetServices, useVetHorses, useBookVetAppointment } from '@/hooks/api/useVet';
import type { VetAppointmentResult, VetHorse, VetService } from '@/hooks/api/useVet';

/** Why a horse is greyed out for a service, or undefined when it can take it. */
function unavailableReason(service: VetService, horse: VetHorse): string | undefined {
  if (service.id === 'genetic-testing') {
    return horse.geneticsTested ? 'already tested' : undefined;
  }
  return horse.vetted ? 'already vetted' : undefined;
}

/** The hunger line for a vetted horse that is still unwell because it is hungry. */
function hungerLine(name: string, horse: VetAppointmentResult['horse']): string | undefined {
  const { feedHealth, displayedHealth } = horse;
  if (!feedHealth || !displayedHealth || displayedHealth === 'Excellent') {
    return undefined;
  }
  return feedHealth === 'Excellent'
    ? undefined
    : `${name} is hungry. Feed it to bring its health up.`;
}

interface Outcome {
  serviceId: string;
  confirmation?: string;
  failure?: string;
}

const VeterinarianPage: React.FC = () => {
  const navigate = useNavigate();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const services = useVetServices();
  const horses = useVetHorses();
  const book = useBookVetAppointment();
  const bookingServiceId = book.isPending ? book.variables?.serviceId : undefined;

  const handleBook = (service: VetService, horseId: number) => {
    setOutcome(null);
    book.mutate(
      { horseId, serviceId: service.id },
      {
        onSuccess: (result) => {
          const name = result.horse.name;
          const done =
            service.id === 'genetic-testing'
              ? `${name}'s color panel is done.`
              : `${name} is in Excellent health.`;
          const hunger =
            service.id === 'genetic-testing' ? undefined : hungerLine(name, result.horse);
          setOutcome({
            serviceId: service.id,
            confirmation: hunger ? `${done} ${hunger}` : done,
          });
        },
        onError: (error) => {
          setOutcome({
            serviceId: service.id,
            failure: actionMessageFor(error, {
              400: "The vet couldn't take that booking. Check your balance.",
              404: "That horse couldn't be found. Reload and try again.",
              409:
                service.id === 'genetic-testing'
                  ? 'That horse has already been tested.'
                  : 'That horse has already been vetted.',
            }),
          });
        },
      }
    );
  };

  const renderServices = () => {
    if (services.isLoading || horses.isLoading) {
      return (
        <div data-testid="vet-services">
          <SectionLoading label="Loading the clinic" minHeight="256px" />
        </div>
      );
    }
    if (services.isError) {
      return (
        <div data-testid="vet-services">
          <ErrorState
            title="Unable to Load Services"
            message={userMessageFor(services.error).message}
            retry={{ label: 'Try Again', onClick: () => services.refetch() }}
          />
        </div>
      );
    }
    if (horses.isError) {
      return (
        <div data-testid="vet-services">
          <ErrorState
            title="Unable to Load Horses"
            message={userMessageFor(horses.error).message}
            retry={{ label: 'Try Again', onClick: () => horses.refetch() }}
          />
        </div>
      );
    }
    if (!services.data || services.data.length === 0) {
      return (
        <div data-testid="vet-services">
          <EmptyState
            variant="unavailable"
            icon={<Activity className="w-8 h-8" aria-hidden="true" />}
            title="The clinic is closed"
            description="The vet is not seeing horses right now. Check back soon."
          />
        </div>
      );
    }

    const vetHorses = horses.data ?? [];
    if (vetHorses.length === 0) {
      return (
        <div data-testid="vet-services">
          <EmptyState
            variant="first-use"
            icon={<Activity className="w-8 h-8" aria-hidden="true" />}
            title="No horses to see"
            description="Bring a horse into your stable and the vet can look at it."
            primaryAction={{ label: 'Go to Stable', onClick: () => navigate('/stable') }}
          />
        </div>
      );
    }

    return (
      <div
        data-testid="vet-services"
        className="flex flex-col md:flex-row md:justify-center md:items-start gap-8"
      >
        {services.data.map((service) => {
          const options: ServiceHorseOption[] = vetHorses.map((horse) => ({
            id: horse.id,
            name: horse.name,
            unavailableReason: unavailableReason(service, horse),
            ...(service.id === 'health-check' && horse.healthCheckFee !== null
              ? { cost: horse.healthCheckFee, detail: horse.vetHealth }
              : {}),
          }));
          const mine = outcome?.serviceId === service.id ? outcome : null;
          return (
            <ServiceHorseBox
              key={service.id}
              serviceId={service.id}
              title={service.name}
              description={service.description}
              cost={service.cost}
              costNote={service.costNote}
              actionLabel={service.actionLabel}
              horses={options}
              pending={bookingServiceId === service.id}
              onConfirm={(horseId) => handleBook(service, horseId)}
              confirmation={mine?.confirmation}
              failure={mine?.failure}
              onboardingTarget={service.id === 'health-check' ? 'vet-book-button' : undefined}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <PageHero
        title="Vet Clinic"
        subtitle="Health checks and color genetics testing for your horses"
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
        {renderServices()}

        <Surface variant="panel" as="aside" className="mt-10 text-sm text-[var(--text-muted)]">
          <h3 className="font-semibold text-[var(--text-primary)] mb-2">About the Vet Clinic</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>A health check restores a horse to Excellent; it slips again with time</li>
            <li>The further a horse has slipped, the more the check costs</li>
            <li>A horse in poor health cannot train, breed or enter a show</li>
            <li>The genetics panel is run once per horse</li>
            <li>Retired horses are no longer seen here</li>
          </ul>
        </Surface>
      </PageContainer>
    </div>
  );
};

export default VeterinarianPage;
