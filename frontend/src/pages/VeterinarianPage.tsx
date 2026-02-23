/**
 * VeterinarianPage — World > Vet Clinic Location (Epic 10 — Story 10-1)
 *
 * The Vet Clinic location in the World hub. Two modes:
 * - My Horses: Health status overview, last vetting date, action prompts
 * - Services: Available vet procedures with descriptions and costs
 *
 * Backend routes deferred (Story 10-5). UI is mock-ready pointing at
 * expected /api/horses and /api/vet/* endpoints.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Heart, Activity, Clock } from 'lucide-react';
import MainNavigation from '@/components/MainNavigation';

type VetTab = 'horses' | 'services';

interface VetService {
  id: string;
  name: string;
  description: string;
  cost: number;
  duration: string;
  icon: string;
}

const VET_SERVICES: VetService[] = [
  {
    id: 'health-check',
    name: 'Health Check',
    description: 'Full physical examination. Records current health status and flags any concerns.',
    cost: 150,
    duration: '30 min',
    icon: '🩺',
  },
  {
    id: 'treatment',
    name: 'Injury Treatment',
    description:
      'Treat active injuries to restore health status. Required before injured horses can train or compete.',
    cost: 400,
    duration: '1–3 days',
    icon: '💊',
  },
  {
    id: 'genetics',
    name: 'Genetics Analysis',
    description:
      'Reveal bloodline traits and genetic predispositions. Informs breeding decisions and foal planning.',
    cost: 800,
    duration: '2 days',
    icon: '🧬',
  },
  {
    id: 'vetting-certificate',
    name: 'Vetting Certificate',
    description:
      'Official certificate of soundness. Required for high-tier competition entry and sales.',
    cost: 250,
    duration: '1 day',
    icon: '📋',
  },
];

const HorsesHealthTab: React.FC = () => (
  <div
    className="flex flex-col items-center justify-center min-h-64 p-8 text-center"
    data-testid="horses-health-tab"
  >
    <Heart className="w-12 h-12 text-emerald-400/30 mb-4" />
    <h2 className="text-lg font-bold text-white/60 mb-2">No Horses Registered</h2>
    <p className="text-sm text-white/40 max-w-sm mb-6">
      Visit your stable to bring horses in for their first health check. Regular vetting keeps your
      horses at peak performance.
    </p>
    <Link
      to="/stable"
      className="px-5 py-2.5 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-600/30 transition-colors"
    >
      Go to Stable
    </Link>
  </div>
);

const ServicesTab: React.FC = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="vet-services-tab">
    {VET_SERVICES.map((service) => (
      <div
        key={service.id}
        className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all"
        data-testid={`vet-service-${service.id}`}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">
              {service.icon}
            </span>
            <div>
              <h3 className="font-bold text-white/90">{service.name}</h3>
              <span className="text-xs text-white/40 flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                {service.duration}
              </span>
            </div>
          </div>
          <p className="text-lg font-bold text-celestial-gold">${service.cost.toLocaleString()}</p>
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

const VeterinarianPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<VetTab>('horses');

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
        <div role="tabpanel">{activeTab === 'horses' ? <HorsesHealthTab /> : <ServicesTab />}</div>

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
