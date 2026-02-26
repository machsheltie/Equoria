/**
 * InventoryPage — Player Inventory (Epic 12 — Story 12-2)
 *
 * Shows all owned tack, consumables, and special items.
 * Items can be equipped to horses (mock-ready, deferred to Story 12-5 wire-up).
 * Backend routes deferred; UI points at expected /api/inventory/* endpoints.
 *
 * Uses Celestial Night theme (consistent with other standalone pages).
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Package, Shield, Leaf, Sparkles, AlertCircle } from 'lucide-react';
import MainNavigation from '@/components/MainNavigation';

type InventoryCategory = 'all' | 'tack' | 'consumables' | 'special';

interface InventoryItem {
  id: string;
  name: string;
  category: 'tack' | 'consumables' | 'special';
  description: string;
  quantity: number;
  icon: string;
  equippedTo?: string;
  bonus?: string;
}

// Mock inventory — replaced by live API in Story 12-5 wire-up
const MOCK_INVENTORY: InventoryItem[] = [
  {
    id: 'item-training-saddle',
    name: 'Training Saddle',
    category: 'tack',
    description: 'Comfortable saddle for daily training sessions.',
    quantity: 1,
    icon: '🪣',
    bonus: '+5% training efficiency',
    equippedTo: 'Silver Mane',
  },
  {
    id: 'item-standard-bridle',
    name: 'Standard Bridle',
    category: 'tack',
    description: 'Well-fitted bridle for daily use.',
    quantity: 2,
    icon: '🔗',
    bonus: '+3% obedience',
  },
  {
    id: 'item-competition-bridle',
    name: 'Competition Bridle',
    category: 'tack',
    description: 'Lightweight competition bridle for high-stakes events.',
    quantity: 1,
    icon: '⭐',
    bonus: '+6% competition score',
    equippedTo: 'Thunder Peak',
  },
  {
    id: 'item-vitamin-supplement',
    name: 'Vitamin Supplement',
    category: 'consumables',
    description: 'Monthly vitamin boost. Strengthens immune system.',
    quantity: 3,
    icon: '💊',
  },
  {
    id: 'item-performance-mix',
    name: 'Performance Mix (1 week)',
    category: 'consumables',
    description: 'High-energy feed blend for competition horses.',
    quantity: 5,
    icon: '⚡',
  },
  {
    id: 'item-custom-diet',
    name: 'Custom Diet Plan',
    category: 'consumables',
    description: 'Personalised nutrition analysis for a single horse.',
    quantity: 1,
    icon: '📋',
  },
  {
    id: 'item-vetting-cert',
    name: 'Vetting Certificate',
    category: 'special',
    description: 'Official veterinary clearance for competition entry.',
    quantity: 2,
    icon: '📄',
  },
  {
    id: 'item-stud-token',
    name: 'Premium Stud Token',
    category: 'special',
    description: 'Grants one premium breeding session with any available stud.',
    quantity: 1,
    icon: '🏅',
  },
];

const categoryIcons: Record<InventoryCategory, React.ReactNode> = {
  all: <Package className="w-4 h-4" />,
  tack: <Shield className="w-4 h-4" />,
  consumables: <Leaf className="w-4 h-4" />,
  special: <Sparkles className="w-4 h-4" />,
};

const categoryLabels: Record<InventoryCategory, string> = {
  all: 'All Items',
  tack: 'Tack',
  consumables: 'Consumables',
  special: 'Special',
};

const InventoryPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<InventoryCategory>('all');

  const filteredItems =
    activeCategory === 'all'
      ? MOCK_INVENTORY
      : MOCK_INVENTORY.filter((item) => item.category === activeCategory);

  const categories: InventoryCategory[] = ['all', 'tack', 'consumables', 'special'];

  const totalItems = MOCK_INVENTORY.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen">
      <MainNavigation />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
          <Link to="/" className="hover:text-white/70 transition-colors">
            Home
          </Link>
          <span>/</span>
          <span className="text-white/70">Inventory</span>
        </div>

        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/30">
              <Package className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white/90">🎒 Inventory</h1>
              <p className="text-sm text-white/50 mt-0.5">
                Manage your tack, consumables, and special items
              </p>
            </div>
          </div>
          <div
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/60"
            data-testid="item-count"
          >
            {totalItems} items
          </div>
        </div>

        {/* Category Filter */}
        <div
          className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl mb-6 w-fit"
          role="tablist"
          aria-label="Inventory categories"
        >
          {categories.map((cat) => (
            <button
              key={cat}
              role="tab"
              aria-selected={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeCategory === cat
                  ? 'bg-white/10 text-white/90 shadow-sm'
                  : 'text-white/40 hover:text-white/70'
              }`}
              data-testid={`category-${cat}`}
            >
              {categoryIcons[cat]}
              {categoryLabels[cat]}
            </button>
          ))}
        </div>

        {/* Inventory Grid */}
        <div role="tabpanel" data-testid="inventory-grid">
          {filteredItems.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center min-h-48 text-center p-8"
              data-testid="empty-inventory"
            >
              <AlertCircle className="w-10 h-10 text-white/20 mb-3" />
              <p className="text-white/50 font-medium">No items in this category</p>
              <p className="text-white/30 text-sm mt-1">
                Visit the Tack Shop or Feed Shop to stock up.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => (
                <InventoryItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* Info Panel */}
        <div className="mt-10 p-5 rounded-xl bg-white/3 border border-white/8 text-sm text-white/40">
          <h3 className="font-semibold text-white/60 mb-2">About Inventory</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Tack items can be equipped to one horse at a time</li>
            <li>Consumables are used once and removed from inventory</li>
            <li>Special items unlock unique actions or access</li>
            <li>Items purchased in the Tack Shop and Feed Shop appear here automatically</li>
            <li>Equip and unequip tack from the horse detail page</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

const InventoryItemCard: React.FC<{ item: InventoryItem }> = ({ item }) => {
  const handleEquip = () => {
    if (item.category === 'consumables') {
      toast.info(
        'Consumables are applied when purchased from the Feed Shop or Vet Clinic — visit there to use items on a specific horse.',
        { duration: 5000 }
      );
    } else {
      toast.info(
        `To equip "${item.name}", purchase it from the Tack Shop for a specific horse — it will be applied directly during checkout.`,
        { duration: 5000 }
      );
    }
  };

  return (
    <div
      className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all"
      data-testid={`inventory-item-${item.id}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">
            {item.icon}
          </span>
          <div>
            <h3 className="font-bold text-white/90 text-sm">{item.name}</h3>
            {item.bonus && (
              <span className="text-xs text-violet-400/80 font-medium mt-0.5 block">
                {item.bonus}
              </span>
            )}
          </div>
        </div>
        <span className="text-xs font-bold bg-white/10 text-white/60 rounded-full px-2 py-0.5">
          ×{item.quantity}
        </span>
      </div>

      <p className="text-xs text-white/50 mb-3">{item.description}</p>

      {item.equippedTo ? (
        <div className="flex items-center justify-between">
          <span className="text-xs text-emerald-400 font-medium">Equipped: {item.equippedTo}</span>
          <button
            type="button"
            onClick={() =>
              toast.info('To unequip an item, go to the horse detail page — Stud / Sale tab.')
            }
            className="text-xs px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white/70 hover:border-white/20 transition-colors"
            title="See horse detail page to unequip"
          >
            Unequip
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleEquip}
          className="w-full py-1.5 text-xs font-medium rounded-lg bg-violet-600/10 border border-violet-500/20 text-violet-400/80 hover:bg-violet-600/20 hover:text-violet-300 transition-colors"
          title="How to equip this item"
        >
          {item.category === 'consumables' ? 'How to Use' : 'How to Equip'}
        </button>
      )}
    </div>
  );
};

export default InventoryPage;
