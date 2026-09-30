/**
 * OnboardingPage -> spotlight tour hand-off (Equoria-bvddn.31)
 *
 * Owner ruling 2026-09-30: finishing the wizard hands the new player INTO the
 * guided spotlight tour. The server answers `{ step: 1, completed: false }`;
 * the page must write exactly that into the ['profile'] cache (merged into the
 * cached user) so the OnboardingSpotlight (needs completed === false &&
 * step >= 1) appears immediately, without waiting for a profile refetch.
 *
 * Real AuthProvider, real React Query, real apiClient and real
 * OnboardingSpotlight; only the HTTP transport is stubbed by MSW, with the
 * real response shape of POST /api/v1/auth/advance-onboarding.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { AuthProvider } from '@/contexts/AuthContext';
import OnboardingSpotlight from '@/components/onboarding/OnboardingSpotlight';
import OnboardingPage from '../OnboardingPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const newPlayer = {
  id: 7,
  username: 'NewRider',
  email: 'newrider@equoria.local',
  firstName: 'New',
  lastName: 'Rider',
  role: 'user',
  money: 5000,
  level: 1,
  xp: 0,
  completedOnboarding: false,
  onboardingStep: 0,
};

describe('OnboardingPage finish -> spotlight tour hand-off (Equoria-bvddn.31)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    sessionStorage.clear();
    // Last wizard step with a completed horse selection, as after "Choose Your Horse".
    sessionStorage.setItem('equoria-onboarding-step', '2');
    sessionStorage.setItem(
      'equoria-onboarding-horse',
      JSON.stringify({
        breedId: 1,
        breedName: 'Thoroughbred',
        gender: 'Mare',
        horseName: 'Tour Star',
      })
    );

    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    // The AuthProvider reads these; seeded so no refetch races the assertion.
    queryClient.setQueryData(['profile'], { user: newPlayer });
    queryClient.setQueryData(['verificationStatus'], {
      verified: true,
      email: newPlayer.email,
      verifiedAt: null,
    });
  });

  it('caches step 1 / completed false from the mutation result and shows the spotlight', async () => {
    server.use(
      http.post(`${base}/api/v1/auth/advance-onboarding`, () =>
        HttpResponse.json({
          success: true,
          message: 'Onboarding step advanced',
          data: {
            step: 1,
            completed: false,
            horse: { id: 99, name: 'Tour Star', breedId: 1, breed: 'Thoroughbred', gender: 'Mare' },
          },
        })
      ),
      http.get(`${base}/api/v1/horses`, () => HttpResponse.json({ success: true, data: [] }))
    );

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/onboarding']}>
            <OnboardingSpotlight />
            <Routes>
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route path="/stable" element={<div>Stable page</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    // Before finishing: player is at step 0, so no tour card.
    expect(screen.queryByText(/Step 1 of 10/)).not.toBeInTheDocument();

    await userEvent.click(await screen.findByTestId('onboarding-next'));

    // The spotlight appears immediately from the cache write (step 1 of the tour).
    expect(await screen.findByText(/Step 1 of 10/)).toBeInTheDocument();
    expect(screen.getByText(/claiming your weekly coins/i)).toBeInTheDocument();

    const cached = queryClient.getQueryData<{ user: typeof newPlayer }>(['profile']);
    expect(cached?.user.completedOnboarding).toBe(false);
    expect(cached?.user.onboardingStep).toBe(1);
    // Merged into the cached user, not replaced.
    expect(cached?.user.username).toBe('NewRider');
    expect(cached?.user.money).toBe(5000);
  });
});
