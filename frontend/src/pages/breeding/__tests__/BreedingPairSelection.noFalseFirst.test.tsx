/**
 * BreedingPairSelection never claims a "first breeding" it cannot know (Equoria-5z9pl).
 *
 * The page decided "first breed" from user.settings.milestones.firstBreed. The
 * User type has no settings field and no backend code writes that flag, so the
 * answer was always yes: every breeding was announced "First breeding
 * successful!". No server fact says whether this is the player's first
 * breeding, so the page does not claim it.
 *
 * MSW at the network boundary; the real page, selectors, confirmation dialog
 * and reward feedback.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { server } from '../../../test/msw/server';
import { MockAuthProvider } from '../../../test/utils';
import BreedingPairSelection from '../BreedingPairSelection';
import { RewardToastProvider } from '@/components/feedback';
import type { HorseSummary } from '@/lib/api/types';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useNavigate: () => vi.fn() };
});

const STATS: HorseSummary['stats'] = {
  precision: 50,
  strength: 50,
  speed: 50,
  agility: 50,
  endurance: 50,
  intelligence: 50,
  stamina: 50,
  balance: 50,
  boldness: 50,
  flexibility: 50,
  obedience: 50,
  focus: 50,
};

function listHorse(overrides: Partial<HorseSummary>): HorseSummary {
  return {
    id: 0,
    name: '',
    breed: { id: 1, name: 'Thoroughbred' },
    age: 6,
    ageYears: 6,
    gender: '',
    sex: 'Mare',
    dateOfBirth: '2019-01-01',
    healthStatus: 'Excellent',
    stats: STATS,
    disciplineScores: {},
    breedingCooldownEndsAt: null,
    inFoal: false,
    ...overrides,
  };
}

describe('BreedingPairSelection — no invented "first breeding" (Equoria-5z9pl)', () => {
  it('announces a successful breeding without calling it the first', async () => {
    server.use(
      http.get(`${base}/api/v1/horses`, () =>
        HttpResponse.json({
          success: true,
          data: [
            listHorse({ id: 31, name: 'TestFixture-Sire', sex: 'Stallion' }),
            listHorse({ id: 32, name: 'TestFixture-Dam' }),
          ],
        })
      ),
      http.post(`${base}/api/v1/horses/foals`, () =>
        HttpResponse.json({
          success: true,
          message: 'TestFixture-Dam is now in foal. The foal will be born in 7 days.',
          data: {
            pregnancyStarted: true,
            damId: 32,
            sireId: 31,
            foalDueDate: new Date(Date.now() + 7 * 86_400_000).toISOString(),
          },
        })
      )
    );
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MockAuthProvider>
          <RewardToastProvider>
            <MemoryRouter>
              <BreedingPairSelection userId="test-user-5z9pl" />
            </MemoryRouter>
          </RewardToastProvider>
        </MockAuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Select TestFixture-Sire')).toBeInTheDocument()
    );
    await user.click(screen.getByLabelText('Select TestFixture-Sire'));
    await user.click(screen.getByLabelText('Select TestFixture-Dam'));
    await user.click(screen.getByRole('button', { name: 'Initiate Breeding' }));
    const dialog = await screen.findByTestId('breeding-confirmation-modal');
    await user.click(
      Array.from(dialog.querySelectorAll('button')).find((b) =>
        /confirm breeding/i.test(b.textContent ?? '')
      ) as HTMLButtonElement
    );

    await waitFor(() => expect(screen.getByText('Breeding successful!')).toBeInTheDocument());
    expect(screen.queryByText('First breeding successful!')).not.toBeInTheDocument();
  });
});
