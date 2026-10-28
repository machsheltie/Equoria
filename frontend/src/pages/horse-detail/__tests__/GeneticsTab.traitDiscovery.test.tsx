/**
 * Trait Discovery shows one chip per trait the horse carries (owner rulings
 * q174 and q213, 2026-10-28; Equoria-i366a, Equoria-nrto5).
 *
 * "Hidden" for each hidden trait (count only: the server names none), gold
 * for a revealed trait, greyed "Inactive" with its name for a switched-off
 * one. Authored labels, never code names; never a rarity.
 *
 * Real GeneticsTab and hooks; the API is answered by MSW.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import GeneticsTab from '../GeneticsTab';
import type { Horse } from '../HorseDetailPageTypes';
import { server } from '@/test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const horse = {
  id: 79,
  name: 'TestFixture-Chips',
  breed: 'Thoroughbred',
  age: 2,
  gender: 'Filly',
  dateOfBirth: '2024-01-01T00:00:00.000Z',
  healthStatus: 'Excellent',
  stats: {},
  disciplineScores: {},
} as unknown as Horse;

function stubTraits() {
  server.use(
    http.get(`${base}/api/v1/traits/horse/79`, () =>
      HttpResponse.json({
        success: true,
        data: {
          traits: {
            positive: [
              {
                name: 'eagerLearner',
                isNew: false,
                definition: {
                  label: 'Eager Learner',
                  type: 'positive',
                  description: 'Shows enthusiasm for learning new skills and training.',
                },
              },
            ],
            negative: [],
            dormant: [
              {
                name: 'fearful',
                isNew: false,
                definition: { label: 'Fearful', type: 'negative', description: 'Spooks.' },
              },
            ],
            hiddenCount: 3,
          },
        },
      })
    ),
    http.post(`${base}/api/v1/traits/horse/79/seen`, () =>
      HttpResponse.json({ success: true, data: null })
    )
  );
}

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <GeneticsTab horse={horse} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('GeneticsTab Trait Discovery chips (q174, q213)', () => {
  it('shows a chip for every carried trait: revealed, inactive and each hidden one', async () => {
    stubTraits();
    renderTab();

    const list = await screen.findByRole('list', { name: 'Traits carried' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(5);

    const revealed = within(list).getByRole('button', { name: 'Eager Learner' });
    expect(revealed).toHaveClass('trait-chip--revealed');

    const inactive = screen.getByTestId('trait-chip-inactive');
    expect(inactive).toHaveTextContent('Fearful');
    expect(inactive).toHaveTextContent('Inactive');
    expect(inactive).toHaveClass('trait-chip--inactive');

    const hidden = screen.getAllByTestId('trait-chip-hidden');
    expect(hidden).toHaveLength(3);
    for (const chip of hidden) {
      expect(chip).toHaveTextContent(/^Hidden$/);
      expect(chip).toHaveClass('trait-chip--hidden');
    }

    // Authored labels only, never code names or a rarity.
    expect(screen.queryByText(/eagerLearner/)).toBeNull();
    expect(screen.queryByText(/rare|common|legendary/i)).toBeNull();
  });

  it('opens the detail of a revealed trait from its gold chip', async () => {
    stubTraits();
    renderTab();

    await userEvent.click(await screen.findByRole('button', { name: 'Eager Learner' }));
    expect(
      await screen.findByText('Shows enthusiasm for learning new skills and training.')
    ).toBeInTheDocument();
  });
});
