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
import { CelestialTabs } from '@/components/ui/game';
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
        <div className="flex items-center gap-2 text-sm text-[var(--cream)]/60">
          <Link to="/world" className="hover:text-[var(--cream)] transition-colors">
            World
          </Link>
          <span>/</span>
          <span className="text-[var(--cream)]">Tack Shop</span>
        </div>
      </PageHero>

      {/* Banner image in glass card */}
      <div className="max-w-[52rem] mx-auto px-4 sm:px-6 lg:px-8 pt-1 pb-4">
        <div className="p-5 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-sm border border-[var(--glass-border)] shadow-lg shadow-black/20">
          <img
            src="/images/tackstoreclerk.webp"
            alt="Starlight Tack & Supply — interior view with the shopkeeper and shelves of saddles and bridles"
            className="w-full h-auto rounded-xl"
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {/* My Horses / Shop tabs — CelestialTabs (canonical from StableView).
            Controlled so HorsesTackTab's "Continue to Shop" and ShopTab's
            "Change horse" can switch tabs programmatically. */}
        <CelestialTabs
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
        <div className="mt-10 p-5 rounded-xl glass-panel text-sm text-[var(--text-muted)]">
          <h3 className="font-semibold text-[var(--cream)] mb-2">About the Tack Shop</h3>
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
              <Link
                to="/inventory"
                className="text-[var(--gold-400)] hover:text-[var(--cream)] underline"
              >
                Inventory page
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TackShopPage;
