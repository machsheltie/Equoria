/**
 * HorseSearchRow names a revealed trait by the server's authored name
 * (Equoria-no441, owner rulings 2026-10-28 q164/q165): "People Trusting", not
 * a word guessed from the stored id. An older reply without names still reads
 * as words.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { HorseSearchRow } from '../HorseSearchRow';
import type { MarketplaceSearchHorse } from '@/lib/api-client';

const horse = (extra: Partial<MarketplaceSearchHorse> = {}): MarketplaceSearchHorse => ({
  id: 7,
  name: 'Juniper',
  breed: 'Arabian',
  age: 6,
  sex: 'Mare',
  color: 'Bay',
  owner: { username: 'Mara' },
  stats: {
    speed: 1,
    stamina: 1,
    agility: 1,
    precision: 1,
    strength: 1,
    intelligence: 1,
    boldness: 1,
  } as MarketplaceSearchHorse['stats'],
  revealedTraits: { positive: ['ptTrust'], negative: ['skittish'] },
  imageUrl: null,
  sale: { price: 900 },
  stud: null,
  ...extra,
});

const renderRow = (h: MarketplaceSearchHorse) =>
  render(
    <MemoryRouter>
      <HorseSearchRow horse={h} onBuy={() => undefined} />
    </MemoryRouter>
  );

describe('HorseSearchRow: revealed trait names', () => {
  it("shows the server's authored name, never the stored id", () => {
    const { container } = renderRow(
      horse({ traitLabels: { ptTrust: 'People Trusting', skittish: 'Skittish' } })
    );
    expect(screen.getByText('People Trusting')).toBeInTheDocument();
    expect(screen.getByText('Skittish')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/ptTrust|Pt Trust/);
  });

  it('still reads an older reply without names as words', () => {
    renderRow(horse());
    expect(screen.getByText('Pt Trust')).toBeInTheDocument();
  });
});
