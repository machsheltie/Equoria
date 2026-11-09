/**
 * HorseProfileCard — quick-stats numbers (Equoria-7i4cw, owner ruling q173).
 *
 * A stat gain from feeding no longer pops up a "+1 [Stat]!" message: the page
 * itself changes — the stat's number in the quick-stats summary rises. The
 * feed E2E (tests/e2e/feed-stat-gain-notifications.spec.ts) reads those
 * numbers by `horse-quick-stat-<stat>`; this pins that each stat's number is
 * rendered there and follows the horse's data when it changes.
 *
 * Real component; the only scaffolding is a router (EntityHeader renders a
 * back Link) and a QueryClientProvider (useRenameHorse is a mutation).
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import HorseProfileCard from '../HorseProfileCard';

type CardHorse = React.ComponentProps<typeof HorseProfileCard>['horse'];

const stats = {
  precision: 31,
  strength: 32,
  speed: 33,
  agility: 34,
  endurance: 35,
  intelligence: 36,
  stamina: 37,
  balance: 38,
  boldness: 39,
  flexibility: 40,
  obedience: 41,
  focus: 42,
};

function card(horseStats: typeof stats, client: QueryClient) {
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <HorseProfileCard
          horse={
            {
              id: 1,
              name: 'Moonflower',
              breed: 'Thoroughbred',
              age: 5,
              gender: 'Mare',
              healthStatus: 'Excellent',
              stats: horseStats,
            } as CardHorse
          }
          sireName={null}
          isEditing={false}
          editName=""
          onStartEdit={() => {}}
          onCancelEdit={() => {}}
          onChangeEditName={() => {}}
          refetch={() => {}}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('HorseProfileCard — quick-stats numbers (q173)', () => {
  it('renders every stat number under its own horse-quick-stat id', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(card(stats, client));
    for (const [name, value] of Object.entries(stats)) {
      expect(screen.getByTestId(`horse-quick-stat-${name}`)).toHaveTextContent(
        new RegExp(`^${value}$`)
      );
    }
  });

  it('shows a fed stat gain as that number rising by exactly 1, the others unchanged', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = render(card(stats, client));
    rerender(card({ ...stats, speed: stats.speed + 1 }, client));
    expect(screen.getByTestId('horse-quick-stat-speed')).toHaveTextContent(/^34$/);
    expect(screen.getByTestId('horse-quick-stat-agility')).toHaveTextContent(/^34$/);
    expect(screen.getByTestId('horse-quick-stat-precision')).toHaveTextContent(/^31$/);
  });
});
