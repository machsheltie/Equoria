/**
 * TackShopPage — World > Tack Shop Location (Epic 10 — Story 10-4)
 *
 * The Tack Shop location in the World hub. Two modes:
 * - My Horses: Current equipment overview, equipped items, action prompts
 * - Shop: Browse saddles, bridles, and specialized gear with costs and bonuses
 *
 * Backend routes deferred (Story 10-5). UI is mock-ready pointing at
 * expected /api/horses and /api/tack-shop/* endpoints.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Heart, ShoppingBag } from 'lucide-react';
import MainNavigation from '@/components/MainNavigation';

type TackShopTab = 'horses' | 'shop';

interface TackItem {
  id: string;
  name: string;
  category: 'saddle' | 'bridle';
  description: string;
  cost: number;
  bonus: string;
  icon: string;
}

const TACK_ITEMS: TackItem[] = [
  {
    id: 'training-saddle',
    name: 'Training Saddle',
    category: 'saddle',
    description:
      'Comfortable everyday saddle designed for training sessions. Improves training efficiency and stat gain rate.',
    cost: 500,
    bonus: '+5% training efficiency',
    icon: '🪣',
  },
  {
    id: 'competition-saddle',
    name: 'Competition Saddle',
    category: 'saddle',
    description:
      'Precision-crafted competition saddle for optimal performance in shows. Adds a direct competition score bonus.',
    cost: 1200,
    bonus: '+8% competition score',
    icon: '🏆',
  },
  {
    id: 'standard-bridle',
    name: 'Standard Bridle',
    category: 'bridle',
    description:
      'Well-fitted standard bridle for daily use. Improves communication and obedience during training.',
    cost: 350,
    bonus: '+3% obedience',
    icon: '🔗',
  },
  {
    id: 'competition-bridle',
    name: 'Competition Bridle',
    category: 'bridle',
    description:
      'Lightweight competition bridle engineered for responsiveness. Enhances rider communication in high-stakes events.',
    cost: 800,
    bonus: '+6% competition score',
    icon: '⭐',
  },
];

const HorsesTackTab: React.FC = () => (
  <div
    className="flex flex-col items-center justify-center min-h-64 p-8 text-center"
    data-testid="horses-tack-tab"
  >
    <ShoppingBag className="w-12 h-12 text-sky-400/30 mb-4" />
    <h2 className="text-lg font-bold text-white/60 mb-2">No Horses Registered</h2>
    <p className="text-sm text-white/40 max-w-sm mb-6">
      Visit your stable to equip tack on your horses. Quality saddles and bridles improve training
      and competition performance.
    </p>
    <Link
      to="/stable"
      className="px-5 py-2.5 bg-sky-600/20 border border-sky-500/30 text-sky-400 rounded-lg text-sm font-medium hover:bg-sky-600/30 transition-colors"
    >
      Go to Stable
    </Link>
  </div>
);

const ShopTab: React.FC = () => {
  const saddles = TACK_ITEMS.filter((item) => item.category === 'saddle');
  const bridles = TACK_ITEMS.filter((item) => item.category === 'bridle');

  return (
    <div className="space-y-8" data-testid="tack-shop-tab">
      {/* Saddles */}
      <section>
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-4">
          Saddles
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {saddles.map((item) => (
            <TackItemCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      {/* Bridles */}
      <section>
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-4">
          Bridles
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {bridles.map((item) => (
            <TackItemCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
};

const TackItemCard: React.FC<{ item: TackItem }> = ({ item }) => (
  <div
    className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all"
    data-testid={`tack-item-${item.id}`}
  >
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden="true">
          {item.icon}
        </span>
        <div>
          <h3 className="font-bold text-white/90">{item.name}</h3>
          <span className="text-xs text-sky-400/80 font-medium mt-0.5 block">{item.bonus}</span>
        </div>
      </div>
      <p className="text-lg font-bold text-celestial-gold">${item.cost.toLocaleString()}</p>
    </div>
    <p className="text-sm text-white/50 mb-4">{item.description}</p>
    <button
      type="button"
      disabled
      className="w-full py-2 text-sm font-medium rounded-lg bg-sky-600/10 border border-sky-500/20 text-sky-400/60 cursor-not-allowed"
      title="Select a horse from My Horses to purchase"
    >
      Select a Horse to Purchase
    </button>
  </div>
);

const TackShopPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TackShopTab>('horses');

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
          <span className="text-white/70">Tack Shop</span>
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
            <h1 className="text-2xl font-bold text-white/90">🧴 Tack Shop</h1>
            <p className="text-sm text-white/50 mt-0.5">
              Saddles, bridles, and specialist gear to boost your horses in competition
            </p>
          </div>
        </div>

        {/* My Horses / Shop Tabs */}
        <div
          className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl mb-8 w-fit"
          role="tablist"
          aria-label="Tack Shop section"
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
            aria-selected={activeTab === 'shop'}
            onClick={() => setActiveTab('shop')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'shop'
                ? 'bg-white/10 text-white/90 shadow-sm'
                : 'text-white/40 hover:text-white/70'
            }`}
            data-testid="shop-tab"
          >
            <ShoppingBag className="w-4 h-4" />
            Shop
          </button>
        </div>

        {/* Tab Content */}
        <div role="tabpanel">{activeTab === 'horses' ? <HorsesTackTab /> : <ShopTab />}</div>

        {/* Info Panel */}
        <div className="mt-10 p-5 rounded-xl bg-white/3 border border-white/8 text-sm text-white/40">
          <h3 className="font-semibold text-white/60 mb-2">About the Tack Shop</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Only one saddle and one bridle can be equipped per horse at a time</li>
            <li>Competition gear provides direct bonuses to show scoring</li>
            <li>Training saddles increase XP gain rate during training sessions</li>
            <li>Higher-tier bridles improve obedience and rider communication</li>
            <li>Tack can be swapped between horses at no cost</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TackShopPage;
