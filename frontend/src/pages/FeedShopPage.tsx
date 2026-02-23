/**
 * FeedShopPage — World > Feed Shop Location (Epic 10 — Story 10-3)
 *
 * The Feed Shop location in the World hub. Two modes:
 * - My Horses: Nutrition status overview, current feed, action prompts
 * - Shop: Available feed and supplements with descriptions and costs
 *
 * Backend routes deferred (Story 10-5). UI is mock-ready pointing at
 * expected /api/horses and /api/feed-shop/* endpoints.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Heart, ShoppingCart, Clock } from 'lucide-react';
import MainNavigation from '@/components/MainNavigation';

type FeedShopTab = 'horses' | 'shop';

interface FeedItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  billing: string;
  icon: string;
}

const FEED_ITEMS: FeedItem[] = [
  {
    id: 'basic-feed',
    name: 'Basic Feed',
    description:
      'Standard nutritional mix for daily upkeep. Maintains health and energy at baseline levels.',
    cost: 50,
    billing: 'per week',
    icon: '🌾',
  },
  {
    id: 'performance-mix',
    name: 'Performance Mix',
    description:
      'High-energy blend formulated for competition horses. Boosts stamina and recovery between events.',
    cost: 120,
    billing: 'per week',
    icon: '⚡',
  },
  {
    id: 'vitamin-supplement',
    name: 'Vitamin Supplement',
    description:
      'Monthly vitamin and mineral boost. Strengthens immune system and supports long-term horse health.',
    cost: 80,
    billing: 'per month',
    icon: '💊',
  },
  {
    id: 'custom-diet-plan',
    name: 'Custom Diet Plan',
    description:
      "Personalised nutrition analysis and tailored feeding plan. Optimises diet based on your horse's age, discipline, and goals.",
    cost: 300,
    billing: 'one-time',
    icon: '📋',
  },
];

const HorsesNutritionTab: React.FC = () => (
  <div
    className="flex flex-col items-center justify-center min-h-64 p-8 text-center"
    data-testid="horses-nutrition-tab"
  >
    <span className="text-5xl mb-4 select-none" aria-hidden="true">
      🌾
    </span>
    <h2 className="text-lg font-bold text-white/60 mb-2">No Horses Registered</h2>
    <p className="text-sm text-white/40 max-w-sm mb-6">
      Visit your stable to manage feed for your horses. Consistent nutrition keeps energy high and
      prevents performance decline.
    </p>
    <Link
      to="/stable"
      className="px-5 py-2.5 bg-lime-600/20 border border-lime-500/30 text-lime-400 rounded-lg text-sm font-medium hover:bg-lime-600/30 transition-colors"
    >
      Go to Stable
    </Link>
  </div>
);

const ShopTab: React.FC = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="feed-shop-tab">
    {FEED_ITEMS.map((item) => (
      <div
        key={item.id}
        className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all"
        data-testid={`feed-item-${item.id}`}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">
              {item.icon}
            </span>
            <div>
              <h3 className="font-bold text-white/90">{item.name}</h3>
              <span className="text-xs text-white/40 flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                {item.billing}
              </span>
            </div>
          </div>
          <p className="text-lg font-bold text-celestial-gold">${item.cost.toLocaleString()}</p>
        </div>
        <p className="text-sm text-white/50 mb-4">{item.description}</p>
        <button
          type="button"
          disabled
          className="w-full py-2 text-sm font-medium rounded-lg bg-lime-600/10 border border-lime-500/20 text-lime-400/60 cursor-not-allowed"
          title="Select a horse from My Horses to purchase"
        >
          Select a Horse to Purchase
        </button>
      </div>
    ))}
  </div>
);

const FeedShopPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<FeedShopTab>('horses');

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
          <span className="text-white/70">Feed Shop</span>
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
            <h1 className="text-2xl font-bold text-white/90">🌾 Feed Shop</h1>
            <p className="text-sm text-white/50 mt-0.5">
              Quality feed and supplements to keep your horses energized and healthy
            </p>
          </div>
        </div>

        {/* My Horses / Shop Tabs */}
        <div
          className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl mb-8 w-fit"
          role="tablist"
          aria-label="Feed Shop section"
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
            <ShoppingCart className="w-4 h-4" />
            Shop
          </button>
        </div>

        {/* Tab Content */}
        <div role="tabpanel">{activeTab === 'horses' ? <HorsesNutritionTab /> : <ShopTab />}</div>

        {/* Info Panel */}
        <div className="mt-10 p-5 rounded-xl bg-white/3 border border-white/8 text-sm text-white/40">
          <h3 className="font-semibold text-white/60 mb-2">About the Feed Shop</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Horses with an empty feed supply lose energy and health over time</li>
            <li>Performance Mix increases stamina recovery between competitions</li>
            <li>Vitamin supplements reduce the chance of illness and injury</li>
            <li>Custom diet plans are recommended before high-tier events</li>
            <li>Foals in development benefit most from consistent nutrition</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FeedShopPage;
