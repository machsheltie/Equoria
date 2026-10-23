/**
 * TackItemCard: tack that does not score yet says "Coming soon" and shows no
 * effect text; a saddle or bridle shows what it scores (owner ruling
 * 2026-10-23, Equoria-cv3if). No mocks: the real card renders real item data
 * shaped like the tack shop API.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TackItem } from '@/hooks/api/useTackShop';
import { TackItemCard } from './TackItemCard';

const halter: TackItem = {
  id: 'show-halter',
  category: 'halter',
  name: 'Show Halter',
  description: 'Polished halter with silver fittings for in-hand showing.',
  cost: 250,
  tier: 'quality',
  disciplines: [],
  comingSoon: true,
};

const saddle: TackItem = {
  id: 'dressage-saddle',
  category: 'saddle',
  name: 'Dressage Saddle',
  description: 'A saddle made for Dressage and no other discipline.',
  cost: 800,
  bonus: '+5 in Dressage shows',
  tier: 'quality',
  disciplines: ['Dressage'],
};

const renderCard = (item: TackItem) =>
  render(
    <TackItemCard item={item} selectedHorse={null} onPurchase={vi.fn()} isPurchasing={false} />
  );

describe('TackItemCard Coming soon', () => {
  it('marks non-scoring tack Coming soon and shows no effect text', () => {
    renderCard(halter);
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
    expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument();
  });

  it('shows what a saddle scores and no Coming soon', () => {
    renderCard(saddle);
    expect(screen.getByText('+5 in Dressage shows')).toBeInTheDocument();
    expect(screen.queryByText('Coming soon')).not.toBeInTheDocument();
  });
});
