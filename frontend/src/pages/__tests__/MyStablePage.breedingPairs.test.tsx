/**
 * MyStablePage "Breeding Pairs" counts by sex GROUP and AGE (Equoria-e2qs6).
 *
 * The canonical sex vocabulary is Stallion/Mare/Colt/Filly. A colt is a
 * young stallion and a filly a young mare, and `sex` is never relabeled as a
 * horse ages, so a 5-year-old born as a Filly is stored as 'Filly'. Counting
 * only the exact strings 'stallion'/'mare' dropped every naturally bred adult.
 * AGE (3+), not the sex string, decides who can breed.
 *
 * Rendered against the real AuthContext, hooks and apiClient; only the network
 * boundary is stubbed with MSW (same boundary as the career-stats suite).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, MockAuthProvider } from '@/test/utils';
import { server } from '@/test/msw/server';
import MyStablePage from '../MyStablePage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const userId = 'user-123';

function horse(id: number, sex: string, ageYears: number) {
  return { id, name: `Horse ${id}`, breed: 'Thoroughbred', totalEarnings: 0, sex, ageYears };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MockAuthProvider userOverrides={{ id: userId, username: 'tester' }}>
        <MemoryRouter initialEntries={['/my-stable']}>
          <MyStablePage />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

async function breedingPairsValue(): Promise<string> {
  const grid = await screen.findByTestId('stable-stats');
  const label = within(grid).getByText('Breeding Pairs');
  return label.parentElement?.nextElementSibling?.textContent?.trim() ?? '';
}

describe('MyStablePage — Breeding Pairs stat', () => {
  beforeEach(() => {
    server.use(
      http.get(`${base}/api/v1/users/${userId}/competition-stats`, () =>
        HttpResponse.json({
          userId: userId,
          totalCompetitions: 0,
          totalWins: 0,
          totalTop3: 0,
          winRate: 0,
          totalPrizeMoney: 0,
          bestPlacement: null,
          mostSuccessfulDiscipline: null,
          recentCompetitions: [],
        })
      )
    );
  });

  it('counts adult Colt/Filly horses as stallions and mares', async () => {
    server.use(
      http.get(`${base}/api/v1/horses`, () =>
        HttpResponse.json({ success: true, data: [horse(1, 'Colt', 5), horse(2, 'Filly', 6)] })
      )
    );
    renderPage();
    expect(await breedingPairValueEventually('1')).toBe(true);
  });

  it('does not count horses under 3, whatever their sex string', async () => {
    server.use(
      http.get(`${base}/api/v1/horses`, () =>
        HttpResponse.json({
          success: true,
          data: [horse(1, 'Stallion', 2), horse(2, 'Mare', 2), horse(3, 'Mare', 4)],
        })
      )
    );
    renderPage();
    expect(await breedingPairValueEventually('0')).toBe(true);
  });
});

/** The value arrives after the roster resolves; poll until it settles. */
async function breedingPairValueEventually(expected: string): Promise<boolean> {
  const deadline = Date.now() + 4000;
  let last = '';
  while (Date.now() < deadline) {
    last = await breedingPairsValue();
    if (last === expected) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Breeding Pairs stayed at "${last}", expected "${expected}"`);
}
