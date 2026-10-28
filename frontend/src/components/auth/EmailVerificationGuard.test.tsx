/**
 * EmailVerificationGuard tests (Equoria-voasj, owner ruling q248)
 *
 * Real AuthProvider + real router + real QueryClient, composed with the real
 * OnboardingGuard exactly as App.tsx composes them; only the network boundary
 * (profile + verification-status endpoints) is stubbed with MSW using the real
 * response shape.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { server } from '../../test/msw/server';
import EmailVerificationGuard from './EmailVerificationGuard';
import OnboardingGuard from './OnboardingGuard';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function stubProfile(fields: {
  emailVerified?: boolean;
  completedOnboarding: boolean;
  onboardingStep: number;
}) {
  server.use(
    http.get(`${base}/api/v1/auth/profile`, () =>
      HttpResponse.json({
        data: { user: { id: 'u1', username: 'newplayer', email: 'new@example.com', ...fields } },
      })
    ),
    http.get(`${base}/api/v1/auth/verification-status`, () =>
      HttpResponse.json({
        data: {
          verified: fields.emailVerified === true,
          email: 'new@example.com',
          verifiedAt: null,
        },
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

describe('EmailVerificationGuard (Equoria-voasj)', () => {
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
    const Login = makePage('login-page', seen);
    return render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={[path]}>
            <EmailVerificationGuard>
              <OnboardingGuard>
                <Routes>
                  <Route path="/stable" element={<Stable />} />
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/verify-email" element={<Verify />} />
                  <Route path="/login" element={<Login />} />
                </Routes>
              </OnboardingGuard>
            </EmailVerificationGuard>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
  }

  it('sends an unconfirmed player to /verify-email without rendering the game page', async () => {
    stubProfile({ emailVerified: false, completedOnboarding: true, onboardingStep: 10 });
    renderAt('/stable');

    expect(await screen.findByTestId('verify-page')).toBeInTheDocument();
    expect(seen).not.toContain('stable-page');
  });

  it('keeps a just-registered unconfirmed player on /verify-email instead of the wizard', async () => {
    stubProfile({ emailVerified: false, completedOnboarding: false, onboardingStep: 0 });
    renderAt('/onboarding');

    expect(await screen.findByTestId('verify-page')).toBeInTheDocument();
    await waitFor(() => expect(seen).toContain('verify-page'));
    expect(seen).not.toContain('onboarding-page');
  });

  it('leaves an unconfirmed player on /verify-email?token=x so the link is consumed', async () => {
    stubProfile({ emailVerified: false, completedOnboarding: false, onboardingStep: 0 });
    renderAt('/verify-email?token=x');

    await waitFor(() => expect(seen).toContain('verify-page'));
    expect(screen.getByTestId('search')).toHaveTextContent('?token=x');
  });

  it('never redirects away from a signed-out page such as /login', async () => {
    stubProfile({ emailVerified: false, completedOnboarding: true, onboardingStep: 10 });
    renderAt('/login');

    await waitFor(() => expect(seen).toContain('login-page'));
    expect(screen.queryByTestId('verify-page')).not.toBeInTheDocument();
  });

  it('lets a confirmed player play', async () => {
    stubProfile({ emailVerified: true, completedOnboarding: true, onboardingStep: 10 });
    renderAt('/stable');
    await waitFor(() => expect(seen).toContain('stable-page'));
    expect(screen.queryByTestId('verify-page')).not.toBeInTheDocument();
  });

  it('sends a confirmed step-0 player from /verify-email on to the wizard', async () => {
    stubProfile({ emailVerified: true, completedOnboarding: false, onboardingStep: 0 });
    renderAt('/verify-email');

    expect(await screen.findByTestId('onboarding-page')).toBeInTheDocument();
  });
});
