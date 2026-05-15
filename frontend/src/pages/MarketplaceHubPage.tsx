/**
 * MarketplaceHubPage — Epic 21 extension
 *
 * Hub page for the /marketplace route. Displays two LocationCards:
 *   - Horse Trader (game store — buy a 3-year-old horse of any breed for 1,000 coins)
 *   - Horse Marketplace (user-to-user listings — buy/sell horses with players)
 *
 * Follows the same structure as WorldHubPage.
 *
 * The Horse Trader card description includes the LIVE breed count from
 * useBreeds() so the marketing copy stays in sync with the DB as breeds are
 * added or removed (Equoria-5c5j). While breeds are loading we fall back to a
 * generic phrase to avoid showing "0 breeds available".
 *
 * Route: /marketplace
 */

import React from 'react';
import { ShoppingCart } from 'lucide-react';
import LocationCard, { type LocationCardProps } from '@/components/LocationCard';
import PageHero from '@/components/layout/PageHero';
import { useBreeds } from '@/hooks/api/useHorseTrader';

const HORSE_MARKETPLACE_CARD: LocationCardProps = {
  id: 'horse-marketplace',
  name: 'Horse Marketplace',
  description: 'Buy and sell horses with other players. Browse listings or list your own.',
  icon: '🛒',
  href: '/marketplace/horses',
  paintingGradient:
    'linear-gradient(160deg, rgba(14,50,100,0.85) 0%, rgba(8,30,64,0.95) 60%, rgba(5,13,26,0.98) 100%)',
};

function buildHorseTraderDescription(breedCount: number): string {
  if (breedCount > 0) {
    return `Buy a 3-year-old horse of any breed. ${breedCount.toLocaleString()} breeds available. 1,000 coins each.`;
  }
  return 'Buy a 3-year-old horse of any breed. 1,000 coins each.';
}

const MarketplaceHubPage: React.FC = () => {
  const { data: breeds = [] } = useBreeds();

  const horseTraderCard: LocationCardProps = {
    id: 'horse-trader',
    name: 'Horse Trader',
    description: buildHorseTraderDescription(breeds.length),
    icon: '🐴',
    href: '/marketplace/horse-trader',
    paintingGradient:
      'linear-gradient(160deg, rgba(30,60,20,0.85) 0%, rgba(18,40,10,0.95) 60%, rgba(5,13,26,0.98) 100%)',
  };

  const marketplaceLocations: LocationCardProps[] = [horseTraderCard, HORSE_MARKETPLACE_CARD];

  return (
    <div className="min-h-screen" data-testid="marketplace-hub-page">
      <PageHero
        title="Marketplace"
        subtitle="Buy horses from the store or trade with other players."
        mood="golden"
        icon={<ShoppingCart className="w-7 h-7 text-[var(--gold-400)]" aria-hidden="true" />}
      />

      {/* Location Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <section
          className="grid grid-cols-1 sm:grid-cols-2 gap-5"
          aria-label="Marketplace locations"
          data-testid="marketplace-hub-grid"
        >
          {marketplaceLocations.map((location) => (
            <LocationCard key={location.id} {...location} />
          ))}
        </section>
      </div>
    </div>
  );
};

export default MarketplaceHubPage;
