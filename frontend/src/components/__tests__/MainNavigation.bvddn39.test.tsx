/**
 * MainNavigation coin display — no fabricated zero (Equoria-bvddn.39)
 *
 * A profile with no balance is UNKNOWN. The HUD must show an honest "—", not
 * a plausible "0" (FRONTEND_ASYNC_STATE_DOCTRINE §4). A real balance of 0 must
 * still render as 0.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, MockAuthProvider } from '../../test/utils';
import { server } from '@/test/msw/server';
import MainNavigation from '../MainNavigation';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function renderNav(money: number | undefined) {
  server.use(
    http.get(`${base}/api/v1/messages/unread-count`, () =>
      HttpResponse.json({ success: true, data: { count: 0 } })
    ),
    http.get(`${base}/api/v1/users/me/game-notifications`, () =>
      HttpResponse.json({ success: true, data: { notifications: [], unreadCount: 0 } })
    )
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider userOverrides={{ money }}>
        <MemoryRouter initialEntries={['/']}>
          <MainNavigation />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('MainNavigation coins (Equoria-bvddn.39)', () => {
  test('shows an unknown marker, not 0, when the profile has no balance', () => {
    renderNav(undefined);
    const coins = screen.getByTestId('coins-display');
    expect(coins).toHaveTextContent('—');
    expect(coins.textContent).not.toMatch(/\b0\b/);
  });

  test('still shows a genuine zero balance as 0', () => {
    renderNav(0);
    expect(screen.getByTestId('coins-display')).toHaveTextContent(/\b0\b/);
  });
});
