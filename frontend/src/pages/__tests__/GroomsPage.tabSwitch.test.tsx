/**
 * GroomsPage manage/hire + cross-tab jump tests (Equoria-o5hub.30)
 *
 * The Grooms location has manage/hire tabs and an onBrowseMarketplace cross-tab
 * handler: when the user has no grooms, MyGroomsDashboard's empty state offers
 * "Browse Groom Marketplace", which calls onBrowseMarketplace={() => setActiveTab('hire')}.
 * This is the cross-tab handler the issue calls out (only groom-lifecycle e2e
 * covered Grooms before). RTL-testable against the existing MSW handlers; the
 * empty-grooms case is provoked by overriding grooms/user → [] (network
 * boundary), NOT by mocking our API client (CLAUDE.md §3). MockAuthProvider
 * supplies the userId the page reads.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import React from 'react';
import GroomsPage from '../GroomsPage';
import { MockAuthProvider } from '@/test/utils';

function emptyGroomsHandler() {
  return http.get('*/api/v1/grooms/user/:userId', () =>
    HttpResponse.json({ success: true, data: [] })
  );
}

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MockAuthProvider>
        <MemoryRouter>
          <GroomsPage />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('GroomsPage — manage/hire tabs + cross-tab jump (Equoria-o5hub.30)', () => {
  it('defaults to the Manage tab showing the hired-grooms grid', async () => {
    renderPage();
    // The default MSW handler returns one hired groom (Alice Thornton).
    expect(await screen.findByTestId('groom-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('groom-list')).not.toBeInTheDocument();
  });

  it('manually clicking the Hire tab shows the groom marketplace list', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('groom-grid');

    await user.click(screen.getByTestId('hire-tab'));

    expect(await screen.findByTestId('groom-list')).toBeInTheDocument();
  });

  it('the empty dashboard "Browse Groom Marketplace" button jumps to the Hire tab (onBrowseMarketplace)', async () => {
    // Override grooms to empty so the dashboard renders its empty-state CTA.
    server.use(emptyGroomsHandler());
    const user = userEvent.setup();
    renderPage();

    // Empty state surfaces the "No Grooms Hired" CTA.
    const cta = await screen.findByRole('button', { name: /browse groom marketplace/i });
    await user.click(cta);

    // Cross-tab jump switched to hire — the marketplace list appears.
    await waitFor(() => {
      expect(screen.getByTestId('groom-list')).toBeInTheDocument();
    });
  });
});
