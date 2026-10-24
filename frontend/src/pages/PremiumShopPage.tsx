/**
 * PremiumShopPage — World > Premium Shop (Equoria-rbo1c, owner ruling 2026-10-23).
 *
 * A shop location laid out like the Tack Shop and Feed Shop: PageHero with a
 * World breadcrumb, then a panel. For now the panel only says "Coming soon":
 * no payments, no items, no premium logic. The owner will supply the hero art
 * and the items; until then the hero uses its no-image treatment.
 */

import React from 'react';
import { Link } from 'react-router';
import { Gem } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { PageContainer } from '@/components/layout/PageContainer';
import { Surface } from '@/components/ui/Surface';
import EmptyState from '@/components/ui/EmptyState';

const PremiumShopPage: React.FC = () => (
  <div className="min-h-screen" data-testid="premium-shop-page">
    <PageHero
      title="Premium Shop"
      subtitle="Rare finds and limited-edition goods for your stable"
      mood="golden"
      icon={<Gem className="w-7 h-7 text-[var(--gold-400)]" />}
    >
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"
      >
        <Link to="/world" className="hover:text-[var(--text-primary)] transition-colors">
          World
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-[var(--text-primary)]">Premium Shop</span>
      </nav>
    </PageHero>

    <PageContainer variant="content" padded={false} className="pt-1 pb-8">
      <Surface variant="panel" data-testid="premium-shop-coming-soon">
        <EmptyState
          variant="unavailable"
          icon={<Gem className="w-8 h-8" aria-hidden="true" />}
          title="Coming soon"
          description="The Premium Shop is being stocked. Check back soon."
        />
      </Surface>
    </PageContainer>
  </div>
);

export default PremiumShopPage;
