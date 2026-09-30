/**
 * OnboardingGuard tests (Equoria-bvddn.38)
 *
 * Real AuthProvider + real router + real QueryClient; only the network
 * boundary (profile endpoint) is stubbed with MSW using the real response shape.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { server } from '../../test/msw/server';
import OnboardingGuard from './OnboardingGuard';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function stubProfile(onboarding: { completedOnboarding: boolean; onboardingStep: number }) {
  server.use(
    http.get(`${base}/api/v1/auth/profile`, () =>
      HttpResponse.json({
        data: { user: { id: 1, username: 'newplayer', email: 'new@example.com', ...onboarding } },
      })
    ),
    http.get(`${base}/api/v1/auth/verification-status`, () =>
      HttpResponse.json({
        data: { verified: false, email: 'new@example.com', verifiedAt: null },
      })
    )
  );
}

/** Records a render only once the profile is loaded, i.e. what a player could see. */
function makePage(testId: string, seen: string[]) {
  return function Page() {
    const { user } = useAuth();
    const location = useLocation();
    if (user) seen.push(testId);
    return (
      <div data-testid={testId}>
        {testId}
        <span data-testid="search">{location.search}</span>
      </div>
    );
  };
}

describe('OnboardingGuard (Equoria-bvddn.38)', () => {
  let queryClient: QueryClient;
  let seen: string[];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    seen = [];
  });

  afterEach(() => {
    queryClient.clear();
  });

  function renderAt(path: string) {
    const Stable = makePage('stable-page', seen);
    const Onboarding = makePage('onboarding-page', seen);
    const Verify = makePage('verify-page', seen);
    const Reset = makePage('reset-page', seen);
    return render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={[path]}>
            <OnboardingGuard>
              <Routes>
                <Route path="/stable" element={<Stable />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/verify-email" element={<Verify />} />
                <Route path="/reset-password" element={<Reset />} />
              </Routes>
            </OnboardingGuard>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
  }

  it('sends a step-0 player to /onboarding without ever rendering the protected page', async () => {
    stubProfile({ completedOnboarding: false, onboardingStep: 0 });
    renderAt('/stable');

    expect(await screen.findByTestId('onboarding-page')).toBeInTheDocument();
    expect(seen).not.toContain('stable-page');
  });

  it('leaves a step-0 player on /verify-email?token=x so the token can be consumed', async () => {
    stubProfile({ completedOnboarding: false, onboardingStep: 0 });
    renderAt('/verify-email?token=x');

    await waitFor(() => expect(seen).toContain('verify-page'));
    expect(screen.getByTestId('verify-page')).toBeInTheDocument();
    expect(screen.getByTestId('search')).toHaveTextContent('?token=x');
    expect(screen.queryByTestId('onboarding-page')).not.toBeInTheDocument();
  });

  it('leaves a step-0 player on /reset-password', async () => {
    stubProfile({ completedOnboarding: false, onboardingStep: 0 });
    renderAt('/reset-password?token=y');

    await waitFor(() => expect(seen).toContain('reset-page'));
    expect(screen.queryByTestId('onboarding-page')).not.toBeInTheDocument();
  });

  it('still sends a step-0 player on token-less /verify-email (post-registration landing) to /onboarding', async () => {
    stubProfile({ completedOnboarding: false, onboardingStep: 0 });
    renderAt('/verify-email');

    expect(await screen.findByTestId('onboarding-page')).toBeInTheDocument();
    expect(seen).not.toContain('verify-page');
  });

  it('does not redirect a step-1 player', async () => {
    stubProfile({ completedOnboarding: false, onboardingStep: 1 });
    renderAt('/stable');

    await waitFor(() => expect(seen).toContain('stable-page'));
    expect(screen.queryByTestId('onboarding-page')).not.toBeInTheDocument();
  });
});
