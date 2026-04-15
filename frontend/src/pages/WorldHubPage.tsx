/**
 * World Hub Page — The Realm of Equoria
 *
 * 10 location cards for the game world with atmospheric header.
 * This is the map screen — exploring the world should feel expansive.
 *
 */

import React from 'react';
import { Globe } from 'lucide-react';
import LocationCard, { type LocationCardProps } from '@/components/LocationCard';
import PageHero from '@/components/layout/PageHero';

const worldLocations: LocationCardProps[] = [
  {
    id: 'vet',
    name: 'Vet Clinic',
    description: 'Schedule check-ups, treat injuries, and monitor the health of your horses.',
    icon: '🏥',
    href: '/vet',
    paintingGradient:
      'linear-gradient(160deg, rgba(5,80,55,0.85) 0%, rgba(5,46,30,0.95) 60%, rgba(5,13,26,0.98) 100%)',
    backgroundImage: '/images/veterinarian.webp',
    backgroundPosition: '50% 40%',
  },
  {
    id: 'farrier',
    name: 'Farrier',
    description: 'Keep hooves trimmed and shod. Neglected hooves reduce performance.',
    icon: '🔨',
    href: '/farrier',
    paintingGradient:
      'linear-gradient(160deg, rgba(92,52,8,0.85) 0%, rgba(64,36,5,0.95) 60%, rgba(5,13,26,0.98) 100%)',
    backgroundImage: '/images/farriershop.webp',
    backgroundPosition: '50% 50%',
  },
  {
    id: 'tack-shop',
    name: 'Tack Shop',
    description:
      'Browse saddles, bridles, and specialized gear to boost your horses in competition.',
    icon: '🧴',
    href: '/tack-shop',
    paintingGradient:
      'linear-gradient(160deg, rgba(14,50,100,0.85) 0%, rgba(8,30,64,0.95) 60%, rgba(5,13,26,0.98) 100%)',
    backgroundImage: '/images/tackstoreclerk.webp',
    backgroundPosition: '50% 25%',
  },
  {
    id: 'feed-shop',
    name: 'Feed Shop',
    description: 'Stock quality feed and supplements to keep your horses energized and healthy.',
    icon: '🌾',
    href: '/feed-shop',
    paintingGradient:
      'linear-gradient(160deg, rgba(45,78,10,0.85) 0%, rgba(28,48,5,0.95) 60%, rgba(5,13,26,0.98) 100%)',
    backgroundImage: '/images/feedstore.webp',
    backgroundPosition: '55% 35%',
  },
  {
    id: 'training-center',
    name: 'Training Center',
    description:
      'Sharpen skills and improve discipline stats through structured training sessions.',
    icon: '🏋️',
    href: '/training',
    paintingGradient:
      'linear-gradient(160deg, rgba(55,30,100,0.85) 0%, rgba(35,18,70,0.95) 60%, rgba(5,13,26,0.98) 100%)',
  },
  {
    id: 'grooms',
    name: 'Grooms',
    description: 'Hire, assign, and manage grooms to care for your foals and horses daily.',
    icon: '🧑‍🌾',
    href: '/grooms',
    paintingGradient:
      'linear-gradient(160deg, rgba(100,20,40,0.85) 0%, rgba(70,12,25,0.95) 60%, rgba(5,13,26,0.98) 100%)',
  },
  {
    id: 'riders',
    name: 'Riders',
    description: 'Find skilled jockeys and riders to partner with your competition horses.',
    icon: '🏇',
    href: '/riders',
    paintingGradient:
      'linear-gradient(160deg, rgba(120,50,8,0.85) 0%, rgba(80,30,5,0.95) 60%, rgba(5,13,26,0.98) 100%)',
  },
  {
    id: 'breeding-specialist',
    name: 'Breeding Specialist',
    description: 'Consult on bloodlines, genetic pairings, and foal development strategies.',
    icon: '🧬',
    href: '/breeding',
    paintingGradient:
      'linear-gradient(160deg, rgba(100,15,60,0.85) 0%, rgba(65,8,38,0.95) 60%, rgba(5,13,26,0.98) 100%)',
  },
  {
    id: 'trainers',
    name: 'Trainers',
    description: 'Hire expert trainers and assign them to your horses to boost training results.',
    icon: '🎓',
    href: '/trainers',
    paintingGradient:
      'linear-gradient(160deg, rgba(40,25,90,0.85) 0%, rgba(25,14,60,0.95) 60%, rgba(5,13,26,0.98) 100%)',
  },
  {
    id: 'crafting',
    name: 'Leathersmith Workshop',
    description:
      'Craft custom tack from leather, metal, and rare materials. Upgrade your workshop for better recipes.',
    icon: '🔧',
    href: '/crafting',
    paintingGradient:
      'linear-gradient(160deg, rgba(80,45,10,0.85) 0%, rgba(55,30,5,0.95) 60%, rgba(5,13,26,0.98) 100%)',
  },
];

const WorldHubPage: React.FC = () => (
  <div className="min-h-screen" data-testid="world-hub-page">
    <PageHero
      title="The World of Equoria"
      subtitle="Explore the realm — visit locations to care for your horses, train, compete, and forge your legacy."
      mood="default"
      icon={<Globe className="w-7 h-7 text-[var(--gold-400)]" aria-hidden="true" />}
    />

    {/* Location Grid */}
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
      <section
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        aria-label="World locations"
        data-onboarding-target="world-hub-explore"
      >
        {worldLocations.map((location) => (
          <LocationCard key={location.id} {...location} />
        ))}
      </section>
    </div>
  </div>
);

export default WorldHubPage;
