/**
 * The Arena offers hosting a show (Equoria-oey96.13): the endpoint existed but no
 * screen reached it. Real page and hooks; MSW answers the network only.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import CompetitionBrowserPage from '../CompetitionBrowserPage';
import { MockAuthProvider } from '@/test/utils';
import { server } from '../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

describe('CompetitionBrowserPage: Host a Show (Equoria-oey96.13)', () => {
  it('opens the host dialog from the Ridden tab', async () => {
    server.use(
      http.get(`${base}/api/v1/competition`, () => HttpResponse.json({ success: true, data: [] })),
      http.get(`${base}/api/v1/shows/hosting`, () =>
        HttpResponse.json({
          success: true,
          data: { hostedThisWeek: 2, weeklyLimit: 10, weekStartedAt: '2026-10-19T04:00:00.000Z' },
        })
      )
    );
    const user = userEvent.setup();
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MockAuthProvider>
          <MemoryRouter initialEntries={['/competitions']}>
            <CompetitionBrowserPage />
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );

    await user.click(await screen.findByTestId('host-show-button'));
    expect(await screen.findByTestId('create-show-dialog')).toBeInTheDocument();
    expect(await screen.findByText('2 of 10 shows this week')).toBeInTheDocument();
  });
});
