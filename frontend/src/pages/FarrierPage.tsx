/**
 * FarrierPage — World > Farrier (owner ruling 2026-10-26, q78, Equoria-zz14s;
 * the weekly action is Equoria-zmqzf).
 *
 * No My Horses format. The farrier lists his shoe types as data (Basic Shoes for
 * now; more later), each a centred box with a dropdown of the player's horses
 * and one priced button. A horse shod within the week is greyed out; a retired
 * horse (21+) is not listed. The action is the weekly "Shoe horse": once a week,
 * the horse gains +1 in one random stat.
 *
 * Old contract: a horse-card grid with one "Shoe horse — 50 coins" button.
 *
 * PageHero retained (genuine location artwork).
 *
 *   useFarrierServices() -> GET  /api/v1/farrier/shoe-types
 *   useFarrierHorses()   -> GET  /api/v1/farrier/horses
 *   useShoeHorse()       -> POST /api/v1/farrier/shoe-horse
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Wrench, Leaf } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { PageContainer } from '@/components/layout/PageContainer';
import { Surface } from '@/components/ui/Surface';
import { SectionLoading, ErrorState } from '@/components/ui/state';
import EmptyState from '@/components/ui/EmptyState';
import { ServiceHorseBox } from '@/components/world/ServiceHorseBox';
import { actionMessageFor } from '@/lib/http/actionMessage';
import { userMessageFor } from '@/lib/http/userMessage';
import { useFarrierServices, useFarrierHorses, useShoeHorse } from '@/hooks/api/useFarrier';
import type { FarrierService } from '@/hooks/api/useFarrier';

const titleCase = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

interface Outcome {
  serviceId: string;
  confirmation?: string;
  failure?: string;
}

const FarrierPage: React.FC = () => {
  const navigate = useNavigate();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const services = useFarrierServices();
  const horses = useFarrierHorses();
  const shoe = useShoeHorse();
  const shoeingServiceId = shoe.isPending ? shoe.variables?.serviceId : undefined;

  const handleShoe = (service: FarrierService, horseId: number) => {
    setOutcome(null);
    shoe.mutate(
      { horseId, serviceId: service.id },
      {
        onSuccess: (result) => {
          setOutcome({
            serviceId: service.id,
            confirmation: `${result.horse.name} has been shod and gained +1 ${titleCase(result.statGained)}. Remaining balance: ${result.remainingMoney.toLocaleString('en-US')} coins.`,
          });
        },
        onError: (error) => {
          setOutcome({
            serviceId: service.id,
            failure: `Shoeing failed: ${actionMessageFor(error, {
              400: "The farrier couldn't shoe that horse. Check your balance.",
              404: "That horse couldn't be found. Reload and try again.",
              409: 'That horse has already been shod this week.',
            })}`,
          });
        },
      }
    );
  };

  const renderServices = () => {
    if (services.isLoading || horses.isLoading) {
      return (
        <div data-testid="farrier-services">
          <SectionLoading label="Loading the forge" minHeight="256px" />
        </div>
      );
    }
    if (services.isError) {
      return (
        <div data-testid="farrier-services">
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
        <div data-testid="farrier-services">
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
        <div data-testid="farrier-services">
          <EmptyState
            variant="unavailable"
            icon={<Wrench className="w-8 h-8" aria-hidden="true" />}
            title="The forge is cold"
            description="The farrier is not taking work right now. Check back soon."
          />
        </div>
      );
    }

    const farrierHorses = horses.data ?? [];
    if (farrierHorses.length === 0) {
      return (
        <div data-testid="farrier-services">
          <EmptyState
            variant="first-use"
            icon={<Wrench className="w-8 h-8" aria-hidden="true" />}
            title="No horses to shoe"
            description="Bring a horse into your stable and the farrier can shoe it."
            primaryAction={{ label: 'Go to Stable', onClick: () => navigate('/stable') }}
          />
        </div>
      );
    }

    return (
      <div
        data-testid="farrier-services"
        className="flex flex-col md:flex-row md:justify-center md:items-start gap-8"
      >
        {services.data.map((service) => {
          const mine = outcome?.serviceId === service.id ? outcome : null;
          return (
            <ServiceHorseBox
              key={service.id}
              serviceId={service.id}
              title={service.name}
              description={service.description}
              cost={service.cost}
              actionLabel={service.actionLabel}
              horses={farrierHorses.map((horse) => ({
                id: horse.id,
                name: horse.name,
                unavailableReason: horse.shod ? 'already shod this week' : undefined,
              }))}
              pending={shoeingServiceId === service.id}
              onConfirm={(horseId) => handleShoe(service, horseId)}
              confirmation={mine?.confirmation}
              failure={mine?.failure}
              onboardingTarget="farrier-book-button"
            />
          );
        })}
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
        {renderServices()}

        <Surface variant="panel" as="aside" className="mt-10 text-sm text-[var(--text-muted)]">
          <h3 className="font-semibold text-[var(--text-primary)] mb-2">About the Farrier</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Each horse can be shod once a week</li>
            <li>A shod horse gains +1 in one stat</li>
            <li>Retired horses are no longer shod</li>
          </ul>
        </Surface>
      </PageContainer>
    </div>
  );
};

export default FarrierPage;
