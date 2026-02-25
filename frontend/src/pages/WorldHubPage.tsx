/**
 * World Hub Page
 *
 * Story 9B-1: World Hub Page — 9 location cards for the game world.
 * Players visit locations to manage horse care, training, competitions,
 * breeding, and staff.
 *
 * Story UI-2: Upgraded to use LocationCard component with 3-layer
 * atmospheric painting backgrounds and gold hover glow.
 *
 * Locations:
 * 1. Vet Clinic          — horse health checks and treatment
 * 2. Farrier             — hoof care and shoeing
 * 3. Tack Shop           — equipment and gear
 * 4. Feed Shop           — nutrition and supplements
 * 5. Training Center     — training sessions
 * 6. Grooms              — groom hiring and management
 * 7. Riders              — jockey and rider management
 * 8. Breeding Specialist — breeding consultation
 * 9. Trainers            — trainer hiring and management
 */

import React from 'react';
import LocationCard, { type LocationCardProps } from '@/components/LocationCard';

/**
 * Location data — paintingGradient values are content-level constants unique
 * to each location. They are not design-system tokens because no semantic token
 * covers per-location atmospheric painting colours.
 */
const worldLocations: LocationCardProps[] = [
  {
    id: 'vet',
    name: 'Vet Clinic',
    description: 'Schedule check-ups, treat injuries, and monitor the health of your horses.',
    icon: '🏥',
    href: '/vet',
    paintingGradient:
      'linear-gradient(160deg, rgba(5,80,55,0.85) 0%, rgba(5,46,30,0.95) 60%, rgba(5,13,26,0.98) 100%)',
  },
  {
    id: 'farrier',
    name: 'Farrier',
    description: 'Keep hooves trimmed and shod. Neglected hooves reduce performance.',
    icon: '🔨',
    href: '/farrier',
    paintingGradient:
      'linear-gradient(160deg, rgba(92,52,8,0.85) 0%, rgba(64,36,5,0.95) 60%, rgba(5,13,26,0.98) 100%)',
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
  },
  {
    id: 'feed-shop',
    name: 'Feed Shop',
    description: 'Stock quality feed and supplements to keep your horses energized and healthy.',
    icon: '🌾',
    href: '/feed-shop',
    paintingGradient:
      'linear-gradient(160deg, rgba(45,78,10,0.85) 0%, rgba(28,48,5,0.95) 60%, rgba(5,13,26,0.98) 100%)',
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
];

const WorldHubPage: React.FC = () => (
  <div className="space-y-8" data-testid="world-hub-page">
    {/* Page Header */}
    <header className="text-center space-y-3">
      <h1
        className="text-4xl md:text-5xl font-bold drop-shadow-lg"
        style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}
      >
        The World
      </h1>
      <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
        Explore the realm and visit locations to care for your horses, train, compete, and breed.
      </p>
    </header>

    {/* Location Grid */}
    <section
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
      aria-label="World locations"
    >
      {worldLocations.map((location) => (
        <LocationCard key={location.id} {...location} />
      ))}
    </section>
  </div>
);

export default WorldHubPage;
