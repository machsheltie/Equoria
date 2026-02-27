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
import { ArrowLeft, Heart, Activity, Clock, CheckCircle, Loader2 } from 'lucide-react';
import MainNavigation from '@/components/MainNavigation';
import { useHorses } from '@/hooks/api/useHorses';
import { useVetServices, useBookVetAppointment } from '@/hooks/api/useVet';
import type { VetService } from '@/hooks/api/useVet';
import type { HorseSummary } from '@/lib/api-client';

type VetTab = 'horses' | 'services';

// ─── Health status badge ──────────────────────────────────────────────────────

function healthBadgeClasses(status: string): string {
  const s = status.toLowerCase();
  if (s === 'excellent' || s === 'good')
    return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  if (s === 'fair') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  if (s === 'poor' || s === 'injured') return 'bg-red-500/20 text-red-400 border-red-500/30';
  return 'bg-white/10 text-white/50 border-white/10';
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
      <div
        className="flex flex-col items-center justify-center min-h-64 gap-4"
        data-testid="horses-health-tab"
      >
        <Loader2 className="w-8 h-8 text-emerald-400/60 animate-spin" />
        <p className="text-sm text-white/40">Loading your horses…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-64 gap-3"
        data-testid="horses-health-tab"
      >
        <p className="text-sm text-red-400/80">Failed to load horses. Please try again.</p>
      </div>
    );
  }

  if (!horses || horses.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-64 p-8 text-center"
        data-testid="horses-health-tab"
      >
        <Heart className="w-12 h-12 text-emerald-400/30 mb-4" />
        <h2 className="text-lg font-bold text-white/60 mb-2">No Horses Registered</h2>
        <p className="text-sm text-white/40 max-w-sm mb-6">
          Visit your stable to bring horses in for their first health check. Regular vetting keeps
          your horses at peak performance.
        </p>
        <Link
          to="/stable"
          className="px-5 py-2.5 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-600/30 transition-colors"
        >
          Go to Stable
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="horses-health-tab">
      {/* Horse list */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {horses.map((horse: HorseSummary) => {
          const isSelected = selectedHorseId === horse.id;
          return (
            <div
              key={horse.id}
              className={`bg-white/5 border rounded-xl p-5 transition-all cursor-pointer ${
                isSelected
                  ? 'border-emerald-500/50 bg-emerald-600/10'
                  : 'border-white/10 hover:border-white/20'
              }`}
              onClick={() => onSelectHorse(horse.id)}
              data-testid={`horse-card-${horse.id}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-white/90">{horse.name}</h3>
                  <p className="text-xs text-white/40 mt-0.5">
                    {horse.breed} · Age {horse.age}
                  </p>
                </div>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border ${healthBadgeClasses(horse.healthStatus)}`}
                >
                  {horse.healthStatus}
                </span>
              </div>

              {isSelected && services.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                  <p className="text-xs text-white/50 mb-2">Select a service to book:</p>
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
                            ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed'
                        }`}
                        data-testid={`book-btn-${horse.id}-${service.id}`}
                        data-onboarding-target="vet-book-button"
                      >
                        <span className="flex items-center gap-2">
                          {isThisBooked && (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          )}
                          {isThisLoading && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                          )}
                          {service.name}
                        </span>
                        <span className="text-celestial-gold font-semibold">
                          ${service.cost.toLocaleString()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {isSelected && services.length === 0 && (
                <p className="text-xs text-white/40 mt-3 border-t border-white/10 pt-3">
                  Loading services…
                </p>
              )}
            </div>
          );
        })}
      </div>

      {selectedHorseId === null && (
        <p className="text-sm text-white/40 text-center">
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
      <div
        className="flex flex-col items-center justify-center min-h-64 gap-4"
        data-testid="vet-services-tab"
      >
        <Loader2 className="w-8 h-8 text-emerald-400/60 animate-spin" />
        <p className="text-sm text-white/40">Loading services…</p>
      </div>
    );
  }

  if (isError || !services) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-64"
        data-testid="vet-services-tab"
      >
        <p className="text-sm text-red-400/80">Failed to load services. Please try again.</p>
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-64"
        data-testid="vet-services-tab"
      >
        <p className="text-sm text-white/40">No services are available at this time.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="vet-services-tab">
      {services.map((service: VetService) => (
        <div
          key={service.id}
          className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all"
          data-testid={`vet-service-${service.id}`}
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-bold text-white/90">{service.name}</h3>
              <span className="text-xs text-white/40 flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                {service.duration}
              </span>
            </div>
            <p className="text-lg font-bold text-celestial-gold">
              ${service.cost.toLocaleString()}
            </p>
          </div>
          <p className="text-sm text-white/50 mb-4">{service.description}</p>
          <button
            type="button"
            disabled
            className="w-full py-2 text-sm font-medium rounded-lg bg-emerald-600/10 border border-emerald-500/20 text-emerald-400/60 cursor-not-allowed"
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
      <MainNavigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
          <Link to="/world" className="hover:text-white/70 transition-colors">
            World
          </Link>
          <span>/</span>
          <span className="text-white/70">Vet Clinic</span>
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
            <h1 className="text-2xl font-bold text-white/90">🏥 Vet Clinic</h1>
            <p className="text-sm text-white/50 mt-0.5">
              Health checks, treatments, and genetics analysis for your horses
            </p>
          </div>
        </div>

        {/* My Horses / Services Tabs */}
        <div
          className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl mb-8 w-fit"
          role="tablist"
          aria-label="Vet Clinic section"
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
        <div className="mt-10 p-5 rounded-xl bg-white/3 border border-white/8 text-sm text-white/40">
          <h3 className="font-semibold text-white/60 mb-2">About the Vet Clinic</h3>
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
