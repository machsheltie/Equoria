/**
 * FarrierPage — World > Farrier Location (Epic 10 — Story 10-2)
 *
 * The Farrier location in the World hub. Two modes:
 * - My Horses: Hoof status overview, last visit date, action prompts
 * - Services: Available farrier procedures with descriptions and costs
 *
 * Backend routes deferred (Story 10-5). UI is mock-ready pointing at
 * expected /api/horses and /api/farrier/* endpoints.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Heart, Wrench, Clock } from 'lucide-react';
import MainNavigation from '@/components/MainNavigation';

type FarrierTab = 'horses' | 'services';

interface FarrierService {
  id: string;
  name: string;
  description: string;
  cost: number;
  duration: string;
  icon: string;
}

const FARRIER_SERVICES: FarrierService[] = [
  {
    id: 'hoof-trim',
    name: 'Hoof Trim',
    description:
      'Routine trim to maintain correct hoof shape and balance. Prevents cracks and promotes even movement.',
    cost: 75,
    duration: '20 min',
    icon: '✂️',
  },
  {
    id: 'standard-shoeing',
    name: 'Standard Shoeing',
    description:
      'Fit standard iron shoes for traction and protection. Required for horses on hard terrain or in competitions.',
    cost: 200,
    duration: '45 min',
    icon: '🧲',
  },
  {
    id: 'corrective-shoeing',
    name: 'Corrective Shoeing',
    description:
      'Custom shoes for horses with gait irregularities or hoof imbalances. Improves movement quality over time.',
    cost: 450,
    duration: '1–3 days',
    icon: '🔧',
  },
  {
    id: 'emergency-removal',
    name: 'Emergency Shoe Removal',
    description:
      'Urgent removal of a loose or damaged shoe. Required before a horse with a damaged shoe can compete.',
    cost: 100,
    duration: '30 min',
    icon: '⚠️',
  },
];

const HorsesHoofTab: React.FC = () => (
  <div
    className="flex flex-col items-center justify-center min-h-64 p-8 text-center"
    data-testid="horses-hoof-tab"
  >
    <Wrench className="w-12 h-12 text-amber-400/30 mb-4" />
    <h2 className="text-lg font-bold text-white/60 mb-2">No Horses Registered</h2>
    <p className="text-sm text-white/40 max-w-sm mb-6">
      Visit your stable to bring horses in for their first hoof care appointment. Regular farrier
      visits keep your horses performing at their best.
    </p>
    <Link
      to="/stable"
      className="px-5 py-2.5 bg-amber-600/20 border border-amber-500/30 text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-600/30 transition-colors"
    >
      Go to Stable
    </Link>
  </div>
);

const ServicesTab: React.FC = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="farrier-services-tab">
    {FARRIER_SERVICES.map((service) => (
      <div
        key={service.id}
        className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all"
        data-testid={`farrier-service-${service.id}`}
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
          className="w-full py-2 text-sm font-medium rounded-lg bg-amber-600/10 border border-amber-500/20 text-amber-400/60 cursor-not-allowed"
          title="Select a horse from My Horses to book"
        >
          Select a Horse to Book
        </button>
      </div>
    ))}
  </div>
);

const FarrierPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<FarrierTab>('horses');

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
        <div role="tabpanel">{activeTab === 'horses' ? <HorsesHoofTab /> : <ServicesTab />}</div>

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
