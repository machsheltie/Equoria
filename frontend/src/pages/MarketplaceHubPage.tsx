/**
 * MarketplaceHubPage — Epic 21 extension
 *
 * Hub page for the /marketplace route. Displays two LocationCards:
 *   - Horse Trader (game store — buy a 3-year-old horse of any breed for 1,000 coins)
 *   - Horse Marketplace (user-to-user listings — buy/sell horses with players)
 *
 * Design-system migration (Equoria-o5hub, marketplace family): operational
 * PageHero replaced with PageHeader; content measure via PageContainer
 * (wide — card grid); no page-local max-w/px wrapper (DECISIONS.md §1–2).
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
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
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
    <PageContainer variant="wide" data-testid="marketplace-hub-page">
      <PageHeader
        title="Marketplace"
        subtitle="Buy horses from the store or trade with other players."
        icon={<ShoppingCart className="w-6 h-6 text-[var(--gold-400)]" aria-hidden="true" />}
      />

      {/* Location Grid */}
      <section
        className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-6"
        aria-label="Marketplace locations"
        data-testid="marketplace-hub-grid"
      >
        {marketplaceLocations.map((location) => (
          <LocationCard key={location.id} {...location} />
        ))}
      </section>
    </PageContainer>
  );
};

export default MarketplaceHubPage;
