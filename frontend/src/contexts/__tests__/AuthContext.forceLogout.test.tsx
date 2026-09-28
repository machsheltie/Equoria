/**
 * Cross-tab logout signal (Equoria-bvddn.30).
 *
 * After a password change, SettingsPage writes then removes the localStorage key
 * `equoria:forceLogoutAt` so every OTHER tab receives a `storage` event. Before
 * this fix nothing listened: tab B kept rendering the old session's cached
 * identity, horses and balance.
 *
 * Real AuthProvider, real app QueryClient, real ProtectedRoute, real transport;
 * MSW answers the network with the backend's own 401 bodies (the server has
 * already revoked every session when the password changed).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { QueryClientProvider, useQuery, type QueryClient } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { apiClient } from '@/lib/http/apiClient';
import authSessionState from '@/lib/authSessionState';
import { createAppQueryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const FORCE_LOGOUT_KEY = 'equoria:forceLogoutAt';
const PLAYER = { id: 'user-1', username: 'rider', email: 'rider@example.com', role: 'user' };

let sessionAlive = true;

beforeEach(() => {
  sessionAlive = true;
  authSessionState.clear();
  const expired = () =>
    HttpResponse.json(
      { success: false, message: 'Token expired', status: 'error' },
      { status: 401 }
    );
  server.use(
    http.get(`${base}/api/v1/auth/profile`, () =>
      sessionAlive ? HttpResponse.json({ success: true, data: { user: PLAYER } }) : expired()
    ),
    http.post(`${base}/api/v1/auth/refresh-token`, () =>
      sessionAlive
        ? HttpResponse.json({ success: true, data: { rotated: true, csrfToken: 'c' } })
        : HttpResponse.json({ success: false, message: 'Invalid refresh token' }, { status: 401 })
    ),
    http.get(`${base}/api/v1/stable-ledger`, () =>
      sessionAlive ? HttpResponse.json({ success: true, data: { hay: 12 } }) : expired()
    )
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
  return <div data-testid="stable-page">hay {ledger.data?.hay ?? '-'}</div>;
}

async function signedInOnStable(client: QueryClient) {
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/stable?view=barn']}>
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
  await screen.findByText('hay 12');
}

/** What the browser delivers to a sibling tab for SettingsPage's setItem/removeItem. */
function otherTabWrites(key: string, newValue: string | null) {
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
  });
}

describe('cross-tab logout signal (Equoria-bvddn.30)', () => {
  it('a password change in another tab clears this tab and sends it to /login', async () => {
    const client = createAppQueryClient();
    await signedInOnStable(client);

    // The server revoked every session when the password changed.
    sessionAlive = false;
    otherTabWrites(FORCE_LOGOUT_KEY, String(Date.now()));

    await screen.findByTestId('login-page');
    const state = JSON.parse(screen.getByTestId('login-page').textContent || 'null');
    expect(state.from).toBe('/stable?view=barn');
    expect(client.getQueryData(['stable-ledger'])).toBeUndefined();
    expect(client.getQueryData(['profile'])).toBeUndefined();
  });

  it('ignores the removeItem half of the signal and unrelated keys', async () => {
    const client = createAppQueryClient();
    await signedInOnStable(client);

    otherTabWrites(FORCE_LOGOUT_KEY, null);
    otherTabWrites('equoria:theme', 'celestial');

    expect(screen.getByTestId('stable-page')).toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    expect(client.getQueryData(['stable-ledger'])).toEqual({ hay: 12 });
  });
});
