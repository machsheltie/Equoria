/**
 * Expired session returns the player to /login (Equoria-bvddn.29).
 *
 * Before this fix the app built `new QueryClient()` with no QueryCache /
 * MutationCache error handling. When the refresh token was dead, fetchWithAuth
 * threw a 401, but the profile query kept its previous data on the refetch
 * error, so `isAuthenticated` stayed true: every panel showed "session expired"
 * and nothing ever sent the player back to /login.
 *
 * These tests drive the REAL transport (apiClient + refresh single-flight), the
 * REAL app QueryClient, the REAL AuthProvider and the REAL ProtectedRoute. The
 * only stand-in is the network, answered by MSW with the backend's own 401
 * bodies:
 *   - protected request: middleware/auth.mjs respondUnauthorized
 *       { success: false, message: 'Token expired', status: 'error' }
 *   - POST /auth/refresh-token: authController.refreshToken -> errorHandler
 *       { success: false, message: 'Invalid refresh token' }
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import {
  QueryClientProvider,
  useMutation,
  useQuery,
  type QueryClient,
} from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { apiClient } from '@/lib/http/apiClient';
import authSessionState from '@/lib/authSessionState';
import { createAppQueryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const PLAYER = {
  id: 'user-1',
  username: 'rider',
  email: 'rider@example.com',
  role: 'user',
};

let sessionAlive = true;
let profileCalls = 0;
let refreshCalls = 0;

beforeEach(() => {
  sessionAlive = true;
  profileCalls = 0;
  refreshCalls = 0;
  authSessionState.clear();

  server.use(
    http.get(`${base}/api/v1/auth/profile`, () => {
      profileCalls += 1;
      if (!sessionAlive) {
        return HttpResponse.json(
          { success: false, message: 'Token expired', status: 'error' },
          { status: 401 }
        );
      }
      return HttpResponse.json({ success: true, data: { user: PLAYER } });
    }),
    http.post(`${base}/api/v1/auth/refresh-token`, () => {
      refreshCalls += 1;
      if (!sessionAlive) {
        return HttpResponse.json(
          { success: false, message: 'Invalid refresh token' },
          { status: 401 }
        );
      }
      return HttpResponse.json({
        success: true,
        message: 'Token refreshed successfully',
        data: { rotated: true, csrfToken: 'rotated-csrf' },
      });
    }),
    http.get(`${base}/api/v1/stable-ledger`, () => {
      if (!sessionAlive) {
        return HttpResponse.json(
          { success: false, message: 'Token expired', status: 'error' },
          { status: 401 }
        );
      }
      return HttpResponse.json({ success: true, data: { hay: 12 } });
    }),
    http.post(`${base}/api/v1/stable-ledger/feed`, () => {
      if (!sessionAlive) {
        return HttpResponse.json(
          { success: false, message: 'Token expired', status: 'error' },
          { status: 401 }
        );
      }
      return HttpResponse.json({ success: true, data: { fed: true } });
    })
  );
});

function LoginProbe() {
  const location = useLocation();
  return <div data-testid="login-page">{JSON.stringify(location.state ?? null)}</div>;
}

function StablePage() {
  const ledger = useQuery({
    queryKey: ['stable-ledger'],
    queryFn: () => apiClient.get<{ hay: number }>('/api/v1/stable-ledger'),
  });
  const feed = useMutation({
    mutationFn: () => apiClient.post('/api/v1/stable-ledger/feed', {}),
  });
  return (
    <div data-testid="stable-page">
      <span>hay {ledger.data?.hay ?? '-'}</span>
      <button type="button" onClick={() => feed.mutate()}>
        feed
      </button>
    </div>
  );
}

function renderApp(client: QueryClient, initialEntry: string) {
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/login" element={<LoginProbe />} />
            <Route
              path="/stable"
              element={
                <ProtectedRoute>
                  <StablePage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

async function signedInOnStable(client: QueryClient) {
  renderApp(client, '/stable?view=barn#loft');
  await screen.findByText('hay 12');
}

function loginState(): { from?: string; message?: string } | null {
  return JSON.parse(screen.getByTestId('login-page').textContent || 'null');
}

describe('expired session returns the player to /login (Equoria-bvddn.29)', () => {
  it('a query 401 after a failed refresh clears the cache and navigates to /login with the return path', async () => {
    const client = createAppQueryClient();
    await signedInOnStable(client);

    sessionAlive = false;
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['profile'] });
    });

    await screen.findByTestId('login-page');
    expect(loginState()?.from).toBe('/stable?view=barn#loft');
    expect(client.getQueryData(['stable-ledger'])).toBeUndefined();
    expect(client.getQueryData(['profile'])).toBeUndefined();
    expect(refreshCalls).toBeGreaterThanOrEqual(1);
  });

  it('a mutation 401 after a failed refresh clears the cache and navigates to /login', async () => {
    const client = createAppQueryClient();
    await signedInOnStable(client);

    sessionAlive = false;
    await act(async () => {
      screen.getByRole('button', { name: 'feed' }).click();
    });

    await screen.findByTestId('login-page');
    expect(loginState()?.from).toBe('/stable?view=barn#loft');
    expect(client.getQueryData(['stable-ledger'])).toBeUndefined();
  });

  it('a first 401 that the refresh recovers does not end the session', async () => {
    const client = createAppQueryClient();
    let ledgerCalls = 0;
    server.use(
      http.get(`${base}/api/v1/stable-ledger`, () => {
        ledgerCalls += 1;
        // Access token expired once; the refresh (alive) mints a new one.
        if (ledgerCalls === 2) {
          return HttpResponse.json(
            { success: false, message: 'Token expired', status: 'error' },
            { status: 401 }
          );
        }
        return HttpResponse.json({ success: true, data: { hay: 12 } });
      })
    );
    await signedInOnStable(client);

    await act(async () => {
      await client.invalidateQueries({ queryKey: ['stable-ledger'] });
    });

    expect(refreshCalls).toBe(1);
    expect(screen.getByTestId('stable-page')).toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    expect(client.getQueryData(['profile'])).toEqual({ user: PLAYER });
  });

  it('a 401 that survives a SUCCESSFUL refresh is not treated as an expired session', async () => {
    const client = createAppQueryClient();
    await signedInOnStable(client);

    // Refresh stays alive; only this endpoint keeps answering 401.
    server.use(
      http.post(`${base}/api/v1/stable-ledger/feed`, () =>
        HttpResponse.json(
          { success: false, message: 'Token expired', status: 'error' },
          { status: 401 }
        )
      )
    );
    await act(async () => {
      screen.getByRole('button', { name: 'feed' }).click();
    });

    await waitFor(() => expect(refreshCalls).toBe(1));
    expect(screen.getByTestId('stable-page')).toBeInTheDocument();
    expect(client.getQueryData(['profile'])).toEqual({ user: PLAYER });
  });

  it('a signed-out visitor on /login is not redirected and the profile check does not loop', async () => {
    sessionAlive = false;
    const client = createAppQueryClient();
    renderApp(client, '/login');

    await waitFor(() => expect(refreshCalls).toBe(1));
    // Give any clear -> refetch -> 401 -> clear cycle time to show itself.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });
    expect(profileCalls).toBe(1);
    expect(refreshCalls).toBe(1);
    expect(loginState()).toBeNull();
  });

  it('never sends the player to an off-origin return path', async () => {
    const client = createAppQueryClient();
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={['//evil.example/stable']}>
            <Routes>
              <Route path="/login" element={<LoginProbe />} />
              <Route
                path="*"
                element={
                  <ProtectedRoute>
                    <StablePage />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    await screen.findByText('hay 12');

    sessionAlive = false;
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['profile'] });
    });

    await screen.findByTestId('login-page');
    expect(loginState()?.from).toBe('/');
  });
});
