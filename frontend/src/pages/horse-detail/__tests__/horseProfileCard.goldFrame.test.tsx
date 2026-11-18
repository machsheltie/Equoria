/**
 * HorseProfileCard — gold corner flourishes (Equoria-oey96.58, owner q373).
 * The horse's name and portrait panel sits inside GoldBorderFrame, the same
 * frame HorseCard champions and the home page use.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import HorseProfileCard from '../HorseProfileCard';

const horse = {
  id: 1,
  name: 'Moonflower',
  breed: 'Thoroughbred',
  age: 5,
  gender: 'Filly',
  healthStatus: 'Excellent',
  stats: { speed: 40, stamina: 40, agility: 40 },
};

describe('HorseProfileCard — gold frame (Equoria-oey96.58)', () => {
  it('renders the name and portrait panel inside GoldBorderFrame', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <HorseProfileCard
            horse={horse as React.ComponentProps<typeof HorseProfileCard>['horse']}
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

    const frame = screen.getByTestId('horse-profile-gold-frame');
    // Four animated corner flourishes, aria-hidden, owned by GoldBorderFrame.
    expect(frame.querySelectorAll('.gold-corner-animate[aria-hidden="true"]')).toHaveLength(4);
    // The name sits inside the frame.
    expect(frame).toContainElement(screen.getByRole('heading', { level: 1, name: 'Moonflower' }));
  });
});
