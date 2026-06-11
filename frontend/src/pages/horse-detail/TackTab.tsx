/**
 * TackTab — lists equipped tack items. Tack does not degrade with use,
 * so no condition / repair UI here.
 * Equoria-kdduk: extracted from HorseDetailPage.tsx.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { Surface } from '@/components/ui/Surface';
import type { Horse } from './HorseDetailPageTypes';

const TACK_DISPLAY_CATEGORIES = [
  { key: 'saddle', label: 'Saddle' },
  { key: 'bridle', label: 'Bridle' },
  { key: 'halter', label: 'Halter' },
  { key: 'saddle_pad', label: 'Saddle Pad' },
  { key: 'leg_wraps', label: 'Leg Wraps' },
  { key: 'reins', label: 'Reins' },
  { key: 'girth', label: 'Girth' },
  { key: 'breastplate', label: 'Breastplate' },
];

const TackTab: React.FC<{ horse: Horse }> = ({ horse }) => {
  const tack = horse.tack;

  const equippedItems = TACK_DISPLAY_CATEGORIES.filter(
    ({ key }) => tack && typeof tack[key] === 'string'
  );

  if (!tack || equippedItems.length === 0) {
    return (
      <div className="text-center py-12">
        <ShoppingCart className="w-10 h-10 text-[var(--text-secondary)]/40 mx-auto mb-4" />
        <p className="fantasy-body text-[var(--text-secondary)] mb-2">No tack equipped</p>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Visit the Tack Shop to equip saddles, bridles, and more.
        </p>
        <Link
          to="/tack-shop"
          className="text-sm text-burnished-gold hover:text-[var(--text-primary)] underline transition-colors"
        >
          Go to Tack Shop →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="fantasy-title text-xl text-[var(--text-primary)] mb-4">Equipped Tack</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {equippedItems.map(({ key, label }) => {
          const itemId = tack[key] as string;
          return (
            <Surface
              key={key}
              variant="subtle"
              className="p-4"
              data-testid={`tack-equipped-${key}`}
            >
              <span className="fantasy-caption text-[var(--text-secondary)] capitalize block mb-1">
                {label}
              </span>
              <p className="fantasy-body text-[var(--text-primary)] text-sm truncate">{itemId}</p>
            </Surface>
          );
        })}
      </div>

      <div className="mt-4 text-right">
        <Link
          to="/tack-shop"
          className="text-sm text-burnished-gold hover:text-[var(--text-primary)] underline transition-colors"
        >
          Manage tack in Tack Shop →
        </Link>
      </div>
    </div>
  );
};

export default TackTab;
