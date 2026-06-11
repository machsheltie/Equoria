/**
 * TackShopPage — World > Tack Shop Location (Epic 10 — Story 10-4)
 *
 * The Tack Shop location in the World hub. Two modes:
 * - My Horses: Select a horse to equip; shows equipped tack per horse
 * - Shop: Browse tack from the live API across all categories; purchase for selected horse
 *
 * Wired to real API hooks (Story 10-5 wire-up):
 *   useTackInventory()   — GET /api/tack-shop/inventory
 *   usePurchaseTackItem() — POST /api/tack-shop/purchase
 *   useHorses()          — GET /api/horses
 *
 * Decomposed in Equoria-f5xni: the sub-components (TackItemCard, ShopTab,
 * DecorationsPanel, HorsesTackTab) and constants live under
 * `pages/tack-shop/`. This file is now the thin page composition only —
 * page-level tab + selected-horse state and the World-hub chrome.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingBag } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { PageContainer } from '@/components/layout/PageContainer';
import { Surface } from '@/components/ui/Surface';
import { CanonicalTabs } from '@/components/ui/game';
import type { HorseSummary } from '@/lib/api-client';
import type { TackShopTab } from './tack-shop/constants';
import { ShopTab } from './tack-shop/ShopTab';
import { HorsesTackTab } from './tack-shop/HorsesTackTab';

const TackShopPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TackShopTab>('horses');
  const [selectedHorse, setSelectedHorse] = useState<HorseSummary | null>(null);

  const handleSelectHorse = (horse: HorseSummary) => {
    setSelectedHorse(horse);
  };

  const handleGoToShop = () => {
    setActiveTab('shop');
  };

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
        {/* My Horses / Shop tabs — CanonicalTabs (DECISIONS.md §6).
            Controlled so HorsesTackTab's "Continue to Shop" and ShopTab's
            "Change horse" can switch tabs programmatically. */}
        <CanonicalTabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TackShopTab)}
          tabs={[
            {
              value: 'horses',
              label: 'My Horses',
              icon: <Heart className="w-4 h-4" />,
              content: (
                <HorsesTackTab
                  selectedHorse={selectedHorse}
                  onSelectHorse={handleSelectHorse}
                  onGoToShop={handleGoToShop}
                />
              ),
            },
            {
              value: 'shop',
              label: 'Shop',
              icon: <ShoppingBag className="w-4 h-4" />,
              content: (
                <ShopTab
                  selectedHorse={selectedHorse}
                  onSwitchToHorses={() => setActiveTab('horses')}
                />
              ),
            },
          ]}
        />

        {/* Info Panel (#7 — accurate descriptions) */}
        <Surface variant="panel" as="aside" className="mt-10 text-sm text-[var(--text-muted)]">
          <h3 className="font-semibold text-[var(--text-primary)] mb-2">About the Tack Shop</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Saddles and bridles provide direct numeric bonuses to competition scoring</li>
            <li>
              Only one item per category can be equipped at a time — purchasing replaces the old
              item
            </li>
            <li>Items with discipline tags give their full bonus in matching competitions</li>
            <li>General items (no discipline tag) work across all events</li>
            <li>
              Manage equipped tack from the{' '}
              <Link to="/inventory" className="text-role-link underline">
                Inventory page
              </Link>
            </li>
          </ul>
        </Surface>
      </PageContainer>
    </div>
  );
};

export default TackShopPage;
