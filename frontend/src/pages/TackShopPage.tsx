/**
 * TackShopPage — World > Tack Shop (owner ruling 2026-10-26, Equoria-dslww)
 *
 * Works like the Feed Shop: just a place to buy things. Horses play no part in
 * a shop. Buying puts the tack in the player's inventory; equipping happens
 * from the inventory or the horse page. Every saddle, harness and bridle costs
 * 500 coins (the catalogue is the single source).
 *
 *   useTackInventory()    — GET /api/v1/tack-shop/inventory
 *   usePurchaseTackItem() — POST /api/v1/tack-shop/purchase ({ itemId })
 *
 * Old contract: a My Horses tab chose the horse each purchase was bought for.
 */

import React from 'react';
import { Link } from 'react-router';
import { ShoppingBag } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { PageContainer } from '@/components/layout/PageContainer';
import { Surface } from '@/components/ui/Surface';
import { ShopTab } from './tack-shop/ShopTab';

const TackShopPage: React.FC = () => {
  return (
    <div className="min-h-screen">
      <PageHero
        title="Tack Shop"
        subtitle="Saddles, bridles, and specialist gear to boost your horses in competition"
        mood="golden"
        icon={<ShoppingBag className="w-7 h-7 text-[var(--gold-400)]" />}
      >
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"
        >
          <Link to="/world" className="hover:text-[var(--text-primary)] transition-colors">
            World
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-[var(--text-primary)]">Tack Shop</span>
        </nav>
      </PageHero>

      {/* Banner image in glass card */}
      <PageContainer variant="content" padded={false} className="pt-1 pb-4">
        <Surface variant="panel">
          <img
            src="/images/tackstoreclerk.webp"
            alt="Starlight Tack & Supply — interior view with the shopkeeper and shelves of saddles and bridles"
            className="w-full h-auto rounded-[var(--radius-md)]"
          />
        </Surface>
      </PageContainer>

      <PageContainer variant="wide" padded={false} className="pb-8">
        <ShopTab />

        {/* Info Panel (#7 — accurate descriptions) */}
        <Surface variant="panel" as="aside" className="mt-10 text-sm text-[var(--text-muted)]">
          <h3 className="font-semibold text-[var(--text-primary)] mb-2">About the Tack Shop</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Saddles and bridles provide direct numeric bonuses to competition scoring</li>
            <li>
              Tack you buy goes to your inventory; equip it to a horse from the{' '}
              <Link to="/inventory" className="text-role-link underline">
                Inventory page
              </Link>
            </li>
            <li>Only one item per category can be equipped on a horse at a time</li>
            <li>Items with discipline tags give their full bonus in matching competitions</li>
            <li>General items (no discipline tag) work across all events</li>
          </ul>
        </Surface>
      </PageContainer>
    </div>
  );
};

export default TackShopPage;
