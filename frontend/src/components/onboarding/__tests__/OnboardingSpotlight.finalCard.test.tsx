/**
 * OnboardingSpotlight — the last tour card shows and Finish completes the tour
 * (Equoria-hlo5x, ACC-05).
 *
 * The server completes onboarding when the tour reaches step 10 (nine advances
 * from step 1). The spotlight showed card N for server step N, so the advance
 * from card 9 completed onboarding and the tour closed: card 10 ("open a
 * horse's Equip page …") and its Finish! button never appeared.
 *
 * Real AuthProvider, real React Query, real apiClient and real
 * OnboardingSpotlight; only the HTTP transport is stubbed by MSW with the real
 * response shapes of GET /auth/profile and POST /auth/advance-onboarding.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { AuthProvider } from '@/contexts/AuthContext';
import OnboardingSpotlight from '@/components/onboarding/OnboardingSpotlight';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function playerAt(step: number, completed: boolean) {
  return {
    id: 7,
    username: 'TourRider',
    email: 'tourrider@equoria.local',
    firstName: 'Tour',
    lastName: 'Rider',
    role: 'user',
    money: 5000,
    level: 1,
    xp: 0,
    welcomeSeen: true,
    completedOnboarding: completed,
    onboardingStep: step,
  };
}

describe('OnboardingSpotlight final card (Equoria-hlo5x)', () => {
  let queryClient: QueryClient;
  let serverStep: number;
  let serverCompleted: boolean;
  let advanceCalls: number;

  beforeEach(() => {
    serverStep = 9;
    serverCompleted = false;
    advanceCalls = 0;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(['profile'], { user: playerAt(9, false) });
    queryClient.setQueryData(['verificationStatus'], {
      verified: true,
      email: 'tourrider@equoria.local',
      verifiedAt: null,
    });
    server.use(
      http.get(`${base}/api/v1/auth/profile`, () =>
        HttpResponse.json({
          success: true,
          data: { user: playerAt(serverStep, serverCompleted) },
        })
      ),
      http.post(`${base}/api/v1/auth/advance-onboarding`, () => {
        advanceCalls += 1;
        serverStep = Math.min(serverStep + 1, 10);
        serverCompleted = serverStep >= 10;
        return HttpResponse.json({
          success: true,
          message: 'Onboarding step advanced',
          data: { step: serverStep, completed: serverCompleted },
        });
      })
    );
  });

  function renderAt(path: string) {
    return render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={[path]}>
            <OnboardingSpotlight />
            <Routes>
              <Route path="/competitions" element={<div>Competitions page</div>} />
              <Route path="/stable" element={<div>Stable page</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
  }

  it('Next on card 9 shows card 10, and Finish! on card 10 completes the tour', async () => {
    const user = userEvent.setup();
    renderAt('/competitions');

    expect(await screen.findByText(/Step 9 of 10/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Next/ }));

    // Card 10 is shown; the server has not been told the tour is over.
    expect(await screen.findByText(/Step 10 of 10/)).toBeInTheDocument();
    expect(screen.getByText(/Equip page/)).toBeInTheDocument();
    expect(advanceCalls).toBe(0);

    await user.click(screen.getByRole('button', { name: /Go to Stable/ }));
    expect(await screen.findByText('Stable page')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Finish!' }));

    await waitFor(() => expect(advanceCalls).toBe(1));
    await waitFor(() => expect(screen.queryByText(/Step 10 of 10/)).not.toBeInTheDocument());
    expect(serverCompleted).toBe(true);
  });
});
