/**
 * World Hub Page
 *
 * Story 9B-1: World Hub Page — 8 location cards for the game world.
 * Players visit locations to manage horse care, training, competitions,
 * breeding, and staff.
 *
 * Locations:
 * 1. Vet Clinic    — horse health checks and treatment
 * 2. Farrier       — hoof care and shoeing
 * 3. Tack Shop     — equipment and gear
 * 4. Feed Shop     — nutrition and supplements
 * 5. Training Center — training sessions
 * 6. Grooms        — groom hiring and management
 * 7. Riders        — jockey and rider management
 * 8. Breeding Specialist — breeding consultation
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface WorldLocation {
  id: string;
  name: string;
  description: string;
  icon: string;
  href: string;
  alertCount?: number;
  alertLabel?: string;
  accentColor: string;
  bgColor: string;
}

const worldLocations: WorldLocation[] = [
  {
    id: 'vet',
    name: 'Vet Clinic',
    description: 'Schedule check-ups, treat injuries, and monitor the health of your horses.',
    icon: '🏥',
    href: '/stable',
    accentColor: 'border-emerald-400/40 hover:border-emerald-400/70',
    bgColor: 'from-emerald-900/30 to-emerald-800/10',
  },
  {
    id: 'farrier',
    name: 'Farrier',
    description: 'Keep hooves trimmed and shod. Neglected hooves reduce performance.',
    icon: '🔨',
    href: '/stable',
    accentColor: 'border-amber-400/40 hover:border-amber-400/70',
    bgColor: 'from-amber-900/30 to-amber-800/10',
  },
  {
    id: 'tack-shop',
    name: 'Tack Shop',
    description:
      'Browse saddles, bridles, and specialized gear to boost your horses in competition.',
    icon: '🧴',
    href: '/stable',
    accentColor: 'border-sky-400/40 hover:border-sky-400/70',
    bgColor: 'from-sky-900/30 to-sky-800/10',
  },
  {
    id: 'feed-shop',
    name: 'Feed Shop',
    description: 'Stock quality feed and supplements to keep your horses energized and healthy.',
    icon: '🌾',
    href: '/stable',
    accentColor: 'border-lime-400/40 hover:border-lime-400/70',
    bgColor: 'from-lime-900/30 to-lime-800/10',
  },
  {
    id: 'training-center',
    name: 'Training Center',
    description:
      'Sharpen skills and improve discipline stats through structured training sessions.',
    icon: '🏋️',
    href: '/training',
    accentColor: 'border-violet-400/40 hover:border-violet-400/70',
    bgColor: 'from-violet-900/30 to-violet-800/10',
  },
  {
    id: 'grooms',
    name: 'Grooms',
    description: 'Hire, assign, and manage grooms to care for your foals and horses daily.',
    icon: '🧑‍🌾',
    href: '/stable',
    accentColor: 'border-rose-400/40 hover:border-rose-400/70',
    bgColor: 'from-rose-900/30 to-rose-800/10',
  },
  {
    id: 'riders',
    name: 'Riders',
    description: 'Find skilled jockeys and riders to partner with your competition horses.',
    icon: '🏇',
    href: '/riders',
    accentColor: 'border-orange-400/40 hover:border-orange-400/70',
    bgColor: 'from-orange-900/30 to-orange-800/10',
  },
  {
    id: 'breeding-specialist',
    name: 'Breeding Specialist',
    description: 'Consult on bloodlines, genetic pairings, and foal development strategies.',
    icon: '🧬',
    href: '/breeding',
    accentColor: 'border-pink-400/40 hover:border-pink-400/70',
    bgColor: 'from-pink-900/30 to-pink-800/10',
  },
];

const WorldLocationCard: React.FC<{ location: WorldLocation }> = ({ location }) => (
  <Link
    to={location.href}
    className={cn(
      'group relative flex flex-col rounded-2xl border bg-gradient-to-b backdrop-blur-sm p-6',
      'transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5',
      'bg-black/40',
      location.accentColor,
      location.bgColor
    )}
    data-testid={`world-location-${location.id}`}
  >
    {/* Alert Badge */}
    {location.alertCount !== undefined && location.alertCount > 0 && (
      <span
        className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full"
        data-testid={`world-alert-${location.id}`}
      >
        {location.alertCount} {location.alertLabel ?? 'alert'}
      </span>
    )}

    {/* Icon */}
    <div className="text-4xl mb-4 select-none" aria-hidden="true">
      {location.icon}
    </div>

    {/* Name */}
    <h2 className="text-lg font-bold text-white mb-2 group-hover:text-celestial-gold transition-colors">
      {location.name}
    </h2>

    {/* Description */}
    <p className="text-sm text-white/60 leading-relaxed flex-1">{location.description}</p>

    {/* Visit Arrow */}
    <div className="mt-4 text-xs font-medium text-white/40 group-hover:text-white/80 transition-colors flex items-center gap-1">
      Visit
      <span
        className="inline-block transition-transform group-hover:translate-x-1"
        aria-hidden="true"
      >
        →
      </span>
    </div>
  </Link>
);

const WorldHubPage: React.FC = () => (
  <div className="space-y-8" data-testid="world-hub-page">
    {/* Page Header */}
    <header className="text-center space-y-3 animate-fade-in-up">
      <h1 className="font-heading text-4xl md:text-5xl font-bold text-starlight-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
        The World
      </h1>
      <p className="text-lg text-starlight-white/60 max-w-2xl mx-auto">
        Explore the realm and visit locations to care for your horses, train, compete, and breed.
      </p>
    </header>

    {/* Location Grid */}
    <section
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 animate-fade-in-up"
      aria-label="World locations"
    >
      {worldLocations.map((location) => (
        <WorldLocationCard key={location.id} location={location} />
      ))}
    </section>
  </div>
);

export default WorldHubPage;
