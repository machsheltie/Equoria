/**
 * The side panel never claims "No recent activity" (Equoria-xsbit, STA-10)
 *
 * The Recent Activity block rendered a fixed "No recent activity" with no
 * query behind it: a stable with plenty happening was told nothing happened.
 * The block had no real source, so it is removed (doctrine §4: unbuilt
 * functionality is absent, never simulated). The player's real activity feed
 * lives on her Profile page.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, MockAuthProvider } from '@/test/utils';
import { server } from '@/test/msw/server';
import { AsidePanel } from '../AsidePanel';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

describe('AsidePanel recent activity (Equoria-xsbit)', () => {
  test('does not show a fixed "No recent activity" claim', async () => {
    server.use(
      http.get(`${base}/api/v1/horses`, () =>
        HttpResponse.json({ success: true, data: [{ id: 1, name: 'Moonlit', ageYears: 6 }] })
      )
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MockAuthProvider>
          <MemoryRouter>
            <AsidePanel />
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );

    expect(await screen.findByText('Moonlit')).toBeInTheDocument();
    expect(screen.queryByText(/no recent activity/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Recent Activity')).not.toBeInTheDocument();
  });
});
